/**
 * 垂井町議会 — list フェーズ
 *
 * 年度別ページから PDF リンクを収集する。
 *
 * HTML 構造（定義リスト形式）:
 *   <dl>
 *     <dt>第5回定例会</dt>
 *     <dd><a href="/uploaded/attachment/{ID}.pdf">目次 [PDFファイル／76KB]</a></dd>
 *     <dd><a href="/uploaded/attachment/{ID}.pdf">会議録　12月3日（水曜日） [PDFファイル／255KB]</a></dd>
 *   </dl>
 */

import {
  BASE_ORIGIN,
  buildYearPageUrl,
  fetchPage,
  parseDateText,
} from "./shared";

export interface TaruiMeeting {
  pdfUrl: string;
  title: string;
  heldOn: string;
  sessionTitle: string;
}

/**
 * dl 要素内のすべての dt/dd タグとその内容を順序付きで抽出する。
 * 各要素は { tag: "dt" | "dd", content: string } の形式で返す。
 */
function parseDlChildren(dlHtml: string): { tag: "dt" | "dd"; content: string }[] {
  const results: { tag: "dt" | "dd"; content: string }[] = [];
  const pattern = /<(dt|dd)[^>]*>([\s\S]*?)<\/\1>/gi;

  for (const match of dlHtml.matchAll(pattern)) {
    const tag = match[1]!.toLowerCase() as "dt" | "dd";
    const content = match[2]!;
    results.push({ tag, content });
  }

  return results;
}

/**
 * 年度別ページの HTML から PDF リンクを抽出する（テスト可能な純粋関数）。
 *
 * - dl/dt に会議名、dt 直後の dd 群に PDF リンクが並ぶ
 * - 目次 PDF（アンカーテキストに「目次」を含むもの）はスキップ
 * - /uploaded/attachment/ を含む PDF リンクのみ処理対象
 * - yearFilter が指定された場合、そのグレゴリオ暦年の会議録のみ返す
 */
export function parseYearPage(
  html: string,
  yearFilter?: number
): TaruiMeeting[] {
  const results: TaruiMeeting[] = [];

  // dl 要素をすべて抽出
  const dlPattern = /<dl[^>]*>([\s\S]*?)<\/dl>/gi;

  for (const dlMatch of html.matchAll(dlPattern)) {
    const dlHtml = dlMatch[1]!;
    const children = parseDlChildren(dlHtml);

    let currentSessionTitle = "";

    for (const child of children) {
      if (child.tag === "dt") {
        currentSessionTitle = child.content.replace(/<[^>]+>/g, "").trim();
        continue;
      }

      // dd の処理
      if (!currentSessionTitle) continue;

      // アンカーを抽出
      const aMatch = child.content.match(/<a[^>]+href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/i);
      if (!aMatch) continue;

      const href = aMatch[1]!;
      if (!href.includes("/uploaded/attachment/")) continue;

      const linkText = aMatch[2]!.replace(/<[^>]+>/g, "").trim();

      // 目次 PDF をスキップ
      if (linkText.includes("目次")) continue;

      // アンカーテキストから開催日を抽出
      const heldOn = parseDateText(linkText);
      if (!heldOn) continue;

      // 年フィルター
      if (yearFilter !== undefined) {
        const heldYear = parseInt(heldOn.substring(0, 4), 10);
        if (heldYear !== yearFilter) continue;
      }

      const pdfUrl = href.startsWith("http")
        ? href
        : href.startsWith("/")
          ? `${BASE_ORIGIN}${href}`
          : `${BASE_ORIGIN}/${href}`;

      results.push({
        pdfUrl,
        title: currentSessionTitle,
        heldOn,
        sessionTitle: currentSessionTitle,
      });
    }
  }

  return results;
}

/**
 * 指定年の全 PDF リンクを取得する。
 */
export async function fetchMeetingList(year: number): Promise<TaruiMeeting[]> {
  const yearPageUrl = buildYearPageUrl(year);
  if (!yearPageUrl) return [];

  const html = await fetchPage(yearPageUrl);
  if (!html) return [];

  return parseYearPage(html, year);
}
