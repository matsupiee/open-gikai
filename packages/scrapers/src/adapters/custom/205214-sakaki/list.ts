/**
 * 坂城町議会 -- list フェーズ
 *
 * 会議録一覧ページ (list10.html) から年度別ページの URL を収集し、
 * 各年度別ページから会議録詳細ページの URL を抽出し、
 * さらに各詳細ページから「全ページ一括ダウンロード」PDF リンクを取得する。
 *
 * ページ構造（会議録一覧ページ）:
 *   <ul>
 *     <li><a href="/site/gikai/list10-46.html">令和6年会議録</a></li>
 *     ...
 *   </ul>
 *
 * ページ構造（年度別一覧ページ）:
 *   <ul>
 *     <li><a href="/site/gikai/1478.html">令和6年第1回坂城町議会定例会会議録</a></li>
 *     ...
 *   </ul>
 *
 * ページ構造（会議録詳細ページ）:
 *   <ul>
 *     <li><a href="/uploaded/attachment/2803.pdf">全ページ一括ダウンロード [PDFファイル／1.69MB]</a></li>
 *     ...
 *   </ul>
 */

import {
  BASE_ORIGIN,
  LIST_PAGE_URL,
  detectMeetingType,
  fetchPage,
  parseWarekiYear,
  toHankaku,
  delay,
} from "./shared";

export interface SakakiSessionInfo {
  /** 会議タイトル（例: "令和6年第1回坂城町議会定例会会議録"） */
  title: string;
  /** 西暦年（例: 2024） */
  year: number;
  /** 「全ページ一括ダウンロード」PDF の絶対 URL */
  pdfUrl: string;
  /** 会議種別 */
  meetingType: string;
  /** 会議録詳細ページの絶対 URL */
  detailUrl: string;
  /** 会議を一意に識別するキー（例: "sakaki_2024-1-plenary"） */
  sessionKey: string;
}

/**
 * 会議録一覧ページ HTML から年度別ページのリンクを抽出する（純粋関数）。
 *
 * /site/gikai/list10-{ID}.html のパターンのリンクを収集する。
 */
export function parseYearlyPageLinks(html: string): Array<{
  url: string;
  title: string;
}> {
  const results: Array<{ url: string; title: string }> = [];

  const linkPattern =
    /<a[^>]+href="(\/site\/gikai\/list10-\d+\.html)"[^>]*>([\s\S]*?)<\/a>/gi;
  let m: RegExpExecArray | null;

  while ((m = linkPattern.exec(html)) !== null) {
    const href = m[1]!.trim();
    const title = m[2]!
      .replace(/<[^>]+>/g, "")
      .replace(/&nbsp;/g, " ")
      .replace(/\s+/g, " ")
      .trim();

    const url = `${BASE_ORIGIN}${href}`;
    results.push({ url, title });
  }

  // 重複除去
  const seen = new Set<string>();
  return results.filter(({ url }) => {
    if (seen.has(url)) return false;
    seen.add(url);
    return true;
  });
}

/**
 * 年度別一覧ページ HTML から会議録詳細ページのリンクを抽出する（純粋関数）。
 *
 * /site/gikai/{数字}.html パターンのリンクを収集する。
 */
export function parseDetailPageLinks(html: string): Array<{
  url: string;
  title: string;
}> {
  const results: Array<{ url: string; title: string }> = [];

  const linkPattern =
    /<a[^>]+href="(\/site\/gikai\/\d+\.html)"[^>]*>([\s\S]*?)<\/a>/gi;
  let m: RegExpExecArray | null;

  while ((m = linkPattern.exec(html)) !== null) {
    const href = m[1]!.trim();
    const title = m[2]!
      .replace(/<[^>]+>/g, "")
      .replace(/&nbsp;/g, " ")
      .replace(/\s+/g, " ")
      .trim();

    if (!title) continue;

    const url = `${BASE_ORIGIN}${href}`;
    results.push({ url, title });
  }

  // 重複除去
  const seen = new Set<string>();
  return results.filter(({ url }) => {
    if (seen.has(url)) return false;
    seen.add(url);
    return true;
  });
}

/**
 * 会議録詳細ページ HTML から「全ページ一括ダウンロード」PDF の URL を抽出する（純粋関数）。
 *
 * /uploaded/attachment/{ID}.pdf パターンのリンクのうち、テキストに「全ページ一括」を含むものを返す。
 */
export function parsePdfUrl(html: string): string | null {
  const linkPattern =
    /<a[^>]+href="(\/uploaded\/attachment\/\d+\.pdf)"[^>]*>([\s\S]*?)<\/a>/gi;
  let m: RegExpExecArray | null;

  while ((m = linkPattern.exec(html)) !== null) {
    const href = m[1]!.trim();
    const text = m[2]!
      .replace(/<[^>]+>/g, "")
      .replace(/&nbsp;/g, " ")
      .replace(/\s+/g, " ")
      .trim();

    if (text.includes("全ページ一括")) {
      return `${BASE_ORIGIN}${href}`;
    }
  }

  return null;
}

/**
 * 指定年の全セッション情報を取得する。
 *
 * 1. 会議録一覧ページから年度別ページ URL を収集
 * 2. 対象年度のページのみ取得して詳細ページリンクを抽出
 * 3. 各詳細ページから「全ページ一括」PDF URL を取得
 */
export async function fetchDocumentList(
  year: number
): Promise<SakakiSessionInfo[]> {
  const indexHtml = await fetchPage(LIST_PAGE_URL);
  if (!indexHtml) return [];

  const yearlyLinks = parseYearlyPageLinks(indexHtml);

  const results: SakakiSessionInfo[] = [];

  for (const yearlyLink of yearlyLinks) {
    // タイトルから年度を判定（複数年度にまたがるリンクは取り込む）
    const linkYear = parseWarekiYear(yearlyLink.title);
    if (linkYear !== null && linkYear !== year) continue;
    // "平成30年～令和元年会議録" のようなタイトルは linkYear === null になるため、
    // 年度が判定できない場合でも取り込んで詳細ページで年度フィルタリングする

    const yearlyHtml = await fetchPage(yearlyLink.url);
    if (!yearlyHtml) continue;

    const detailLinks = parseDetailPageLinks(yearlyHtml);

    for (const detailLink of detailLinks) {
      const titleYear = parseWarekiYear(detailLink.title);
      if (titleYear !== null && titleYear !== year) continue;

      await delay(500);

      const detailHtml = await fetchPage(detailLink.url);
      if (!detailHtml) continue;

      const pdfUrl = parsePdfUrl(detailHtml);
      if (!pdfUrl) continue;

      const normalized = toHankaku(detailLink.title);
      const numMatch = normalized.match(/第(\d+)回/);
      const num = numMatch ? numMatch[1]! : String(results.length);
      const meetingType = detectMeetingType(detailLink.title);
      const sessionKey = `sakaki_${year}-${num}-${meetingType}`;

      results.push({
        title: detailLink.title,
        year: titleYear ?? year,
        pdfUrl,
        meetingType,
        detailUrl: detailLink.url,
        sessionKey,
      });
    }
  }

  return results;
}
