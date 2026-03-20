/**
 * dbsearch 詳細ページの HTML 構造を確認するデバッグスクリプト
 */

const DETAIL_URL =
  "https://www.town.otofuke.hokkaido.dbsr.jp/index.php/276207?Template=document&Id=1673";
const USER_AGENT =
  "open-gikai-bot/1.0 (https://github.com/matsupiee/open-gikai; contact: please see github)";

const res = await fetch(DETAIL_URL, { headers: { "User-Agent": USER_AGENT } });
const html = await res.text();

// voice__text の有無
const voiceTextIdx = html.indexOf("voice__text");
console.log("voice__text found:", voiceTextIdx >= 0);

// voice-block の内容
const voiceBlockIdx = html.indexOf("voice-block");
if (voiceBlockIdx >= 0) {
  console.log("\n--- voice-block 周辺 500 文字 ---");
  console.log(html.slice(voiceBlockIdx - 20, voiceBlockIdx + 500));
}

// page-list 周辺（発言本文エリア）
const pageListIdx = html.indexOf("page-list");
if (pageListIdx >= 0) {
  console.log("\n--- page-list 周辺 2000 文字 ---");
  console.log(html.slice(pageListIdx, pageListIdx + 2000));
}

// content-main 周辺
const contentMainIdx = html.indexOf("content-main");
if (contentMainIdx >= 0) {
  console.log("\n--- content-main 周辺 3000 文字 ---");
  console.log(html.slice(contentMainIdx, contentMainIdx + 3000));
}

// fetch/ajax/axios の有無（動的ロード確認）
const hasAjax = html.includes("XMLHttpRequest") || html.includes("axios") || html.includes("fetch(");
console.log("\nAJAX/fetch references:", hasAjax);

// API エンドポイントっぽい文字列を探す
const apiMatches = [...html.matchAll(/["']([^"']*(?:api|voice|json)[^"']*)['"]/gi)]
  .map((m) => m[1])
  .filter((s) => s.startsWith("/") || s.startsWith("http"));
console.log("API-like strings:", [...new Set(apiMatches)].slice(0, 10));
