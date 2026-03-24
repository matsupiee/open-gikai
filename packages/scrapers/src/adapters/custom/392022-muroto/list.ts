/**
 * 室戸市議会 — list フェーズ
 *
 * 年別ページから PDF リンクとメタ情報を抽出する。
 *
 * ページ構造:
 * - 各年別ページ（/pages/page{ID}.php）に PDF リンクが掲載されている
 * - PDF リンクの相対パス: ../pbfile/m{ID}/pbf*.pdf
 * - リンクテキストに会議名・ファイル種別が記載される
 *   例: 「第１回定例会　第１号」「第２回臨時会　目次」等
 *
 * フィルタリング:
 * - 「第N号」を含むリンク（会議録本文）のみを対象とする
 * - 目次・会期日程・一般質問順序・資料・議決結果一覧表は除外
 */

import { BASE_ORIGIN, buildYearPageUrl, eraToWesternYear, fetchPage } from "./shared";

export interface MurotoMeeting {
  pdfUrl: string;
  title: string;
  section: string;
  pageId: string;
}

/**
 * リンクテキストが会議録本文（第N号）かどうかを判定する。
 * 目次・日程・通告・資料・議決結果は除外する。
 */
function isMeetingRecord(linkText: string): boolean {
  // 除外パターン
  if (linkText.includes("目次")) return false;
  if (linkText.includes("日程")) return false;
  if (linkText.includes("通告")) return false;
  if (linkText.includes("資料")) return false;
  if (linkText.includes("議決")) return false;
  if (linkText.includes("順序")) return false;

  // 「第N号」を含むことが条件
  return /第\s*[\d０-９一二三四五六七八九十]+\s*号/.test(linkText);
}

/**
 * リンクテキストから会議名（セクション）を抽出する。
 * e.g., "第１回定例会　第１号" → "第１回 定例会"
 * e.g., "第３回臨時会 第１号" → "第３回 臨時会"
 */
function extractSection(linkText: string): string {
  const match = linkText.match(/第\s*([\d０-９一二三四五六七八九十]+)\s*回\s*(定例会|臨時会)/);
  if (!match) return linkText.replace(/\s+/g, " ").trim();
  return `第${match[1]}回 ${match[2]}`;
}

/**
 * PDF URL からページ ID を取得する。
 * e.g., "/pbfile/m003221/pbf..." → "3221"
 */
function extractPageIdFromUrl(url: string): string {
  const match = url.match(/\/m0*(\d+)\//);
  return match ? match[1]! : "";
}

/**
 * 年別ページの HTML から PDF リンクとメタ情報を抽出する（テスト可能な純粋関数）。
 *
 * 抽出条件:
 * - href が .pdf で終わるリンク
 * - リンクテキストに「第N号」を含む（会議録本文）
 * - 目次・日程・通告・資料・議決は除外
 */
export function parseYearPage(
  html: string,
  pageUrl: string
): MurotoMeeting[] {
  const results: MurotoMeeting[] = [];

  // a[href*=".pdf"] を抽出（相対パスも含む）
  const linkPattern = /<a[^>]+href="([^"]*\.pdf)"[^>]*>([\s\S]*?)<\/a>/gi;

  for (const match of html.matchAll(linkPattern)) {
    const href = match[1]!;
    const linkHtml = match[2]!;
    const linkText = linkHtml
      .replace(/<[^>]+>/g, "")
      .replace(/&nbsp;/g, " ")
      .replace(/&amp;/g, "&")
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">")
      .replace(/[\s　]+/g, " ")
      .trim();

    // 会議録本文のみ対象
    if (!isMeetingRecord(linkText)) continue;

    // PDF URL を構築
    let pdfUrl: string;
    if (href.startsWith("http")) {
      pdfUrl = href;
    } else if (href.startsWith("/")) {
      pdfUrl = `${BASE_ORIGIN}${href}`;
    } else if (href.startsWith("../")) {
      pdfUrl = `${BASE_ORIGIN}/${href.replace(/^(\.\.\/)+/, "")}`;
    } else {
      const base = pageUrl.replace(/\/[^/]+$/, "/");
      pdfUrl = base + href;
    }

    const section = extractSection(linkText);
    const pageId = extractPageIdFromUrl(pdfUrl);
    const title = linkText.replace(/\s+/g, " ").trim();

    results.push({ pdfUrl, title, section, pageId });
  }

  return results;
}

/** 全角数字を半角数字に変換する */
function normalizeDigits(s: string): string {
  return s.replace(/[０-９]/g, (c) => String(String.fromCharCode(c.charCodeAt(0) - 0xFF10 + 0x30)));
}

/**
 * PDF テキストの冒頭から開催日（YYYY-MM-DD）を抽出する。
 *
 * 会議録の冒頭パターン:
 *   令和７年２月　室戸市議会第１回臨時会会議録（第１号）
 *
 * 日付は通常 PDF 本文中の「令和X年X月X日」から取得するが、
 * 見つからない場合は null を返す。
 * 全角数字（２月２５日 等）にも対応する。
 */
export function parseMeetingDateFromText(text: string): string | null {
  // 全角数字を半角に変換してから検索する
  const normalized = normalizeDigits(text.replace(/[\s　]+/g, " ")).trim();

  // 「令和X年X月X日」または「平成X年X月X日」パターン
  const eraMatch = normalized.match(/(令和|平成)(元|\d+)年(\d+)月(\d+)日/);
  if (eraMatch) {
    const [, era, eraYearStr, monthStr, dayStr] = eraMatch;
    const westernYear = eraToWesternYear(era!, eraYearStr!);
    if (!westernYear) return null;
    const month = parseInt(monthStr!, 10);
    const day = parseInt(dayStr!, 10);
    return `${westernYear}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
  }

  return null;
}

/**
 * PDF テキストの冒頭から会議のタイトルを抽出する。
 *
 * 例: "令和７年２月　室戸市議会第１回臨時会会議録（第１号）" → "第1回 臨時会 第1号"
 */
export function parseMeetingTitleFromText(text: string): string | null {
  const normalized = text.replace(/[\s　]+/g, " ").substring(0, 200);

  const titleMatch = normalized.match(
    /第\s*([\d０-９一二三四五六七八九十]+)\s*回\s*(定例会|臨時会).*?（?第\s*([\d０-９一二三四五六七八九十]+)\s*号）?/
  );
  if (titleMatch) {
    const session = titleMatch[1]!;
    const type = titleMatch[2]!;
    const number = titleMatch[3]!;
    return `第${session}回 ${type} 第${number}号`;
  }

  return null;
}

/**
 * 指定年の全 PDF リンクを取得する。
 */
export async function fetchMeetingList(
  year: number
): Promise<MurotoMeeting[]> {
  const yearPageUrl = buildYearPageUrl(year);
  if (!yearPageUrl) return [];

  const html = await fetchPage(yearPageUrl);
  if (!html) return [];

  return parseYearPage(html, yearPageUrl);
}
