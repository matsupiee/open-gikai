/**
 * 白川村議会 — list フェーズ
 *
 * 議会トップページ（https://www.vill.shirakawa.lg.jp/1098.htm）と
 * ページネーション（pfromid を 4 ずつ増加）から /secure/ 配下の PDF リンクを収集する。
 *
 * 注意:
 *   - 発言全文の会議録は公開されていない（日程・議案・一般質問通告・議会だよりのみ）。
 *   - ippan（一般質問通告）と nittei（議事運営日程）から開催日・会議名を推定する。
 *   - fetchDetail は発言データなしのため null を返す。
 *
 * HTML 構造（推定）:
 *   <a href="/secure/{ID}/{ファイル名}.pdf">リンクテキスト</a>
 *   ページネーション: <a href="/dd.aspx?moduleid=2797&pfromid={n}">次の一覧へ</a>
 */

import {
  BASE_ORIGIN,
  classifyPdfKind,
  detectMeetingType,
  extractYearFromText,
  fetchPage,
  parseDateText,
} from "./shared";

export interface ShirakawaVillagePdfLink {
  pdfUrl: string;
  linkText: string;
  kind: "nittei" | "gian" | "ippan" | "gikai" | "other";
  /** リンクテキストから推定した開催年（西暦）。null の場合は年不明 */
  year: number | null;
  /** リンクテキストから推定した開催日（YYYY-MM-DD）。null の場合は日付不明 */
  heldOn: string | null;
  /** リンクテキストから推定した会議名 */
  title: string;
  /** 会議タイプ ("plenary" | "extraordinary") */
  meetingType: string;
}

/**
 * HTML ページから /secure/ 配下の PDF リンクを抽出する（テスト可能な純粋関数）。
 */
export function parsePageLinks(html: string): ShirakawaVillagePdfLink[] {
  const results: ShirakawaVillagePdfLink[] = [];

  const linkPattern =
    /<a[^>]+href="([^"]*\/secure\/[^"]+\.pdf)"[^>]*>([\s\S]*?)<\/a>/gi;

  for (const match of html.matchAll(linkPattern)) {
    const href = match[1]!;
    const rawText = match[2]!.replace(/<[^>]+>/g, "").trim();

    if (!rawText) continue;

    const pdfUrl = href.startsWith("http")
      ? href
      : `${BASE_ORIGIN}${href.startsWith("/") ? "" : "/"}${href}`;

    // ファイル名を URL から取得して種別判定
    const filenameMatch = pdfUrl.match(/\/([^/]+)\.pdf$/i);
    const filename = filenameMatch ? filenameMatch[1]! : "";
    const kind = classifyPdfKind(filename);

    const year = extractYearFromText(rawText);
    const heldOn = parseDateText(rawText);

    // タイトルを構成（括弧内のサイズ情報を除去）
    const title = rawText
      .replace(/\(\d+KB\)/g, "")
      .replace(/\(\d+\.\d+MB\)/g, "")
      .replace(/\s+/g, " ")
      .trim();

    const meetingType = detectMeetingType(title);

    results.push({ pdfUrl, linkText: rawText, kind, year, heldOn, title, meetingType });
  }

  return results;
}

/**
 * HTML から次のページの pfromid を取得する。
 * 「次の一覧へ」リンクが存在しない場合は null を返す。
 */
export function extractNextPfromId(html: string): number | null {
  // 「次の一覧へ」のリンクを探す
  const nextPattern =
    /href="[^"]*moduleid=2797[^"]*pfromid=(\d+)"[^>]*>(?:[\s\S]*?次[\s\S]*?一覧[\s\S]*?)<\/a>/i;
  const match = html.match(nextPattern);
  if (match) return Number(match[1]!);
  return null;
}

/**
 * 全ページを巡回して指定年の PDF リンクを収集する。
 */
export async function fetchDocumentList(
  baseUrl: string,
  year: number
): Promise<ShirakawaVillagePdfLink[]> {
  const allLinks: ShirakawaVillagePdfLink[] = [];
  const visitedUrls = new Set<string>();

  // 最初のページ
  const firstHtml = await fetchPage(baseUrl);
  if (!firstHtml) return [];

  const firstLinks = parsePageLinks(firstHtml);
  for (const link of firstLinks) {
    if (link.year === year || link.year === null) {
      allLinks.push(link);
    }
  }

  visitedUrls.add(baseUrl);

  // ページネーション（moduleid=2797 ページを pfromid=4, 8, 12... と巡回）
  // 最大 50 ページまで（= pfromid 200 まで）巡回
  const BASE_PAGINATE_URL = `${BASE_ORIGIN}/dd.aspx?moduleid=2797&pfromid=`;
  for (let pfromid = 4; pfromid <= 200; pfromid += 4) {
    const pageUrl = `${BASE_PAGINATE_URL}${pfromid}`;
    if (visitedUrls.has(pageUrl)) break;
    visitedUrls.add(pageUrl);

    const html = await fetchPage(pageUrl);
    if (!html) break;

    const links = parsePageLinks(html);

    // このページに対象年のリンクがなく、かつ前年のリンクも多くある場合は打ち切り
    const yearLinks = links.filter((l) => l.year === year || l.year === null);
    for (const link of yearLinks) {
      allLinks.push(link);
    }

    // 次ページが存在するかチェック（「次の一覧へ」リンク）
    const nextPfromId = extractNextPfromId(html);
    if (!nextPfromId) break;
    if (nextPfromId <= pfromid) break; // 無限ループ防止
  }

  // 年が確定しているリンクのみ返す（kind が other 以外を優先するが全部返す）
  return allLinks.filter((l) => l.year === year);
}
