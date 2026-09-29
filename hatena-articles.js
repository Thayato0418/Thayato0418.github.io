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

  const url = escapeHtml(article.url || "#");

  const publishedAt = formatDate(
    article.publishedAt,
  );

  /*
   * サムネイルがない場合は，
   * 既存のHatena Blog画像を使用する．
   */
  const thumbnailUrl = escapeHtml(
    article.thumbnailUrl ||
      "./figure/hatenablog.png",
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
/**
 * カテゴリーをHTMLへ変換する．
 * 最大3件まで表示する．
 */
const createCategoryHtml = (categories) => {
  if (!Array.isArray(categories)) {
    return "";
  }

  return categories
    .slice(0, 3)
    .map((category) => {
      return `
        <span class="article-pill">
          ${escapeHtml(category)}
        </span>
      `;
    })
    .join("");
};

/**
 * JSONファイルから記事を取得して表示する．
 */
const loadHatenaArticles = async () => {
  const container = document.getElementById("hatena-articles");

  if (!container) {
    console.error(
      "id=\"hatena-articles\"の要素が見つかりません．",
    );

    return;
  }

  container.setAttribute("aria-busy", "true");

  try {
    /*
     * Date.now()を付けることで，
     * 古いJSONがキャッシュされにくくする．
     */
    const response = await fetch(
      `${ARTICLES_JSON_URL}?t=${Date.now()}`,
      {
        cache: "no-store",
      },
    );

    if (!response.ok) {
      throw new Error(
        `記事データの取得に失敗しました．HTTP Status: ${response.status}`,
      );
    }

    const articles = await response.json();

    if (!Array.isArray(articles)) {
      throw new Error(
        "記事データが配列ではありません．",
      );
    }

    if (articles.length === 0) {
      throw new Error(
        "表示できる記事がありません．",
      );
    }

    container.innerHTML = articles
      .slice(0, DISPLAY_COUNT)
      .map(createArticleHtml)
      .join("");
  } catch (error) {
    console.error(error);

    container.innerHTML = `
      <article class="writeup-card article-error">
        <h3>記事を取得できませんでした</h3>

        <p>
          記事データの読み込みに失敗しました．
          はてなブログは，次のリンクから直接確認できます．
        </p>

        <a
          class="read-more"
          href="https://h-takara.hatenablog.com/"
          target="_blank"
          rel="noopener noreferrer"
        >
          Hatena Blogを開く
        </a>
      </article>
    `;
  } finally {
    container.setAttribute("aria-busy", "false");
  }
};

document.addEventListener(
  "DOMContentLoaded",
  loadHatenaArticles,
);
