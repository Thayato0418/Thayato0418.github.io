const ARTICLES_JSON_URL = "./data/hatena-articles.json";
const DISPLAY_COUNT = 3;

/**
 * HTMLとして解釈される可能性がある文字を無害化する．
 */
const escapeHtml = (value = "") => {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
};

/**
 * RSSの日付を日本語の日付表記に変換する．
 */
const formatDate = (dateString) => {
  const date = new Date(dateString);

  if (Number.isNaN(date.getTime())) {
    return "";
  }

  return new Intl.DateTimeFormat("ja-JP", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
};

/**
 * 記事1件分のHTMLを作成する．
 */
const createArticleHtml = (article) => {
  const title = escapeHtml(
    article.title || "無題の記事",
  );

  const url = escapeHtml(safeArticleUrl(article.url) || "https://h-takara.hatenablog.com/");

  const publishedAt = formatDate(
    article.publishedAt,
  );

  /*
   * サムネイルがない場合は，
   * 既存のHatena Blog画像を使用する．
   */
  const thumbnailUrl = escapeHtml(
    safeImageUrl(article.thumbnailUrl) || "./figure/hatenablog.png",
  );

  return `
    <article class="writeup-card">
      <a
        class="article-thumbnail-link"
        href="${url}"
        target="_blank"
        rel="noopener noreferrer"
        aria-label="${title}をHatena Blogで読む"
      >
        <img
          class="article-thumbnail"
          src="${thumbnailUrl}"
          alt=""
          loading="lazy"
          decoding="async"
          onerror="this.onerror=null; this.src='./figure/hatenablog.png';"
        >
      </a>

      <div class="article-information">
        ${
          publishedAt
            ? `
              <time
                class="article-date"
                datetime="${escapeHtml(article.publishedAt)}"
              >
                ${publishedAt}
              </time>
            `
            : ""
        }

        <a
          class="article-title"
          href="${url}"
          target="_blank"
          rel="noopener noreferrer"
        >
          ${title}
        </a>
      </div>
    </article>
  `;
};

const safeArticleUrl = value => {
  try {
    const url = new URL(value);
    return url.protocol === 'https:' && url.hostname === 'h-takara.hatenablog.com' ? url.href : '';
  } catch { return ''; }
};
const safeImageUrl = value => {
  try { const url = new URL(value); return url.protocol === 'https:' ? url.href : ''; }
  catch { return ''; }
};
const validateArticles = value => {
  if (!Array.isArray(value)) throw new Error('Invalid articles');
  const articles = value.filter(article => article && typeof article.title === 'string' && safeArticleUrl(article.url)).slice(0, DISPLAY_COUNT);
  if (!articles.length) throw new Error('No articles');
  return articles;
};

// Cache is only a fallback; it never replaces a successful live response.
const STORAGE_KEY = 'takara-hatena-feed-v1';
const REFRESH_MS = 60000;
let fetching = false;
let nextRefresh = 0;
let displayedSignature = '';
let lastGood = null;
let timer;

const fetchJson = async url => {
  const response = await fetch(url, { cache: 'no-store', signal: AbortSignal.timeout(12000) });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  return response.json();
};
const timeLabel = value => new Intl.DateTimeFormat('ja-JP', {
  month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit', second: '2-digit',
}).format(new Date(value));
const showArticles = articles => {
  const signature = JSON.stringify(articles);
  if (signature !== displayedSignature) {
    document.getElementById('hatena-articles').innerHTML = articles.map(createArticleHtml).join('');
    displayedSignature = signature;
  }
};
const statusMessage = message => {
  const status = document.getElementById('feed-status');
  if (status) status.textContent = message;
};
const showSavedStatus = () => statusMessage(lastGood?.fetchedAt
  ? `保存済みの記事を表示中 · RSS取得: ${timeLabel(lastGood.fetchedAt)} · 最新情報は再確認できていません`
  : '保存済みの記事を表示中 · 最新の記事はHatena Blogでご確認ください');

async function loadHatenaArticles() {
  if (fetching || document.hidden || !document.getElementById('hatena-articles')) return;
  fetching = true;
  nextRefresh = Date.now() + REFRESH_MS;
  const container = document.getElementById('hatena-articles');
  container.setAttribute('aria-busy', 'true');
  try {
    if (!window.HATENA_FEED_API) {
      if (!lastGood) { lastGood = { articles: validateArticles(await fetchJson(ARTICLES_JSON_URL)) }; showArticles(lastGood.articles); }
      statusMessage('保存済みの記事を表示中 · 自動更新APIの接続準備中');
      return;
    }
    const payload = await fetchJson(window.HATENA_FEED_API);
    const articles = validateArticles(payload.articles);
    if (!payload.fetchedAt || !Number.isFinite(Date.parse(payload.fetchedAt))) throw new Error('Invalid timestamp');
    lastGood = { articles, fetchedAt: payload.fetchedAt };
    showArticles(articles);
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(lastGood)); } catch { /* Storage can be disabled. */ }
    statusMessage(payload.stale
      ? `保存済みの記事を表示中 · RSS取得: ${timeLabel(payload.fetchedAt)} · 次回の確認で再試行します`
      : `自動更新 ON · RSS取得: ${timeLabel(payload.fetchedAt)} · ページ表示中は60秒ごとに確認`);
  } catch {
    if (!lastGood) {
      try { lastGood = { articles: validateArticles(await fetchJson(ARTICLES_JSON_URL)) }; showArticles(lastGood.articles); }
      catch {
        container.innerHTML = '<p class="article-loading">記事を取得できませんでした。下のリンクからHatena Blogをご覧ください。</p>';
      }
    }
    showSavedStatus();
  } finally {
    fetching = false;
    container.setAttribute('aria-busy', 'false');
  }
}
function scheduleRefresh() {
  clearTimeout(timer);
  if (document.hidden || !window.HATENA_FEED_API) return;
  timer = setTimeout(async () => {
    await loadHatenaArticles();
    scheduleRefresh();
  }, Math.max(1000, nextRefresh - Date.now()));
}
document.addEventListener('DOMContentLoaded', async () => {
  const container = document.getElementById('hatena-articles');
  if (!container) return;
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY));
    if (saved?.fetchedAt && Number.isFinite(Date.parse(saved.fetchedAt))) {
      lastGood = { articles: validateArticles(saved.articles), fetchedAt: saved.fetchedAt };
      showArticles(lastGood.articles);
      showSavedStatus();
    }
  } catch { /* Ignore missing, malformed, or unavailable local storage. */ }
  await loadHatenaArticles();
  scheduleRefresh();
});
document.addEventListener('visibilitychange', async () => {
  clearTimeout(timer);
  if (!document.hidden && Date.now() >= nextRefresh) await loadHatenaArticles();
  scheduleRefresh();
});
