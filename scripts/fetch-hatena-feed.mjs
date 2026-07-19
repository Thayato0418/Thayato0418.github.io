import fs from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { XMLParser } from "fast-xml-parser";

/*
 * 取得対象となるはてなブログのRSS URL．
 */
const FEED_URL =
  "https://h-takara.hatenablog.com/rss";

/*
 * JSONの出力先．
 */
const OUTPUT_PATH = path.resolve(
  process.cwd(),
  "data",
  "hatena-articles.json",
);

/*
 * JSONへ保存する最大記事数．
 * Webサイトで実際に表示する件数とは別の設定．
 */
const MAX_ARTICLES = 12;

/*
 * 記事概要の最大文字数．
 */
const DESCRIPTION_LENGTH = 140;

const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: "@_",
  processEntities: false,
});

/**
 * 1件だけの場合と複数件の場合の違いを吸収する．
 */
const normalizeArray = (value) => {
  if (value === undefined || value === null) {
    return [];
  }

  return Array.isArray(value) ? value : [value];
};

/**
 * XML要素から文字列を取り出す．
 */
const getTextValue = (value) => {
  if (typeof value === "string") {
    return value;
  }

  if (
    value &&
    typeof value === "object" &&
    typeof value["#text"] === "string"
  ) {
    return value["#text"];
  }

  return "";
};

/**
 * HTML内の最初のimg要素から画像URLを取得する．
 *
 * 記事本文そのものはJSONへ保存せず，
 * 画像URLだけを取り出す．
 */
const extractFirstImageUrl = (html = "") => {
  const source = getTextValue(html);

  if (!source) {
    return "";
  }

  const match = source.match(
    /<img[^>]+src=["']([^"']+)["'][^>]*>/i,
  );

  return match?.[1] ?? "";
};

/**
 * RSSの記事情報からサムネイルURLを取得する．
 *
 * 優先順位：
 * 1．media:thumbnail
 * 2．media:content
 * 3．enclosure
 * 4．記事本文内の最初の画像
 */
const getThumbnailUrl = (item) => {
  const mediaThumbnail =
    item["media:thumbnail"]?.["@_url"];

  if (mediaThumbnail) {
    return String(mediaThumbnail);
  }

  const mediaContent =
    item["media:content"]?.["@_url"];

  if (mediaContent) {
    return String(mediaContent);
  }

  const enclosure = item.enclosure;

  if (
    enclosure?.["@_url"] &&
    String(enclosure?.["@_type"] ?? "").startsWith("image/")
  ) {
    return String(enclosure["@_url"]);
  }

  const contentEncodedImage =
    extractFirstImageUrl(item["content:encoded"]);

  if (contentEncodedImage) {
    return contentEncodedImage;
  }

  return extractFirstImageUrl(item.description);
};

/**
 * RSSの記事概要からHTMLタグを取り除く．
 */
const stripHtml = (value = "") => {
  return String(value)
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, " ")
    .trim();
};

/**
 * 記事概要を指定文字数に短縮する．
 */
const shortenText = (text, maxLength) => {
  if (text.length <= maxLength) {
    return text;
  }

  return `${text.slice(0, maxLength)}…`;
};

/**
 * RSSからカテゴリーを取り出す．
 */
const getCategories = (item) => {
  return normalizeArray(item.category)
    .map((category) => {
      if (typeof category === "string") {
        return category;
      }

      return category?.["#text"] ?? "";
    })
    .filter(Boolean);
};

/**
 * RSSを取得し，JSONへ変換する．
 */
const main = async () => {
  console.log("はてなブログのRSSを取得します．");
  console.log(`取得先: ${FEED_URL}`);

  const response = await fetch(FEED_URL, {
    headers: {
      "User-Agent":
        "h-takara-profile-feed-fetcher/1.0",
      Accept:
        "application/rss+xml, application/xml, text/xml",
    },
  });

  if (!response.ok) {
    throw new Error(
      `RSSの取得に失敗しました．HTTP Status: ${response.status} ${response.statusText}`,
    );
  }

  const xml = await response.text();
  const parsedFeed = parser.parse(xml);

  const items = normalizeArray(
    parsedFeed?.rss?.channel?.item,
  );

  if (items.length === 0) {
    throw new Error(
      "RSSから記事を取得できませんでした．",
    );
  }

const articles = items
  .slice(0, MAX_ARTICLES)
  .map((item) => ({
    title: String(
      item.title ?? "無題の記事",
    ),
    url: String(
      item.link ?? "",
    ),
    publishedAt: String(
      item.pubDate ?? "",
    ),
    thumbnailUrl: getThumbnailUrl(item),
  }));
  await fs.mkdir(path.dirname(OUTPUT_PATH), {
    recursive: true,
  });

  await fs.writeFile(
    OUTPUT_PATH,
    `${JSON.stringify(articles, null, 2)}\n`,
    "utf8",
  );

  console.log(
    `${articles.length}件の記事を書き出しました．`,
  );

  console.log(`出力先: ${OUTPUT_PATH}`);
};

main().catch((error) => {
  console.error("処理中にエラーが発生しました．");
  console.error(error);
  process.exitCode = 1;
});
