/**
 * 新郷村議会 — list フェーズ
 *
 * 2段階アプローチ:
 * 1. トップページ（#cont の h6 > a）から年度別ページ URL を収集
 * 2. 各年度ページから .pdf リンクを収集
 */

import { BASE_ORIGIN, LIST_URL, fetchPage, parseEraYear } from "./shared";

export interface ShingoMeeting {
  pdfUrl: string;
  title: string;
  year: number;
}

/**
 * 一覧ページの HTML をパースして年度別ページの URL を抽出する。
 *
 * 構造:
 *   <!-- cont -->
 *   <div id="cont">
 *     <h6><a href="https://www.vill.shingo.aomori.jp/page-30802/">令和8年会議録 </a><span ...>New!</span></h6>
 *     ...
 *   </div>
 *   <!-- end cont -->
 */
export function parseYearPageUrls(html: string): { url: string; year: number }[] {
  const results: { url: string; year: number }[] = [];

  // <!-- cont --> ～ <!-- end cont --> のセクションを抽出
  // ネストした div があるため、コメントアンカーを使用する
  const contMatch = html.match(/<!--\s*cont\s*-->([\s\S]*?)<!--\s*end cont\s*-->/i);
  const contHtml = contMatch ? contMatch[1]! : html;

  // h6 タグ内の a リンクを抽出（a タグ後に span 等が続く場合も対応）
  const h6Regex = /<h6[^>]*>([\s\S]*?)<\/h6>/gi;
  for (const h6Match of contHtml.matchAll(h6Regex)) {
    const h6Content = h6Match[1]!;

    // h6 内の a タグから href と テキストを取得
    const aMatch = h6Content.match(/<a[^>]+href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/i);
    if (!aMatch) continue;

    const href = aMatch[1]!.trim();
    const text = aMatch[2]!.replace(/<[^>]+>/g, "").trim();

    // 「会議録」を含むリンクのみ対象
    if (!text.includes("会議録")) continue;

    // 年を抽出
    const year = parseEraYear(text);
    if (!year) continue;

    // URL を構築（絶対 URL でない場合は補完）
    const url = href.startsWith("http")
      ? href
      : `${BASE_ORIGIN}${href.startsWith("/") ? "" : "/"}${href}`;

    results.push({ url, year });
  }

  return results;
}

/**
 * 年度別ページの HTML をパースして PDF リンクと会議情報を抽出する。
 *
 * 年度によって HTML 構造が異なるが、.pdf リンクで一括取得:
 *   - 令和3年: <p><a href="...pdf">タイトル</a><br>
 *   - 令和4〜6年: <p><a href="...pdf">タイトル（PDF）</a></p>
 *   - 令和7〜8年: <li><a href="...pdf">タイトル</a></li>
 */
export function parseYearPage(
  html: string,
  expectedYear: number
): ShingoMeeting[] {
  const results: ShingoMeeting[] = [];

  // <!-- cont --> ～ <!-- end cont --> のセクションを抽出（サイドバー等を除外）
  const contMatch = html.match(/<!--\s*cont\s*-->([\s\S]*?)<!--\s*end cont\s*-->/i);
  const targetHtml = contMatch ? contMatch[1]! : html;

  // .pdf を含む <a> タグを全て取得
  const linkRegex = /<a[^>]+href="([^"]*\.pdf[^"]*)"[^>]*>([\s\S]*?)<\/a>/gi;
  for (const match of targetHtml.matchAll(linkRegex)) {
    const rawHref = match[1]!.trim().replace(/[\s　]+$/, "");
    const rawText = match[2]!.replace(/<[^>]+>/g, "").trim();

    // リンクテキストから不要な文字を除去
    const title = rawText
      .replace(/（PDF）/g, "")
      .replace(/\(PDF\)/gi, "")
      .trim();

    if (!title) continue;

    // 定例会か臨時会を含む場合のみ対象
    if (!title.includes("定例会") && !title.includes("臨時会")) continue;

    // 和暦から年を取得
    const year = parseEraYear(title) ?? expectedYear;

    // URL を構築
    const pdfUrl = rawHref.startsWith("http")
      ? rawHref
      : `${BASE_ORIGIN}${rawHref.startsWith("/") ? "" : "/"}${rawHref}`;

    results.push({ pdfUrl, title, year });
  }

  return results;
}

/**
 * 指定年の会議録一覧を取得する。
 */
export async function fetchMeetingList(
  _baseUrl: string,
  year: number
): Promise<ShingoMeeting[]> {
  // トップページを取得して年度別ページ URL を収集
  const topHtml = await fetchPage(LIST_URL);
  if (!topHtml) return [];

  const yearPages = parseYearPageUrls(topHtml);

  // 指定年に対応するページを探す
  const targetPage = yearPages.find((p) => p.year === year);
  if (!targetPage) return [];

  // 年度別ページを取得して PDF リンクを収集
  const yearHtml = await fetchPage(targetPage.url);
  if (!yearHtml) return [];

  return parseYearPage(yearHtml, year);
}
