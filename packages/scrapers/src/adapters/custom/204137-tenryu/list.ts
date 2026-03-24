/**
 * 天龍村議会 — list フェーズ
 *
 * 議会カテゴリページから「議会活動記録」リンクを収集し、
 * 各ページの PDF URL を取得する。
 *
 * 一覧ページ: https://www.vill-tenryu.jp/category/notice/administrative/government_info/parliament/
 *
 * 対象: 「議会活動記録」を含むリンクのみ（定例議会・臨時議会・議会だよりは除外）
 */

import { BASE_ORIGIN, LIST_URL, eraToWesternYear, fetchPage } from "./shared";

export interface TenryuActivityRecord {
  pdfUrl: string;
  title: string;
  heldOn: string;
  sourceUrl: string;
}

/**
 * リンクテキストが議会活動記録かどうかを判定する。
 */
export function isActivityRecord(text: string): boolean {
  return text.includes("議会活動記録");
}

/**
 * リンクテキストから年月を抽出する。
 * e.g., "令和７年２月天龍村議会活動記録" → { year: 2025, month: 2 }
 */
export function parseTitleDate(title: string): {
  year: number;
  month: number;
} | null {
  // 全角数字を半角に変換してから解析する
  const normalized = title.replace(/[０-９]/g, (c) =>
    String.fromCharCode(c.charCodeAt(0) - 0xff10 + 0x30)
  );
  const match = normalized.match(/(令和|平成)(元|\d+)年(\d+)月/);
  if (!match) return null;

  const year = eraToWesternYear(match[1]!, match[2]!);
  if (!year) return null;

  return { year, month: Number(match[3]) };
}

/**
 * 一覧ページの HTML をパースして議会活動記録リンクを返す（テスト可能な純粋関数）。
 */
export function parseListPage(html: string): Array<{
  articleUrl: string;
  title: string;
}> {
  const results: Array<{ articleUrl: string; title: string }> = [];

  // <a> タグのリンクを収集
  const linkPattern = /<a[^>]+href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/gi;

  for (const match of html.matchAll(linkPattern)) {
    const href = match[1]!;
    const rawText = match[2]!.replace(/<[^>]+>/g, "").trim();

    if (!isActivityRecord(rawText)) continue;

    // 絶対 URL に変換
    let articleUrl: string;
    if (href.startsWith("http")) {
      articleUrl = href;
    } else if (href.startsWith("//")) {
      articleUrl = `https:${href}`;
    } else if (href.startsWith("/")) {
      articleUrl = `${BASE_ORIGIN}${href}`;
    } else {
      articleUrl = `${BASE_ORIGIN}/${href}`;
    }

    results.push({ articleUrl, title: rawText });
  }

  return results;
}

/**
 * 個別記事ページの HTML から PDF URL を抽出する（テスト可能な純粋関数）。
 */
export function parseDetailPage(html: string): string | null {
  // .pdf で終わる href を探す
  const pdfPattern = /<a[^>]+href="([^"]*\.pdf)"[^>]*>/gi;

  for (const match of html.matchAll(pdfPattern)) {
    const href = match[1]!;

    // WordPress の wp-content/uploads パスを優先
    if (href.includes("wp-content/uploads")) {
      if (href.startsWith("http")) return href;
      if (href.startsWith("/")) return `${BASE_ORIGIN}${href}`;
      return href;
    }
  }

  // wp-content/uploads 以外の PDF も許容
  const allPdf = html.match(/<a[^>]+href="([^"]*\.pdf)"[^>]*>/i);
  if (allPdf) {
    const href = allPdf[1]!;
    if (href.startsWith("http")) return href;
    if (href.startsWith("/")) return `${BASE_ORIGIN}${href}`;
    return href;
  }

  return null;
}

/**
 * heldOn 文字列を YYYY-MM-DD 形式で組み立てる（日は 01 固定）。
 */
export function buildHeldOn(year: number, month: number): string {
  const m = String(month).padStart(2, "0");
  return `${year}-${m}-01`;
}

/**
 * タイトルの年月でフィルタリングする。
 */
export function filterByYear(
  items: TenryuActivityRecord[],
  year: number
): TenryuActivityRecord[] {
  return items.filter((item) => item.heldOn.startsWith(`${year}-`));
}

/**
 * 一覧ページを取得して指定年の議会活動記録一覧を返す。
 */
export async function fetchMeetingList(
  year: number
): Promise<TenryuActivityRecord[]> {
  const html = await fetchPage(LIST_URL);
  if (!html) return [];

  const links = parseListPage(html);
  const results: TenryuActivityRecord[] = [];

  for (const { articleUrl, title } of links) {
    const dateInfo = parseTitleDate(title);
    if (!dateInfo) continue;

    // 指定年でない場合はスキップ（早期フィルタリング）
    if (dateInfo.year !== year) continue;

    // 個別ページを取得して PDF URL を取得
    const detailHtml = await fetchPage(articleUrl);
    if (!detailHtml) continue;

    const pdfUrl = parseDetailPage(detailHtml);
    if (!pdfUrl) continue;

    results.push({
      pdfUrl,
      title,
      heldOn: buildHeldOn(dateInfo.year, dateInfo.month),
      sourceUrl: articleUrl,
    });
  }

  return results;
}
