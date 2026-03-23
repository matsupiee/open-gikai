/**
 * 富良野市議会 — list フェーズ
 *
 * 3段階で PDF リンクを収集する:
 * 1. 一覧ページ（ページネーション含む）から詳細ページ URL を取得
 * 2. 詳細ページから会議録 PDF リンクとメタ情報を抽出
 *
 * 一覧ページ構造:
 *   <li class="page"><a href="/shigikai/docs/{ID}.html">令和○年 第○回定例会 会議録 (YYYY年MM月DD日)</a></li>
 *
 * 詳細ページ構造:
 *   <h2>令和○年第○回富良野市議会定例会(会期○月○日から○月○日)</h2>
 *   <h3>会議録</h3>
 *   <p><a class="icon-pdf" href="/fs/...pdf">令和○年第○回定例会 会議録 第1号(令和○年○月○日) (PDF XXX KB)</a></p>
 */

import { BASE_ORIGIN, fetchPage, toJapaneseEra } from "./shared";

export interface FuranoMeeting {
  pdfUrl: string;
  title: string;
  heldOn: string;
  sessionTitle: string;
}

/**
 * 一覧ページから詳細ページへのリンクを抽出する。
 * 各リンクのテキスト（例: "令和7年 第2回定例会 会議録"）と URL を返す。
 */
export function parseListPage(
  html: string
): { label: string; url: string }[] {
  const results: { label: string; url: string }[] = [];

  // <li class="page"><a href="/shigikai/docs/{ID}.html">...（内部に span/time タグを含む）...</a></li>
  const linkRegex =
    /<li\s+class="page">\s*<a\s+href="(\/shigikai\/docs\/[^"]+\.html)"[^>]*>([\s\S]*?)<\/a>/g;

  for (const match of html.matchAll(linkRegex)) {
    const href = match[1]!;
    // HTML タグを除去してプレーンテキストを取得
    const label = match[2]!.replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim();

    const url = `${BASE_ORIGIN}${href}`;
    results.push({ label, url });
  }

  return results;
}

/**
 * 一覧ページのリンクテキストから年を特定する。
 * e.g., "令和7年 第2回定例会 会議録 (2025年6月10日)" → 和暦の年
 */
function matchesYear(label: string, eraTexts: string[]): boolean {
  return eraTexts.some((era) => label.includes(era));
}

/**
 * 和暦の日付テキストから YYYY-MM-DD を返す。
 * e.g., "令和7年6月10日" → "2025-06-10"
 */
export function parseDateText(text: string): string | null {
  const match = text.match(/(令和|平成)(\d+)年(\d+)月(\d+)日/);
  if (!match) return null;

  const [, era, eraYearStr, monthStr, dayStr] = match;
  const eraYear = parseInt(eraYearStr!, 10);
  const month = parseInt(monthStr!, 10);
  const day = parseInt(dayStr!, 10);

  let westernYear: number;
  if (era === "令和") westernYear = eraYear + 2018;
  else if (era === "平成") westernYear = eraYear + 1988;
  else return null;

  return `${westernYear}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

/**
 * 詳細ページの HTML から会議録 PDF リンクを抽出する（テスト可能な純粋関数）。
 *
 * 構造:
 * - <h2>令和○年第○回富良野市議会定例会(会期○月○日から○月○日)</h2> で会議名
 * - <h3>会議録</h3> の後に PDF リンク
 * - <a class="icon-pdf" href="/fs/...pdf">...第1号(令和○年○月○日) (PDF XXX KB)</a>
 *
 * 会議録セクション内の PDF のみ抽出し、意見書・調査報告書等はスキップする。
 */
export function parseDetailPage(
  html: string
): FuranoMeeting[] {
  const results: FuranoMeeting[] = [];

  // 会議名を <h2> から抽出
  const h2Match = html.match(
    /<h2>([^<]*(?:定例会|臨時会)[^<]*)<\/h2>/
  );
  const sessionTitle = h2Match
    ? h2Match[1]!.replace(/\(会期[^)]+\)/, "").replace(/（会期[^）]+）/, "").trim()
    : "";

  // <h3>会議録</h3> セクションの位置を特定
  const gijirokuH3 = html.indexOf("<h3>会議録</h3>");
  if (gijirokuH3 === -1) return results;

  // 次の <h3> までの範囲を取得
  const nextH3 = html.indexOf("<h3>", gijirokuH3 + 10);
  const sectionHtml =
    nextH3 === -1
      ? html.slice(gijirokuH3)
      : html.slice(gijirokuH3, nextH3);

  // PDF リンクを抽出
  const linkPattern =
    /<a[^>]+href="([^"]+\.pdf)"[^>]*>([^<]+)<\/a>/gi;

  for (const match of sectionHtml.matchAll(linkPattern)) {
    const href = match[1]!;
    const linkText = match[2]!.trim();

    // 日付を抽出 — 第N号(令和○年○月○日) パターン
    const heldOn = parseDateText(linkText);
    if (!heldOn) continue; // 目次など日付のないリンクはスキップ

    // PDF の完全 URL を構築
    const pdfUrl = href.startsWith("http")
      ? href
      : `${BASE_ORIGIN}${href.startsWith("/") ? "" : "/"}${href}`;

    // タイトル: リンクテキストから PDF サイズ情報を除去
    const cleanLinkText = linkText
      .replace(/\s*\(PDF\s+[^)]+\)/, "")
      .replace(/\s*（PDF\s+[^）]+）/, "")
      .trim();

    results.push({
      pdfUrl,
      title: cleanLinkText,
      heldOn,
      sessionTitle,
    });
  }

  return results;
}

/**
 * 一覧ページのページネーションを辿って全ページの HTML を取得する。
 */
async function fetchAllListPages(baseUrl: string): Promise<string[]> {
  const pages: string[] = [];

  // 1ページ目
  const firstPage = await fetchPage(baseUrl);
  if (!firstPage) return pages;
  pages.push(firstPage);

  // ページネーションリンクを探す（index.p{N}.html）
  const pagePattern = /index\.p(\d+)\.html/g;
  const pageNumbers = new Set<number>();
  for (const match of firstPage.matchAll(pagePattern)) {
    pageNumbers.add(parseInt(match[1]!, 10));
  }

  // 追加ページを取得
  const sortedPages = [...pageNumbers].sort((a, b) => a - b);
  for (const pageNum of sortedPages) {
    const pageUrl = baseUrl.replace(/\/?$/, "").replace(/\/index\.html$/, "") + `/index.p${pageNum}.html`;
    const html = await fetchPage(pageUrl);
    if (html) pages.push(html);
  }

  return pages;
}

/**
 * 指定年の全 PDF リンクを取得する。
 */
export async function fetchMeetingList(
  baseUrl: string,
  year: number
): Promise<FuranoMeeting[]> {
  const eraTexts = toJapaneseEra(year);
  const allMeetings: FuranoMeeting[] = [];

  // Step 1: 全一覧ページをクロール
  const listPages = await fetchAllListPages(baseUrl);

  // Step 2: 各一覧ページから対象年の詳細ページ URL を収集
  const detailUrls: { label: string; url: string }[] = [];
  for (const html of listPages) {
    const links = parseListPage(html);
    for (const link of links) {
      if (matchesYear(link.label, eraTexts)) {
        detailUrls.push(link);
      }
    }
  }

  // Step 3: 各詳細ページから PDF リンクを抽出
  const seenPdfUrls = new Set<string>();
  for (const { url } of detailUrls) {
    const detailHtml = await fetchPage(url);
    if (!detailHtml) continue;

    const meetings = parseDetailPage(detailHtml);
    for (const m of meetings) {
      if (!seenPdfUrls.has(m.pdfUrl)) {
        seenPdfUrls.add(m.pdfUrl);
        allMeetings.push(m);
      }
    }
  }

  return allMeetings;
}
