import { XMLParser } from 'fast-xml-parser';

export const FEED_URL = 'https://h-takara.hatenablog.com/rss';
const FRESH_SECONDS = 120;
const STALE_SECONDS = 86400;
const MAX_BYTES = 1024 * 1024;
const parser = new XMLParser({ ignoreAttributes: false, attributeNamePrefix: '@_', processEntities: true, stopNodes: ['*.description', '*.content:encoded'] });
const text = value => typeof value === 'string' ? value : String(value?.['#text'] ?? '');
const list = value => value == null ? [] : Array.isArray(value) ? value : [value];

function safeUrl(value, article = false) {
  try {
    const url = new URL(text(value));
    if (url.protocol !== 'https:') return '';
    if (article && url.hostname !== 'h-takara.hatenablog.com') return '';
    return url.href;
  } catch { return ''; }
}

export function parseFeed(xml) {
  // Feeds never need custom entities. Reject DTDs before parsing untrusted XML.
  if (/<!DOCTYPE|<!ENTITY/i.test(xml)) throw new Error('Unsupported XML declaration');
  const articles = list(parser.parse(xml)?.rss?.channel?.item).slice(0, 12).map(item => {
    const image = text(item['content:encoded'] || item.description).match(/<img[^>]+src=["']([^"']+)["']/i)?.[1];
    const date = new Date(item.pubDate);
    return {
      title: text(item.title).slice(0, 500) || '無題の記事',
      url: safeUrl(item.link, true),
      publishedAt: Number.isNaN(date.getTime()) ? '' : date.toISOString(),
      thumbnailUrl: safeUrl(item['media:thumbnail']?.['@_url'] || item['media:content']?.['@_url'] ||
        (String(item.enclosure?.['@_type']).startsWith('image/') ? item.enclosure?.['@_url'] : '') || image),
    };
  }).filter(article => article.url);
  if (!articles.length) throw new Error('No valid articles');
  return articles;
}

async function readBounded(response) {
  if (Number(response.headers.get('Content-Length')) > MAX_BYTES) throw new Error('Feed too large');
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let size = 0, xml = '';
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > MAX_BYTES) { await reader.cancel(); throw new Error('Feed too large'); }
      xml += decoder.decode(value, { stream: true });
    }
    return xml + decoder.decode();
  } finally { reader.releaseLock(); }
}

export async function handleRequest(request, env, ctx, deps) {
  const { fetch: fetchUpstream, cache, now = Date.now } = deps;
  const allowed = (env.ALLOWED_ORIGINS || '').split(',').map(value => value.trim()).filter(Boolean);
  const origin = request.headers.get('Origin');
  const headers = { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store',
    'X-Content-Type-Options': 'nosniff', Vary: 'Origin' };
  if (origin && allowed.includes(origin)) headers['Access-Control-Allow-Origin'] = origin;
  const reply = (body, status = 200) => new Response(JSON.stringify(body), { status, headers });
  if (origin && !allowed.includes(origin)) return reply({ error: 'Origin not allowed' }, 403);
  if (new URL(request.url).pathname !== '/api/articles') return reply({ error: 'Not found' }, 404);
  if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: {
    ...headers, 'Access-Control-Allow-Methods': 'GET, OPTIONS', 'Access-Control-Max-Age': '86400' } });
  if (request.method !== 'GET') return reply({ error: 'Method not allowed' }, 405);

  // Ignore query strings in the internal key, so visitors cannot bypass caching.
  const key = new Request(new URL('/_cache/hatena-v1', request.url));
  let previous;
  try { previous = await (await cache.match(key))?.json(); } catch { /* Cache is best effort. */ }
  const age = previous ? now() - Date.parse(previous.fetchedAt) : Infinity;
  if (age >= 0 && age < FRESH_SECONDS * 1000) return reply({ ...previous, stale: false });
  try {
    const response = await fetchUpstream(FEED_URL, {
      headers: { Accept: 'application/rss+xml, application/xml', 'User-Agent': 'h-takara-profile-feed/1.0' },
      signal: AbortSignal.timeout(8000), cache: 'no-store',
    });
    if (!response.ok) throw new Error(`Feed HTTP ${response.status}`);
    const articles = parseFeed(await readBounded(response));
    const payload = { articles, fetchedAt: new Date(now()).toISOString() };
    ctx.waitUntil(cache.put(key, new Response(JSON.stringify(payload), {
      headers: { 'Content-Type': 'application/json', 'Cache-Control': `public, max-age=${STALE_SECONDS}` },
    })).catch(() => {}));
    return reply({ ...payload, stale: false });
  } catch {
    if (previous && age >= 0 && age < STALE_SECONDS * 1000) return reply({ ...previous, stale: true });
    return reply({ error: '記事を取得できませんでした。しばらくしてから再試行してください。' }, 503);
  }
}

export default {
  fetch(request, env, ctx) {
    return handleRequest(request, env, ctx, { fetch: globalThis.fetch, cache: caches.default });
  },
};
