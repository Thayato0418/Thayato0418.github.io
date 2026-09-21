import test from 'node:test';
import assert from 'node:assert/strict';
import { handleRequest, parseFeed, FEED_URL } from '../worker/hatena.mjs';
const xml = `<?xml version="1.0"?><rss><channel><item><title>New &amp; latest</title><link>https://h-takara.hatenablog.com/entry/test</link><pubDate>Mon, 21 Sep 2026 00:00:00 GMT</pubDate><description><![CDATA[<img src="https://example.com/image.png">]]></description></item></channel></rss>`;
const origin = 'https://thayato0418.github.io';
const env = { ALLOWED_ORIGINS: origin };
function setup(fetcher = async () => new Response(xml)) {
  const data = new Map(); let time = Date.parse('2026-09-21T01:00:00Z'), calls = 0;
  const waits = [];
  const deps = { now: () => time, fetch: async (...args) => { calls++; assert.equal(args[0], FEED_URL); return fetcher(...args); },
    cache: { match: async req => data.get(req.url)?.clone(), put: async (req, res) => { data.set(req.url, res); } } };
  return { request: (path = '/api/articles', method = 'GET', requestOrigin = origin) => handleRequest(new Request('https://feed.example'+path, {method, headers:{Origin:requestOrigin}}),env,{waitUntil: promise=>waits.push(promise)},deps), advance: ms=>{time+=ms;}, waits, get calls(){return calls;} };
}
test('parses XML entities, one item and image', () => {
  const [article] = parseFeed(xml);
  assert.equal(article.title,'New & latest');
  assert.equal(article.thumbnailUrl,'https://example.com/image.png');
  assert.equal(article.publishedAt,'2026-09-21T00:00:00.000Z');
});
test('rejects DTD, invalid feeds and unsafe links', () => {
  assert.throws(()=>parseFeed('<!DOCTYPE rss>'+xml));
  assert.throws(()=>parseFeed('<html>failed</html>'));
  assert.throws(()=>parseFeed(xml.replace('https://h-takara.hatenablog.com/entry/test','javascript:alert(1)')));
  assert.equal(parseFeed(xml.replace('https://example.com/image.png','javascript:alert(1)'))[0].thumbnailUrl,'');
});
test('cache lasts two minutes and query strings do not bypass it', async () => {
  const s=setup(); const response=await s.request();
  assert.equal(response.headers.get('Access-Control-Allow-Origin'),origin);
  assert.equal(response.headers.get('Cache-Control'),'no-store');
  assert.equal((await response.json()).stale,false);
  await Promise.all(s.waits);
  await s.request('/api/articles?t=123'); assert.equal(s.calls,1);
  s.advance(121000); await s.request(); assert.equal(s.calls,2);
});
test('upstream failure uses previous cached articles, then expires them', async () => {
  let failing=false;
  const s=setup(async()=>{if(failing)throw Error('offline');return new Response(xml);});
  await s.request(); await Promise.all(s.waits); failing=true; s.advance(121000);
  assert.equal((await (await s.request()).json()).stale,true);
  s.advance(86400000);assert.equal((await s.request()).status,503);
});
test('rejects unknown origins, routes, methods without fetching', async () => {
  const s=setup();
  assert.equal((await s.request('/api/articles','GET','https://other.example')).status,403);
  assert.equal((await s.request('/anything')).status,404);
  assert.equal((await s.request('/api/articles','POST')).status,405);
  assert.equal((await s.request('/api/articles','OPTIONS')).status,204);
  assert.equal(s.calls,0);
});
test('oversized feed and upstream HTTP failure return 503', async () => {
  assert.equal((await setup(async()=>new Response('x'.repeat(1024*1024+1))).request()).status,503);
  assert.equal((await setup(async()=>new Response('error',{status:500})).request()).status,503);
});
