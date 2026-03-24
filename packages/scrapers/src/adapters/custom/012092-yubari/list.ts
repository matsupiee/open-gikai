/**
 * 夕張市議会 会議録 — list フェーズ
 *
 * 会議録一覧ページ → 年度別ページ → PDF リンク収集の 2 段階クロール。
 *
 * URL 構造:
 *   - 会議録一覧: /site/gikai/list13.html
 *   - 年度別ページ: /site/gikai/{ID}.html
 *   - PDF: /uploaded/attachment/{数値ID}.pdf
 *
 * PDF リンクのテキストパターン:
 *   「第1回定例市議会　3月5日」
 *   「行政常任委員会　6月1日」
 */

import {
  BASE_ORIGIN,
  LIST_URL,
  detectMeetingType,
  fetchPage,
  toHalfWidth,
  convertWarekiYear,
} from "./shared";

export interface YubariPdfLink {
  /** 会議タイトル（例: "第1回定例市議会 3月5日"） */
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
 * 会議録一覧ページ (list13.html) から年度別ページの URL を収集する。
 *
 * リンクテキストが和暦年（例: "令和7年"、"平成31・令和元年"）のもののみ収集する。
 */
export function parseListPage(html: string): string[] {
  const urls: string[] = [];
  // リンクテキストに和暦年が含まれているもののみ抽出
  const linkRegex =
    /<a\s[^>]*href="(\/site\/gikai\/(\d+)\.html)"[^>]*>([\s\S]*?)<\/a>/gi;

  for (const match of html.matchAll(linkRegex)) {
    const path = match[1]!;
    const linkText = match[3]!.replace(/<[^>]+>/g, "").trim();

    // リンクテキストが和暦年パターンに合致するもののみ収集
    // 例: "令和7年"、"平成31・令和元年"、"平成30年"
    if (/(令和|平成|昭和)/.test(linkText) && /年/.test(linkText)) {
      const url = `${BASE_ORIGIN}${path}`;
      if (!urls.includes(url)) {
        urls.push(url);
      }
    }
  }

  return urls;
}

/**
 * 年度別ページのタイトルから西暦年を抽出する。
 *
 * パターン: 「令和6年（2024年）」「平成31・令和元年（2019年）」「平成30年（2018年）」
 * 括弧内の西暦を優先して使用する。
 */
export function parseYearFromPageTitle(html: string): number | null {
  // まず括弧内の西暦を試みる（例: 「令和6年（2024年）」）
  const westernMatch = html.match(/[（(](\d{4})年[）)]/);
  if (westernMatch) {
    const year = parseInt(westernMatch[1]!, 10);
    if (!isNaN(year)) return year;
  }

  // 和暦から変換を試みる
  const normalized = toHalfWidth(html);
  const wareki = normalized.match(/(令和|平成|昭和)(元|\d+)年/);
  if (wareki) {
    return convertWarekiYear(wareki[1]!, wareki[2]!);
  }

  return null;
}

/**
 * リンクテキストから会議名と日付をパースする。
 *
 * パターン: 「第1回定例市議会　3月5日」「行政常任委員会　6月1日」「予算審査委員会　3月17日」
 * → meetingName, month, day
 */
export function parseLinkText(
  text: string,
  year: number
): {
  title: string;
  heldOn: string;
  meetingType: string;
} | null {
  // [PDFファイル／304KB] のような注記を除去
  const stripped = text.replace(/\[.*?\]/g, "").trim();
  const normalized = toHalfWidth(stripped.replace(/[\s　]+/g, " ").trim());

  // パターン: {会議名} {M}月{D}日
  const match = normalized.match(/^(.+?)\s+(\d+)月(\d+)日\s*$/);
  if (!match) return null;

  const meetingName = match[1]!.trim();
  const month = parseInt(match[2]!, 10);
  const day = parseInt(match[3]!, 10);

  if (isNaN(month) || isNaN(day)) return null;
  if (month < 1 || month > 12 || day < 1 || day > 31) return null;

  // 夕張市は暦年（1月〜12月）でページが構成されているため、
  // 年度をまたぐ補正は不要。ページの年をそのまま使用する。
  const heldOn = `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;

  const title = `${meetingName} ${month}月${day}日`;
  const meetingType = detectMeetingType(meetingName);

  return { title, heldOn, meetingType };
}

/**
 * 年度別ページから PDF リンクを収集する。
 *
 * h3 見出しで会議種別を分類し、ul > li > a のリストから PDF URL を抽出する。
 * PDF リンクパターン: `/uploaded/attachment/{数値}.pdf`
 */
export function parseYearPage(html: string, year: number): YubariPdfLink[] {
  const results: YubariPdfLink[] = [];

  // PDF リンクを抽出（/uploaded/attachment/{数値}.pdf パターン）
  const pdfLinkRegex =
    /<a\s[^>]*href="(\/uploaded\/attachment\/\d+\.pdf)"[^>]*>([\s\S]*?)<\/a>/gi;

  for (const match of html.matchAll(pdfLinkRegex)) {
    const href = match[1]!;
    const rawText = match[2]!
      .replace(/<[^>]+>/g, "")
      .replace(/&nbsp;/g, " ")
      .replace(/\s+/g, " ")
      .trim();

    const parsed = parseLinkText(rawText, year);
    if (!parsed) continue;

    const pdfUrl = `${BASE_ORIGIN}${href}`;

    results.push({
      title: parsed.title,
      heldOn: parsed.heldOn,
      pdfUrl,
      meetingType: parsed.meetingType,
      year,
    });
  }

  return results;
}

/**
 * 指定年の全 PDF リンクを収集する。
 *
 * 会議録一覧 → 年度別ページ → PDF リンクの順にクロールし、
 * heldOn の年でフィルタリングして返す。
 */
export async function fetchDocumentList(year: number): Promise<YubariPdfLink[]> {
  const listHtml = await fetchPage(LIST_URL);
  if (!listHtml) return [];

  const yearPageUrls = parseListPage(listHtml);
  const allLinks: YubariPdfLink[] = [];

  for (const pageUrl of yearPageUrls) {
    const html = await fetchPage(pageUrl);
    if (!html) continue;

    // ページタイトルから年度を取得
    const titleMatch = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
    const titleText = titleMatch ? titleMatch[1]!.replace(/<[^>]+>/g, "") : "";
    const h1Match = html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i);
    const h1Text = h1Match ? h1Match[1]!.replace(/<[^>]+>/g, "") : "";
    const pageYear = parseYearFromPageTitle(titleText) ?? parseYearFromPageTitle(h1Text) ?? parseYearFromPageTitle(html.slice(0, 2000));

    if (!pageYear) continue;

    const links = parseYearPage(html, pageYear);
    allLinks.push(...links);
  }

  // 指定年のデータのみ返す（開催年でフィルタ）
  return allLinks.filter((link) => {
    const heldOnYear = parseInt(link.heldOn.slice(0, 4), 10);
    return heldOnYear === year;
  });
}
