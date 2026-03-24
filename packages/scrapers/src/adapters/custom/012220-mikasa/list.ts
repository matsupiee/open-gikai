/**
 * 三笠市議会 会議録 — list フェーズ
 *
 * カテゴリトップページ → 年度別詳細ページ → PDF リンク収集の 2 段階クロール。
 *
 * URL 構造:
 *   - カテゴリトップ: /hotnews/category/307.html
 *   - 年度別詳細: /assembly/detail/{ID}.html
 *   - PDF: /hotnews/files/{上位ID}/{詳細ページID}/{YYYYMMDDHHmmss}.pdf
 *
 * PDF リンクのテキストパターン:
 *   「会議録 令和7年 第4回定例会 12月18日」
 */

import {
  BASE_ORIGIN,
  CATEGORY_URL,
  detectMeetingType,
  fetchPage,
  toHalfWidth,
  convertWarekiYear,
} from "./shared";

export interface MikasaPdfLink {
  /** 会議タイトル（例: "第4回定例会 12月18日"） */
  title: string;
  /** 開催日 YYYY-MM-DD */
  heldOn: string;
  /** PDF の絶対 URL */
  pdfUrl: string;
  /** 会議種別 */
  meetingType: string;
  /** 西暦年 */
  year: number;
}

/**
 * PDF リンクのテキストから会議情報をパースする。
 *
 * パターン: 「会議録 令和7年 第4回定例会 12月18日」
 * → year=2025, session=4, type=定例会, month=12, day=18
 */
export function parsePdfLinkText(
  text: string
): {
  title: string;
  heldOn: string;
  year: number;
  meetingType: string;
} | null {
  const normalized = toHalfWidth(text.replace(/\s+/g, " ").trim());

  // パターン: 会議録 {令和|平成}{元|\d+}年 第{N}回{定例会|臨時会} {M}月{D}日
  const match = normalized.match(
    /会議録\s+(令和|平成)(元|\d+)年\s+第(\d+)回(定例会|臨時会)\s+(\d+)月(\d+)日/
  );
  if (!match) return null;

  const era = match[1]!;
  const eraYearStr = match[2]!;
  const sessionNum = match[3]!;
  const meetingKind = match[4]!;
  const month = parseInt(match[5]!, 10);
  const day = parseInt(match[6]!, 10);

  const westernYear = convertWarekiYear(era, eraYearStr);
  if (!westernYear) return null;

  const heldOn = `${westernYear}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
  const title = `第${sessionNum}回${meetingKind} ${month}月${day}日`;
  const meetingType = detectMeetingType(meetingKind);

  return { title, heldOn, year: westernYear, meetingType };
}

/**
 * カテゴリトップページから年度別詳細ページの URL を収集する。
 *
 * リンクパターン: `/assembly/detail/{ID}.html`
 */
export function parseCategoryPage(html: string): string[] {
  const urls: string[] = [];
  const linkRegex = /href="(\/assembly\/detail\/\d+\.html)"/gi;

  for (const match of html.matchAll(linkRegex)) {
    const path = match[1]!;
    const url = `${BASE_ORIGIN}${path}`;
    if (!urls.includes(url)) {
      urls.push(url);
    }
  }

  return urls;
}

/**
 * 年度別詳細ページから PDF リンクを収集する。
 *
 * PDF リンクパターン: `/hotnews/files/{上位ID}/{詳細ページID}/{タイムスタンプ}.pdf`
 */
export function parseYearDetailPage(html: string): MikasaPdfLink[] {
  const results: MikasaPdfLink[] = [];

  // PDF リンクを抽出
  const pdfLinkRegex =
    /<a\s[^>]*href="(\/hotnews\/files\/[^"]*\.pdf)"[^>]*>([\s\S]*?)<\/a>/gi;

  for (const match of html.matchAll(pdfLinkRegex)) {
    const href = match[1]!;
    const rawText = match[2]!
      .replace(/<[^>]+>/g, "")
      .replace(/&nbsp;/g, " ")
      .replace(/\s+/g, " ")
      .trim();

    const parsed = parsePdfLinkText(rawText);
    if (!parsed) continue;

    const pdfUrl = `${BASE_ORIGIN}${href}`;

    results.push({
      title: parsed.title,
      heldOn: parsed.heldOn,
      pdfUrl,
      meetingType: parsed.meetingType,
      year: parsed.year,
    });
  }

  return results;
}

/**
 * 指定年の全 PDF リンクを収集する。
 *
 * カテゴリトップ → 年度別詳細ページ → PDF リンクの順にクロールし、
 * heldOn の年でフィルタリングして返す。
 */
export async function fetchDocumentList(year: number): Promise<MikasaPdfLink[]> {
  const categoryHtml = await fetchPage(CATEGORY_URL);
  if (!categoryHtml) return [];

  const yearPageUrls = parseCategoryPage(categoryHtml);
  const allLinks: MikasaPdfLink[] = [];

  for (const pageUrl of yearPageUrls) {
    const html = await fetchPage(pageUrl);
    if (!html) continue;

    const links = parseYearDetailPage(html);
    allLinks.push(...links);
  }

  // 指定年のデータのみ返す（暦年: 1月〜12月）
  return allLinks.filter((link) => link.year === year);
}
