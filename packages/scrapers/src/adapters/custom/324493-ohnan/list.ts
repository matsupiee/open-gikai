/**
 * 邑南町議会 会議録 — list フェーズ
 *
 * 会議録トップページから年度別ページ URL を取得し、
 * 各年度ページから PDF リンクとメタ情報を収集する。
 *
 * トップページ構造:
 *   <ul class="list00">
 *     <li><a href="/www/contents/{ID}/index.html">令和X年会議録</a></li>
 *   </ul>
 *
 * 年度別ページ構造（令和元年〜）:
 *   <div class="opt-item download-item fixHeight">
 *     <div class="cont">
 *       <ul class="list00">
 *         <li><a href="/www/contents/{ID}/files/{filename}.pdf">リンクテキスト</a></li>
 *       </ul>
 *     </div>
 *   </div>
 *
 * 年度別ページ構造（平成20年〜28年）:
 *   <p><a href="/www/contents/1001000000015/simple/{filename}.pdf">リンクテキスト</a></p>
 */

import {
  BASE_ORIGIN,
  TOP_PAGE_URL,
  fetchPage,
  parseDateFromText,
  toHalfWidth,
} from "./shared";

export interface OhnanMeeting {
  /** PDF の完全 URL */
  pdfUrl: string;
  /** 会議タイトル（例: "令和6年第10回定例会（第5号）"） */
  title: string;
  /** 開催日 YYYY-MM-DD（解析できなければ null） */
  heldOn: string | null;
}

/**
 * 会議録トップページから年度別ページへのリンクを抽出する。
 * /www/contents/{ID}/index.html 形式のリンクを抽出する。
 */
export function parseYearPageLinks(html: string): string[] {
  const urls: string[] = [];
  const linkPattern =
    /<a[^>]+href="(\/www\/contents\/[^"]+\/index\.html)"[^>]*>/gi;

  for (const match of html.matchAll(linkPattern)) {
    const path = match[1]!;
    const fullUrl = `${BASE_ORIGIN}${path}`;
    if (!urls.includes(fullUrl)) {
      urls.push(fullUrl);
    }
  }

  return urls;
}

/**
 * リンクテキストから会議タイトルを正規化する。
 * 末尾の（PDF文書／XXXKB）や（PDF／XXXKB）を除去する。
 */
function normalizeLinkText(text: string): string {
  return text
    .replace(/（PDF文書[／/][^）]*）\s*$/, "")
    .replace(/（PDF[／/][^）]*）\s*$/, "")
    .replace(/\(PDF[^)]*\)\s*$/, "")
    .trim();
}

/**
 * 一般質問事項などスキップすべき PDF を判定する。
 */
function shouldSkipLink(text: string): boolean {
  // 一般質問事項（会議録本文ではない）をスキップ
  if (text.includes("一般質問事項")) return true;
  return false;
}

/**
 * 和暦テキストから年を取得する（年フィルタ用）。
 */
function extractYearFromText(text: string): number | null {
  const normalized = toHalfWidth(text);
  const eraMatch = normalized.match(/(令和|平成)(元|\d+)年/);
  if (!eraMatch) return null;
  const eraYear = eraMatch[2] === "元" ? 1 : parseInt(eraMatch[2]!, 10);
  if (eraMatch[1] === "令和") return eraYear + 2018;
  if (eraMatch[1] === "平成") return eraYear + 1988;
  return null;
}

/**
 * HTML から PDF リンクを抽出する汎用ヘルパー。
 */
function extractPdfLinks(
  html: string,
): Array<{ href: string; rawText: string }> {
  const results: Array<{ href: string; rawText: string }> = [];
  const linkPattern =
    /<a[^>]+href="([^"]*\.pdf)"[^>]*>([\s\S]*?)<\/a>/gi;

  for (const match of html.matchAll(linkPattern)) {
    const href = match[1]!;
    const rawText = match[2]!
      .replace(/<[^>]+>/g, "")
      .replace(/&nbsp;/g, " ")
      .replace(/&amp;/g, "&")
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">")
      .replace(/&quot;/g, '"')
      .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(Number(code)))
      .replace(/\s+/g, " ")
      .trim();

    if (rawText) {
      results.push({ href, rawText });
    }
  }

  return results;
}

/**
 * 年度別ページの HTML から PDF リンクを抽出する。
 *
 * @param html 年度別ページの HTML
 * @param year 対象年（西暦）フィルタ用
 */
export function parseYearPage(html: string, year: number): OhnanMeeting[] {
  const results: OhnanMeeting[] = [];

  // download-item ブロックを探す（令和元年〜のページ形式）
  const downloadItemPattern =
    /<div[^>]+class="[^"]*download-item[^"]*"[^>]*>([\s\S]*?)(?=<div[^>]+class="[^"]*(?:opt-item|section)[^"]*"|<\/div>\s*<\/div>\s*<\/div>)/gi;

  const downloadMatches = Array.from(html.matchAll(downloadItemPattern));

  if (downloadMatches.length > 0) {
    for (const sectionMatch of downloadMatches) {
      const section = sectionMatch[1]!;
      for (const { href, rawText } of extractPdfLinks(section)) {
        if (shouldSkipLink(rawText)) continue;

        const title = normalizeLinkText(rawText);
        const heldOn = parseDateFromText(rawText);

        // 年フィルタ
        const meetingYear = heldOn
          ? parseInt(heldOn.slice(0, 4), 10)
          : extractYearFromText(rawText);

        if (meetingYear !== year) continue;

        const pdfUrl = href.startsWith("http")
          ? href
          : `${BASE_ORIGIN}${href}`;

        if (results.some((r) => r.pdfUrl === pdfUrl)) continue;

        results.push({ pdfUrl, title, heldOn });
      }
    }
  }

  // download-item が見つからない場合、全体から PDF リンクを探す（過去の会議録ページ等）
  if (results.length === 0) {
    for (const { href, rawText } of extractPdfLinks(html)) {
      if (shouldSkipLink(rawText)) continue;

      const title = normalizeLinkText(rawText);
      const heldOn = parseDateFromText(rawText);

      // 年フィルタ
      const meetingYear = heldOn
        ? parseInt(heldOn.slice(0, 4), 10)
        : extractYearFromText(rawText);

      if (meetingYear !== year) continue;

      const pdfUrl = href.startsWith("http")
        ? href
        : `${BASE_ORIGIN}${href}`;

      if (results.some((r) => r.pdfUrl === pdfUrl)) continue;

      results.push({ pdfUrl, title, heldOn });
    }
  }

  return results;
}

/**
 * 指定年の全 PDF リンクを取得する。
 * トップページから年度別ページ URL を収集し、各ページを巡回する。
 */
export async function fetchMeetingList(
  year: number,
): Promise<OhnanMeeting[]> {
  const topHtml = await fetchPage(TOP_PAGE_URL);
  if (!topHtml) return [];

  const yearPageUrls = parseYearPageLinks(topHtml);

  const allMeetings: OhnanMeeting[] = [];

  for (const pageUrl of yearPageUrls) {
    const html = await fetchPage(pageUrl);
    if (!html) continue;

    const meetings = parseYearPage(html, year);
    allMeetings.push(...meetings);
  }

  return allMeetings;
}
