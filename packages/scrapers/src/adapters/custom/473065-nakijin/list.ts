/**
 * 今帰仁村議会 会議録 — list フェーズ
 *
 * 議事録トップページ → 年度別一覧ページ → PDF リンク の順に辿る。
 *
 * ページ構造:
 *   トップ: <a href="/pagtop/kakuka/gikai/2/2/2/gijiroku/{id}.html">令和X年...</a>
 *   年度別: <a href="//www.nakijin.jp/material/files/group/1/{name}.pdf">...</a>
 *           または /material/files/group/1/{name}.pdf
 *
 * スキップ対象: 目次・通告書、会期日程・議決結果
 */

import {
  BASE_ORIGIN,
  TOP_PAGE_URL,
  GIJIROKU_PATH_PREFIX,
  fetchPage,
  detectMeetingType,
  parseEraYear,
  parseEraDate,
} from "./shared";

export interface NakijinMeeting {
  /** PDF ファイルの完全 URL */
  fileUrl: string;
  /** 会議タイトル（リンクテキスト） */
  title: string;
  /** 西暦年（例: 2024）。解析できない場合は null */
  year: number | null;
  /** 開催日（YYYY-MM-DD 形式）。解析できない場合は null */
  heldOn: string | null;
  /** 会議タイプ */
  meetingType: string;
  /** 年度別一覧ページ URL */
  sourcePageUrl: string;
}

/** スキップ対象のリンクテキストパターン */
const SKIP_PATTERNS = [/目次/, /通告書/, /通告/, /会期日程/, /議決/, /mokujitou/, /kaikinittei/];

/**
 * リンクテキストから開催日を抽出する。
 * PDF ファイル名や HTML リンクテキストから日付を取得。
 */
function extractHeldOn(title: string, pdfUrl: string, year: number | null): string | null {
  // タイトルに和暦日付が含まれる場合
  const eraDate = parseEraDate(title);
  if (eraDate) return eraDate;

  if (!year) return null;

  // タイトルに「M月D日」パターン
  const shortDate = title.match(/(\d+)月(\d+)日/);
  if (shortDate) {
    const month = shortDate[1]!.padStart(2, "0");
    const day = shortDate[2]!.padStart(2, "0");
    return `${year}-${month}-${day}`;
  }

  // PDF ファイル名から日付を抽出
  // reiwa6nendai1kaiteireikai0305.pdf → 0305 → 03月05日
  const filenameMMDD = pdfUrl.match(/(\d{4})\.pdf$/i);
  if (filenameMMDD) {
    const mmdd = filenameMMDD[1]!;
    const month = mmdd.slice(0, 2);
    const day = mmdd.slice(2, 4);
    const monthNum = parseInt(month, 10);
    const dayNum = parseInt(day, 10);
    if (monthNum >= 1 && monthNum <= 12 && dayNum >= 1 && dayNum <= 31) {
      return `${year}-${month}-${day}`;
    }
  }

  // R2-1kaiteireikai309.pdf → 309 → 3月9日
  const filenameMMD = pdfUrl.match(/(\d{3})\.pdf$/i);
  if (filenameMMD) {
    const mmd = filenameMMD[1]!;
    const month = mmd.slice(0, 1).padStart(2, "0");
    const day = mmd.slice(1, 3).padStart(2, "0");
    const monthNum = parseInt(month, 10);
    const dayNum = parseInt(day, 10);
    if (monthNum >= 1 && monthNum <= 12 && dayNum >= 1 && dayNum <= 31) {
      return `${year}-${month}-${day}`;
    }
  }

  return null;
}

/**
 * 年度別一覧ページの HTML から PDF リンクを抽出する（純粋関数）。
 */
export function parseYearPage(
  html: string,
  pageUrl: string,
  year: number | null,
): NakijinMeeting[] {
  const results: NakijinMeeting[] = [];

  // PDF リンクを収集 (//www.nakijin.jp/material/... や /material/... パターン)
  const pdfPattern = /<a[^>]+href="([^"]*(?:material\/files|\.pdf)[^"]*)"[^>]*>([\s\S]*?)<\/a>/gi;

  for (const m of html.matchAll(pdfPattern)) {
    const href = m[1]!;
    const rawTitle = m[2]!.replace(/<[^>]+>/g, "").trim();

    // PDF リンクのみ対象
    if (!href.toLowerCase().endsWith(".pdf")) continue;

    // スキップ対象を除外
    if (SKIP_PATTERNS.some((p) => p.test(rawTitle) || p.test(href))) continue;

    // URL を絶対パスに変換
    let fileUrl: string;
    if (href.startsWith("//")) {
      fileUrl = `https:${href}`;
    } else if (href.startsWith("http")) {
      fileUrl = href;
    } else {
      fileUrl = new URL(href, BASE_ORIGIN).toString();
    }

    const title = rawTitle || href.split("/").pop() || href;
    const heldOn = extractHeldOn(title, fileUrl, year);

    results.push({
      fileUrl,
      title,
      year,
      heldOn,
      meetingType: detectMeetingType(title),
      sourcePageUrl: pageUrl,
    });
  }

  return results;
}

/**
 * トップページの HTML から年度別一覧ページへのリンクを抽出する（純粋関数）。
 */
export function parseTopPage(html: string): Array<{ url: string; year: number | null }> {
  const results: Array<{ url: string; year: number | null }> = [];

  // 全 <a> タグを収集し、gijiroku 配下へのリンクのみ対象
  const linkPattern = /<a[^>]+href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/gi;

  for (const m of html.matchAll(linkPattern)) {
    const href = m[1]!;
    const text = m[2]!.replace(/<[^>]+>/g, "").trim();

    // 年度別一覧ページへのリンクのみ対象
    if (!href.includes(GIJIROKU_PATH_PREFIX)) continue;

    const url = href.startsWith("http") ? href : `${BASE_ORIGIN}${href}`;
    const year = parseEraYear(text);

    results.push({ url, year });
  }

  return results;
}

/**
 * 年度から西暦年に対応する和暦年テキストを生成してフィルタに使う。
 * 例: 2024 → "令和6年", 2019 → "令和元年" or "令和1年"
 */
function yearMatchesPage(pageYear: number | null, targetYear: number): boolean {
  if (pageYear === null) return false;
  return pageYear === targetYear;
}

/**
 * 議事録トップページから全 PDF リンクを取得し、指定年でフィルタする。
 */
export async function fetchDocumentList(
  _baseUrl: string,
  year: number,
): Promise<NakijinMeeting[]> {
  const topHtml = await fetchPage(TOP_PAGE_URL);
  if (!topHtml) {
    console.warn(`[473065-nakijin] Failed to fetch top page: ${TOP_PAGE_URL}`);
    return [];
  }

  const yearPages = parseTopPage(topHtml);

  // 指定年に対応するページのみ取得
  const targetPages = yearPages.filter((p) => yearMatchesPage(p.year, year));

  if (targetPages.length === 0) {
    console.warn(`[473065-nakijin] No year page found for year=${year}`);
    return [];
  }

  const allMeetings: NakijinMeeting[] = [];

  for (const page of targetPages) {
    const html = await fetchPage(page.url);
    if (!html) {
      console.warn(`[473065-nakijin] Failed to fetch year page: ${page.url}`);
      continue;
    }

    const meetings = parseYearPage(html, page.url, page.year);
    allMeetings.push(...meetings);
  }

  return allMeetings;
}
