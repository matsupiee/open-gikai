/**
 * 中央区議会 会議録検索システム — 一覧取得
 *
 * POST index.cgi に term=date&sel_year=NN で年ごとの会議一覧を取得し、
 * 各会議録ページへのリンクを返す。
 *
 * 年の値は平成年号ベースの連番 (sel_year = western_year - 1988)。
 */

import { fetchListPage, buildDetailUrl } from "./shared";

export interface ChuoMeetingRecord {
  /** 会議録ページの絶対URL */
  url: string;
  /** リンクテキスト（例: "令和7年第四回定例会会議録（第3日　11月25日）"） */
  title: string;
  /** YYYY-MM-DD 形式の開催日（抽出できた場合） */
  heldOn: string | null;
}

/**
 * 指定年の会議録一覧を取得する。
 */
export async function fetchDocumentList(
  baseUrl: string,
  year: number,
): Promise<ChuoMeetingRecord[]> {
  const html = await fetchListPage(baseUrl, year);
  if (!html) return [];

  const origin = new URL(baseUrl).origin;
  return parseListPage(html, origin, year);
}

/**
 * 一覧ページの HTML からリンクを抽出する。
 * 目次（mokuji）リンクはスキップする。
 */
export function parseListPage(
  html: string,
  origin: string,
  year: number,
): ChuoMeetingRecord[] {
  const records: ChuoMeetingRecord[] = [];
  const seen = new Set<string>();

  const linkPattern =
    /<a\s+href="([^"]*kaigiroku\.cgi[^"]*\.html)"[^>]*>([^<]+)<\/a>/gi;

  let match;
  while ((match = linkPattern.exec(html)) !== null) {
    const rawHref = match[1] ?? "";
    const title = (match[2] ?? "").trim();

    // 目次（mokuji）はスキップ
    if (rawHref.includes("mokuji")) continue;

    const url = buildDetailUrl(rawHref, origin);
    if (seen.has(url)) continue;
    seen.add(url);

    const heldOn = extractDateFromTitle(title, year);
    records.push({ url, title, heldOn });
  }

  return records;
}

/**
 * タイトルテキストから開催日を抽出する。
 *
 * パターン:
 *   - "令和7年第四回定例会会議録（第3日　11月25日）" → 2025-11-25
 *   - "令和7年　決算特別委員会(第11日　10月16日)" → 2025-10-16
 *   - "令和7年　議会運営委員会(10月16日)" → 2025-10-16
 */
export function extractDateFromTitle(
  title: string,
  year: number,
): string | null {
  const m = title.match(/(\d{1,2})月(\d{1,2})日/);
  if (!m?.[1] || !m[2]) return null;

  const month = parseInt(m[1], 10);
  const day = parseInt(m[2], 10);

  if (month < 1 || month > 12 || day < 1 || day > 31) return null;

  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}
