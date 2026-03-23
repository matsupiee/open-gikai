/**
 * 芦北町議会 — list フェーズ
 *
 * 3 階層構造を辿って PDF URL を収集する:
 * 1. 会議録トップ → 年度別インデックスリンクを取得
 * 2. 年度別インデックス → 年度別会議録一覧ページ URL を取得
 * 3. 年度別会議録一覧 → PDF リンク（/resource.php?e=...）を抽出
 */

import {
  BASE_ORIGIN,
  detectMeetingType,
  fetchPage,
  toWarekiSlug,
  fromWarekiSlug,
  delay,
} from "./shared";

export interface AshikitaPdfRecord {
  /** 会議タイトル（例: "令和6年第2回定例会会議録"） */
  title: string;
  /** PDF の絶対 URL */
  pdfUrl: string;
  /** 会議種別 */
  meetingType: string;
  /** 開催年（西暦） */
  year: number;
  /** 年度スラッグ（例: "r6"） */
  yearSlug: string;
}

const INTER_PAGE_DELAY_MS = 1500;

/**
 * 会議録トップページから年度別インデックスリンクを抽出する。
 * リンク href に `_kaigiroku` を含むものを取得。
 */
export function parseYearIndexLinks(html: string): { slug: string; url: string }[] {
  const links: { slug: string; url: string }[] = [];
  const seen = new Set<string>();

  const pattern = /href="([^"]*\/([a-z]\d+)_kaigiroku\/?)"[^>]*>/gi;

  let m: RegExpExecArray | null;
  while ((m = pattern.exec(html)) !== null) {
    const path = m[1]!;
    const slug = m[2]!;

    if (seen.has(slug)) continue;
    seen.add(slug);

    const url = path.startsWith("http")
      ? path
      : `${BASE_ORIGIN}${path.startsWith("/") ? "" : "/"}${path}`;

    links.push({ slug, url });
  }

  return links;
}

/**
 * 年度別インデックスページから年度別会議録一覧ページ URL を抽出する。
 * yearSlug ディレクトリ配下の数値 ID ページへのリンクを取得。
 */
export function parseListPageUrl(
  html: string,
  yearSlug: string,
): string | null {
  // yearSlug ディレクトリ配下の数値 ID リンクを探す
  const pattern = new RegExp(
    `href="([^"]*/${yearSlug}_kaigiroku/(\\d+))"`,
    "gi",
  );

  let m: RegExpExecArray | null;
  while ((m = pattern.exec(html)) !== null) {
    const path = m[1]!;
    const url = path.startsWith("http")
      ? path
      : `${BASE_ORIGIN}${path.startsWith("/") ? "" : "/"}${path}`;
    return url;
  }

  return null;
}

/**
 * 年度別会議録一覧ページから PDF リンクを抽出する。
 * /resource.php?e= を含む <a href> を取得。
 */
export function parsePdfLinks(
  html: string,
  yearSlug: string,
): AshikitaPdfRecord[] {
  const records: AshikitaPdfRecord[] = [];
  const year = fromWarekiSlug(yearSlug);
  if (year === null) return records;

  const pattern =
    /<a\s[^>]*href="([^"]*\/resource\.php\?e=[^"]+)"[^>]*>([\s\S]*?)<\/a>/gi;

  let m: RegExpExecArray | null;
  while ((m = pattern.exec(html)) !== null) {
    const path = m[1]!;
    const linkText = m[2]!.replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim();

    if (!linkText) continue;

    // リンクテキストから会議名を抽出（ファイルサイズ情報を除去）
    const title = linkText.replace(/\s*\(PDF\s*[\d,.]+[KMG]?B?\)\s*/i, "").trim();
    if (!title) continue;

    const pdfUrl = path.startsWith("http")
      ? path
      : `${BASE_ORIGIN}${path.startsWith("/") ? "" : "/"}${path}`;

    records.push({
      title,
      pdfUrl,
      meetingType: detectMeetingType(title),
      year,
      yearSlug,
    });
  }

  return records;
}

/**
 * 指定年度の PDF レコード一覧を取得する。
 */
export async function fetchPdfList(year: number): Promise<AshikitaPdfRecord[]> {
  const yearSlug = toWarekiSlug(year);

  // Step 1: 年度別インデックスページを取得
  const indexUrl = `${BASE_ORIGIN}/chosei/gikai/gikairoku/${yearSlug}_kaigiroku/`;
  const indexHtml = await fetchPage(indexUrl);
  if (!indexHtml) return [];

  // Step 2: 年度別会議録一覧ページ URL を取得
  const listPageUrl = parseListPageUrl(indexHtml, yearSlug);
  if (!listPageUrl) {
    // インデックスページ自体に PDF リンクがある場合
    const directRecords = parsePdfLinks(indexHtml, yearSlug);
    if (directRecords.length > 0) return directRecords;
    return [];
  }

  await delay(INTER_PAGE_DELAY_MS);

  // Step 3: 会議録一覧ページから PDF リンクを収集
  const listHtml = await fetchPage(listPageUrl);
  if (!listHtml) return [];

  return parsePdfLinks(listHtml, yearSlug);
}
