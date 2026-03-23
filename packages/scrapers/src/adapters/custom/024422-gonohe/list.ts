/**
 * 五戸町議会 — list フェーズ
 *
 * 2段階で PDF リンクを収集する:
 * 1. 一覧ページ (gikai_kaigiroku.html) から年度別ページ URL を取得
 * 2. 年度別ページから PDF リンクとメタ情報を抽出
 *
 * 年度ページの URL パターンが2種混在:
 * - 令和元年以降: {YYYY}-{MMDD}-{HHMM}-70.html (CMS タイムスタンプ形式)
 * - 平成28年以前: gikai_kaigiroku_H{和暦年}.html
 */

import { BASE_ORIGIN, BASE_PATH, fetchPage, toJapaneseEra } from "./shared";

export interface GonoheMeeting {
  pdfUrl: string;
  title: string;
  heldOn: string;
  section: string;
}

/**
 * 一覧ページ (gikai_kaigiroku.html) から年度別ページのリンクを抽出する。
 *
 * HTML 構造:
 *   <h2 class="main_box_h2"><a href="...">令和7年</a></h2>
 *   <h2 class="main_box_h2"><a href="...">平成28年</a></h2>
 */
export function parseTopPage(
  html: string,
): { label: string; url: string }[] {
  const results: { label: string; url: string }[] = [];

  // h2 内の <a> タグからリンクを取得
  // テキストが <span> でラップされているケースにも対応
  const linkRegex =
    /<h2[^>]*>\s*<a[^>]+href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/g;

  for (const match of html.matchAll(linkRegex)) {
    const href = match[1]!;
    // HTML タグを除去してテキストのみ取得（<span> ラッパー対応）
    const label = match[2]!.replace(/<[^>]+>/g, "").trim();

    let url: string;
    if (href.startsWith("http")) {
      url = href;
    } else if (href.startsWith("/")) {
      url = `${BASE_ORIGIN}${href}`;
    } else {
      // 相対パス (./ や直接ファイル名)
      const cleanHref = href.startsWith("./") ? href.slice(2) : href;
      url = `${BASE_ORIGIN}${BASE_PATH}${cleanHref}`;
    }

    results.push({ label, url });
  }

  return results;
}

/**
 * 和暦の開催日テキストから YYYY-MM-DD を返す。
 * e.g., "令和7年8月28日" → "2025-08-28"
 *       "平成24年3月8日" → "2012-03-08"
 *
 * 「元」年にも対応する。
 */
export function parseDateText(text: string): string | null {
  const match = text.match(/(令和|平成)(元|\d+)年(\d+)月(\d+)日/);
  if (!match) return null;

  const [, era, eraYearStr, monthStr, dayStr] = match;
  const eraYear = eraYearStr === "元" ? 1 : parseInt(eraYearStr!, 10);
  const month = parseInt(monthStr!, 10);
  const day = parseInt(dayStr!, 10);

  let westernYear: number;
  if (era === "令和") westernYear = eraYear + 2018;
  else if (era === "平成") westernYear = eraYear + 1988;
  else return null;

  return `${westernYear}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

/**
 * リンクテキストからメタデータを抽出する。
 *
 * パターン例:
 *   "第1回 定例会　令和7年8月28日"
 *   "第38回 定例会　令和6年1月29日"
 *   "第5回 臨時会　令和5年11月15日"
 *   "第1回 定例会　平成28年12月8日～13日"
 */
export function parseLinkMeta(text: string): {
  session: string;
  meetingKind: string;
  heldOn: string;
} | null {
  const heldOn = parseDateText(text);
  if (!heldOn) return null;

  // 回次
  const sessionMatch = text.match(/第(\d+)回/);
  const session = sessionMatch ? `第${sessionMatch[1]}回` : "";

  // 会議種別
  let meetingKind = "定例会";
  if (text.includes("臨時会")) meetingKind = "臨時会";

  return { session, meetingKind, heldOn };
}

/**
 * 年度別ページの HTML から PDF リンクを抽出する（テスト可能な純粋関数）。
 *
 * HTML 構造:
 *   <p><a href="./gonohe-gikai-kaigiroku18-1.pdf">
 *     第1回 定例会　令和7年8月28日
 *     <img class="wcv_ww_fileicon" alt="PDFファイル">
 *     <span class="wcv_ww_filesize">(300KB)</span>
 *   </a></p>
 */
export function parseYearPage(
  html: string,
  pageUrl: string,
): GonoheMeeting[] {
  const results: GonoheMeeting[] = [];

  // PDF リンクを抽出
  const linkPattern = /<a[^>]+href="([^"]+\.pdf)"[^>]*>([\s\S]*?)<\/a>/gi;

  // pageUrl からベース URL を構築
  const baseUrl = pageUrl.replace(/\/[^/]+$/, "/");

  for (const match of html.matchAll(linkPattern)) {
    const href = match[1]!;
    // HTML タグを除去してテキストのみ取得
    const linkText = match[2]!.replace(/<[^>]+>/g, "").trim();

    const meta = parseLinkMeta(linkText);
    if (!meta) continue;

    // PDF の完全 URL を構築
    let pdfUrl: string;
    if (href.startsWith("http")) {
      pdfUrl = href;
    } else if (href.startsWith("./")) {
      pdfUrl = baseUrl + href.slice(2);
    } else if (href.startsWith("/")) {
      pdfUrl = `${BASE_ORIGIN}${href}`;
    } else {
      pdfUrl = baseUrl + href;
    }

    const title = `${meta.meetingKind} ${meta.session}`;

    results.push({
      pdfUrl,
      title,
      heldOn: meta.heldOn,
      section: meta.meetingKind,
    });
  }

  return results;
}

/**
 * 指定年の全 PDF リンクを取得する。
 */
export async function fetchMeetingList(
  baseUrl: string,
  year: number,
): Promise<GonoheMeeting[]> {
  // Step 1: 一覧ページから年度別ページのリンクを取得
  const topHtml = await fetchPage(baseUrl);
  if (!topHtml) return [];

  const yearPages = parseTopPage(topHtml);
  const eraTexts = toJapaneseEra(year);

  // 対象年度のページを見つける
  const targetPage = yearPages.find((p) =>
    eraTexts.some((era) => p.label.includes(era)),
  );
  if (!targetPage) return [];

  // Step 2: 年度別ページから PDF リンクを抽出
  const yearHtml = await fetchPage(targetPage.url);
  if (!yearHtml) return [];

  return parseYearPage(yearHtml, targetPage.url);
}
