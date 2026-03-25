/**
 * 嬉野市議会 — list フェーズ
 *
 * 1. トップページ（/gikai/hokoku/394.html）から年度ページ URL 一覧を取得
 * 2. 対象年度ページから会議別ページ URL 一覧を取得
 * 3. 各会議別ページからテーブル行を解析し、日付と PDF リンクを収集
 *
 * HTML 構造:
 *   - 年度ページ: <a href="/gikai/hokoku/394/_XXXXX.html">令和7年</a>
 *   - 会議別ページ: <a href="/gikai/hokoku/394/_32067/_32074.html">令和7年第1回定例会</a>
 *   - セッションページ: <table> に <tr> があり、2列目に日付、最終列に PDF リンク
 *
 * 除外ルール:
 *   - リンクテキストが「目次」「議決一覧表」「会期日程・議決一覧」を含む PDF は除外
 *   - 日付が取得できない行はスキップ
 */

import {
  BASE_ORIGIN,
  TOP_PAGE_PATH,
  detectMeetingType,
  fetchPage,
  parseEraYear,
  parseYearFromSessionTitle,
  buildDateStr,
} from "./shared";

export interface UreshinoPdfRecord {
  /** 会議タイトル（例: "令和7年第1回定例会 1日目会議録"） */
  title: string;
  /** 開催日 YYYY-MM-DD */
  heldOn: string;
  /** PDF の絶対 URL */
  pdfUrl: string;
  /** 会議種別 */
  meetingType: "plenary" | "extraordinary" | "committee";
  /** 会議別ページの URL パス */
  sessionPagePath: string;
}

export interface YearPageLink {
  year: number;
  url: string;
}

export interface SessionPageLink {
  title: string;
  url: string;
}

/**
 * HTML テキストからタグを取り除く簡易関数。
 */
function stripTags(html: string): string {
  return html
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .trim();
}

/**
 * トップページの HTML から年度ページリンクを抽出する。
 *
 * パターン: <a href="/gikai/hokoku/394/_XXXXX.html">令和7年</a>
 */
export function parseTopPageYearLinks(html: string): YearPageLink[] {
  const links: YearPageLink[] = [];
  const seen = new Set<string>();

  const pattern = /<a\s[^>]*href="(\/gikai\/hokoku\/394\/_\d+\.html)"[^>]*>([\s\S]*?)<\/a>/gi;
  for (const m of html.matchAll(pattern)) {
    const path = m[1]!;
    const text = stripTags(m[2]!);
    const url = `${BASE_ORIGIN}${path}`;

    if (seen.has(url)) continue;

    const year = parseEraYear(text);
    if (year === null) continue;

    seen.add(url);
    links.push({ year, url });
  }

  return links;
}

/**
 * 年度ページの HTML から会議別ページリンクを抽出する。
 *
 * パターン: <a href="/gikai/hokoku/394/_32067/_32074.html">令和7年第1回定例会</a>
 */
export function parseYearPageSessionLinks(html: string, yearPagePath: string): SessionPageLink[] {
  const links: SessionPageLink[] = [];
  const seen = new Set<string>();

  // yearPagePath の例: /gikai/hokoku/394/_32067.html → ベースディレクトリは /gikai/hokoku/394/_32067/
  const yearDirMatch = yearPagePath.match(/^(\/gikai\/hokoku\/394\/_\d+)/);
  if (!yearDirMatch) return links;
  const yearDir = yearDirMatch[1]!;

  // yearDir 配下の _XXXXX.html リンクを抽出
  const pattern = /<a\s[^>]*href="(\/gikai\/hokoku\/394\/_\d+\/_\d+\.html)"[^>]*>([\s\S]*?)<\/a>/gi;
  for (const m of html.matchAll(pattern)) {
    const path = m[1]!;
    const text = stripTags(m[2]!);

    // 当年度ディレクトリ配下のリンクのみ対象
    if (!path.startsWith(yearDir + "/")) continue;

    const url = `${BASE_ORIGIN}${path}`;
    if (seen.has(url)) continue;
    if (!text) continue;

    seen.add(url);
    links.push({ title: text, url });
  }

  return links;
}

/**
 * 会議別ページの HTML からテーブル行を解析し、PDF レコードを収集する。
 *
 * テーブル構造:
 *   - 列1: 日次（第1日、第2日 ...）
 *   - 列2: 月日（2月28日(金) 等）
 *   - 列3: 開議時刻
 *   - 列4: 区分
 *   - 列5: 日程（colspan=2）
 *   - 列6: 会議録（PDF リンク）
 *
 * 除外: リンクテキストに「目次」「議決一覧表」「会期日程」を含む PDF
 */
export function parseSessionPagePdfs(
  html: string,
  sessionTitle: string,
  sessionPagePath: string
): UreshinoPdfRecord[] {
  const records: UreshinoPdfRecord[] = [];

  // セッションタイトルから年を取得
  const year = parseYearFromSessionTitle(sessionTitle);
  if (year === null) return records;

  // テーブル行を抽出
  const trPattern = /<tr[^>]*>([\s\S]*?)<\/tr>/gi;

  for (const trMatch of html.matchAll(trPattern)) {
    const rowHtml = trMatch[1]!;

    // PDF リンクが含まれていない行はスキップ
    if (!rowHtml.includes("/var/rev0/")) continue;

    // 日付を取得（2列目の td から）
    const tdMatches = [...rowHtml.matchAll(/<td[^>]*>([\s\S]*?)<\/td>/gi)];
    if (tdMatches.length < 2) continue;

    // 2列目の td から日付を抽出
    const dateTd = tdMatches[1]!;
    const dateText = stripTags(dateTd[1]!);
    const monthDayMatch = dateText.match(/(\d{1,2}月\d{1,2}日)/);
    if (!monthDayMatch) continue;

    const heldOn = buildDateStr(year, monthDayMatch[1]!);
    if (!heldOn) continue;

    // 最後の td から PDF リンクを抽出
    const lastTd = tdMatches[tdMatches.length - 1]!;
    const lastTdHtml = lastTd[1]!;

    // 個々の PDF リンクを処理
    const pdfLinkPattern = /<a\s[^>]*href="(\/var\/rev0\/[^"]+\.pdf)"[^>]*>([\s\S]*?)<\/a>/gi;
    for (const pdfMatch of lastTdHtml.matchAll(pdfLinkPattern)) {
      const pdfPath = pdfMatch[1]!;
      const linkText = stripTags(pdfMatch[2]!);

      // 目次・議決一覧表・会期日程は除外
      if (
        linkText.includes("目次") ||
        linkText.includes("議決一覧表") ||
        linkText.includes("会期日程") ||
        linkText.includes("議決一覧")
      ) {
        continue;
      }

      const pdfUrl = `${BASE_ORIGIN}${pdfPath}`;
      const fullTitle = `${sessionTitle} ${linkText}`;

      records.push({
        title: fullTitle,
        heldOn,
        pdfUrl,
        meetingType: detectMeetingType(sessionTitle),
        sessionPagePath,
      });
    }
  }

  return records;
}

/**
 * 対象年の全 PDF レコードを収集する。
 *
 * 戦略:
 * 1. トップページから対象年の年度ページ URL を取得
 * 2. 年度ページから会議別ページ URL 一覧を取得
 * 3. 各会議別ページから PDF レコードを抽出
 */
export async function fetchPdfList(
  _baseUrl: string,
  year: number
): Promise<UreshinoPdfRecord[]> {
  // Step 1: トップページから年度ページを取得
  const topUrl = `${BASE_ORIGIN}${TOP_PAGE_PATH}`;
  const topHtml = await fetchPage(topUrl);
  if (!topHtml) return [];

  const yearLinks = parseTopPageYearLinks(topHtml);
  const targetYearLink = yearLinks.find((l) => l.year === year);
  if (!targetYearLink) return [];

  // Step 2: 年度ページから会議別ページを取得
  const yearHtml = await fetchPage(targetYearLink.url);
  if (!yearHtml) return [];

  const yearPagePath = new URL(targetYearLink.url).pathname;
  const sessionLinks = parseYearPageSessionLinks(yearHtml, yearPagePath);

  // Step 3: 各会議別ページから PDF レコードを収集
  const allRecords: UreshinoPdfRecord[] = [];

  for (const sessionLink of sessionLinks) {
    const sessionHtml = await fetchPage(sessionLink.url);
    if (!sessionHtml) continue;

    const sessionPagePath = new URL(sessionLink.url).pathname;
    const records = parseSessionPagePdfs(sessionHtml, sessionLink.title, sessionPagePath);
    allRecords.push(...records);
  }

  return allRecords;
}
