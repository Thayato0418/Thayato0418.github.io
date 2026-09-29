import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import fs from 'node:fs/promises';
const code = await fs.readFile(new URL('../hatena-articles.js', import.meta.url), 'utf8');
const article = {title:'Fresh <script>alert(1)</script>',url:'https://h-takara.hatenablog.com/entry/test',publishedAt:'2026-09-21T00:00:00Z',thumbnailUrl:'javascript:alert(1)'};
function client(fetcher, saved = null, api = 'https://feed.example/api/articles') {
  const listeners = {}, attributes = {}, calls = [];
  const nodes = {'hatena-articles':{innerHTML:'',setAttribute:(key,value)=>attributes[key]=value},'feed-status':{textContent:''}};
  const storage = new Map(saved ? [['takara-hatena-feed-v1',JSON.stringify(saved)]] : []);
  const document = { hidden:false, getElementById:id=>nodes[id], addEventListener:(name, fn)=>listeners[name]=fn };
  const context = vm.createContext({document,window:{HATENA_FEED_API:api},localStorage:{getItem:key=>storage.get(key),setItem:(key,value)=>storage.set(key,value)},
    URL,Date,Intl,AbortSignal,console,setTimeout:()=>1,clearTimeout:()=>{},fetch:async url=>{calls.push(url);return fetcher(url);}});
  vm.runInContext(code,context);
  return {context,document,listeners,nodes,calls,attributes};
}
test('live response renders escaped text, rejects unsafe image URL, and displays RSS time',async()=>{
  const c=client(async()=>Response.json({articles:[article],fetchedAt:'2026-09-21T00:00:00Z',stale:false}));
  await c.listeners.DOMContentLoaded();
  assert.match(c.nodes['hatena-articles'].innerHTML,/&lt;script&gt;/);
  assert.doesNotMatch(c.nodes['hatena-articles'].innerHTML,/javascript:/);
  assert.match(c.nodes['feed-status'].textContent,/自動更新 ON/);
  assert.equal(c.attributes['aria-busy'],'false');
});
test('API failure retains stored articles and does not claim live freshness',async()=>{
  const c=client(async()=>{throw Error('offline');},{articles:[article],fetchedAt:'2026-09-20T00:00:00Z'});
  await c.listeners.DOMContentLoaded();
  assert.match(c.nodes['hatena-articles'].innerHTML,/Fresh/);
  assert.match(c.nodes['feed-status'].textContent,/再確認できていません/);
});
test('first visit uses static fallback when API fails',async()=>{
  const c=client(async url=>url.startsWith('./')?Response.json([article]):new Response('',{status:503}));
  await c.listeners.DOMContentLoaded();assert.equal(c.calls.length,2);
  assert.match(c.nodes['hatena-articles'].innerHTML,/Fresh/);
  assert.match(c.nodes['feed-status'].textContent,/保存済み/);
});
test('hidden tabs do not fetch',async()=>{
  const c=client(async()=>Response.json([article]));c.document.hidden=true;
  await c.listeners.DOMContentLoaded();assert.equal(c.calls.length,0);
});
test('missing API configuration still displays static articles',async()=>{
  const c=client(async()=>Response.json([article]),null,'');await c.listeners.DOMContentLoaded();
  assert.deepEqual(c.calls,['./data/hatena-articles.json']);assert.match(c.nodes['feed-status'].textContent,/接続準備中/);
});
test('invalid response uses fallback, and explicit stale response is labeled',async()=>{
  const c=client(async url=>Response.json(url.startsWith('./')?[article]:{articles:[]}));await c.listeners.DOMContentLoaded();
  assert.match(c.nodes['feed-status'].textContent,/保存済み/);
  const stale=client(async()=>Response.json({articles:[article],fetchedAt:'2026-09-20T00:00:00Z',stale:true}));
  await stale.listeners.DOMContentLoaded();assert.match(stale.nodes['feed-status'].textContent,/次回の確認で再試行/);
});
