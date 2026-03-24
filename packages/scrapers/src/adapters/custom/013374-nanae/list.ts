/**
 * 七飯町議会 会議録 -- list フェーズ
 *
 * 一覧ページから詳細ページ URL を収集し、各詳細ページから PDF リンクを収集する。
 *
 * URL 構造:
 *   一覧: https://www.town.nanae.hokkaido.jp/hotnews/category/471.html
 *   詳細: https://www.town.nanae.hokkaido.jp/hotnews/detail/{8桁ID}.html
 *   PDF:  https://www.town.nanae.hokkaido.jp/hotnews/files/{上位5桁}00/{8桁ID}/{ファイル名}.pdf
 */

import {
  BASE_ORIGIN,
  LIST_PAGE_URL,
  extractYearFromTitle,
  parseHeldOn,
  fetchPage,
} from "./shared";

export interface NanaeMeeting {
  /** PDF の完全 URL */
  pdfUrl: string;
  /** 会議タイトル（例: "令和6年(2024年)第4回七飯町議会定例会会議録"） */
  title: string;
  /** 開催日 YYYY-MM-DD */
  heldOn: string;
  /** 会議種別（例: "定例会", "臨時会"） */
  meetingType: string;
  /** 詳細ページの URL */
  detailUrl: string;
}

/** 絶対 URL を組み立てる */
function toAbsoluteUrl(href: string): string {
  if (href.startsWith("http://") || href.startsWith("https://")) {
    return href;
  }
  if (href.startsWith("/")) {
    return `${BASE_ORIGIN}${href}`;
  }
  return `${BASE_ORIGIN}/${href}`;
}

/**
 * タイトルテキストから会議種別を推定する。
 */
export function detectMeetingType(title: string): string {
  if (title.includes("委員会")) return "committee";
  if (title.includes("臨時会")) return "extraordinary";
  return "plenary";
}

/**
 * 一覧ページの HTML から詳細ページのリンクとタイトルを抽出する。
 *
 * パターン: <a href="/hotnews/detail/{8桁ID}.html">タイトル</a>
 */
export function parseListPage(html: string): { detailUrl: string; title: string; year: number | null }[] {
  const results: { detailUrl: string; title: string; year: number | null }[] = [];
  const seen = new Set<string>();

  // /hotnews/detail/ へのリンクを抽出
  const linkPattern = /<a\s+href="(\/hotnews\/detail\/\d+\.html)"[^>]*>([^<]+)<\/a>/gi;

  for (const match of html.matchAll(linkPattern)) {
    const href = match[1]!;
    const title = match[2]!.trim();
    const detailUrl = toAbsoluteUrl(href);

    if (seen.has(detailUrl)) continue;
    seen.add(detailUrl);

    const year = extractYearFromTitle(title);
    results.push({ detailUrl, title, year });
  }

  return results;
}

/**
 * 詳細ページの HTML から PDF リンクと開催日を抽出する。
 *
 * 各詳細ページには1つ以上の PDF リンクが含まれる（日ごとに分割）。
 * PDF リンクの前後のテキストから開催日を取得する。
 */
export function parseDetailPage(
  html: string,
  _detailUrl: string,
  title: string,
): { pdfUrl: string; heldOn: string | null; dayTitle: string }[] {
  const results: { pdfUrl: string; heldOn: string | null; dayTitle: string }[] = [];

  // .pdf リンクを抽出
  const pdfPattern = /<a\s+href="([^"]+\.pdf)"[^>]*>([^<]*)<\/a>/gi;

  for (const match of html.matchAll(pdfPattern)) {
    const href = match[1]!;
    const linkText = match[2]!.trim();
    const pdfUrl = toAbsoluteUrl(href);

    // PDF リンクの前方のテキストから開催日を探す
    const linkIndex = match.index ?? 0;
    const surrounding = html.substring(Math.max(0, linkIndex - 500), linkIndex);

    // 和暦パターンを探す（直近のものを使用）
    const dateMatches = [
      ...surrounding.matchAll(/(令和|平成)(元|\d+)年\d+月\d+日/g),
    ];
    let heldOn: string | null = null;
    if (dateMatches.length > 0) {
      const lastDate = dateMatches[dateMatches.length - 1]![0];
      heldOn = parseHeldOn(lastDate);
    }

    // 日付のみのタイトルテキストが得られる場合はそれを使う
    const dayTitle = linkText || title;

    results.push({ pdfUrl, heldOn, dayTitle });
  }

  return results;
}

/**
 * 指定年の会議録 PDF リンクを取得する。
 *
 * 1. 一覧ページから全詳細ページリンクを取得
 * 2. 指定年でフィルタ
 * 3. 各詳細ページから PDF リンクを収集
 */
export async function fetchMeetingList(year: number): Promise<NanaeMeeting[]> {
  const listHtml = await fetchPage(LIST_PAGE_URL);
  if (!listHtml) return [];

  const listEntries = parseListPage(listHtml);
  const targetEntries = listEntries.filter((e) => e.year === year);

  const results: NanaeMeeting[] = [];

  for (const entry of targetEntries) {
    const detailHtml = await fetchPage(entry.detailUrl);
    if (!detailHtml) continue;

    const pdfItems = parseDetailPage(detailHtml, entry.detailUrl, entry.title);

    for (const item of pdfItems) {
      if (!item.heldOn) continue;

      results.push({
        pdfUrl: item.pdfUrl,
        title: entry.title,
        heldOn: item.heldOn,
        meetingType: detectMeetingType(entry.title),
        detailUrl: entry.detailUrl,
      });
    }
  }

  return results;
}
