/**
 * 多良木町議会 会議録 — list フェーズ
 *
 * 一覧ページから全詳細ページ URL を収集し、
 * 各詳細ページから会議録 PDF URL と開催日を取得する。
 *
 * 構造:
 *   一覧ページ (gikaikaigiroku/index.html)
 *   └── <a href="/gyousei/soshiki/gikai/gikaikaigiroku/{ID}.html">タイトル</a>
 *
 *   詳細ページ ({ID}.html)
 *   └── <a href="/material/files/group/12/{ファイル名}.pdf">PDF</a>
 */

import {
  BASE_ORIGIN,
  LIST_URL,
  buildExternalId,
  buildHeldOnFromYearMonth,
  detectMeetingType,
  extractDetailId,
  extractMonthFromTitle,
  extractYearFromTitle,
  fetchPage,
} from "./shared";

export interface TaragiMeeting {
  /** 詳細ページ ID (e.g., "3720") */
  detailId: string;
  /** 会議タイトル (e.g., "令和6年度第5回多良木町議会（12月定例会議）") */
  title: string;
  /** 会議録 PDF の絶対 URL */
  pdfUrl: string;
  /** 開催日 YYYY-MM-DD (日は不明なため月初 01 日とする) */
  heldOn: string;
  /** 詳細ページ URL */
  detailUrl: string;
  /** externalId */
  externalId: string;
  /** 会議種別 */
  meetingType: "plenary" | "committee" | "extraordinary";
}

/**
 * 一覧ページ HTML から詳細ページへのリンクを抽出する。
 * /gikaikaigiroku/ を含む <a href> を収集し、index.html は除外する。
 */
export function parseListPage(html: string): { detailUrl: string; title: string }[] {
  const results: { detailUrl: string; title: string }[] = [];

  const linkRegex = /<a[^>]+href="([^"]*\/gikaikaigiroku\/(?!index)[^"]*)"[^>]*>([^<]+)<\/a>/gi;

  for (const match of html.matchAll(linkRegex)) {
    const href = match[1]!;
    const title = match[2]!.trim();
    if (!title) continue;

    const detailUrl = href.startsWith("http")
      ? href
      : `${BASE_ORIGIN}${href.startsWith("/") ? "" : "/"}${href}`;

    // 重複チェック
    if (results.some((r) => r.detailUrl === detailUrl)) continue;

    results.push({ detailUrl, title });
  }

  return results;
}

/**
 * 詳細ページ HTML から会議録 PDF URL を抽出する。
 * /material/files/group/12/ を含む <a href> を収集する。
 * pdfUrls[0] は会議日程 PDF、pdfUrls[1] は会議録 PDF（通常）。
 */
export function parseDetailPage(html: string): { pdfUrls: string[] } {
  const pdfUrls: string[] = [];

  const pdfRegex = /<a[^>]+href="([^"]*\/material\/files\/group\/12\/[^"]*\.pdf)"[^>]*>/gi;

  for (const match of html.matchAll(pdfRegex)) {
    const href = match[1]!;
    const url = href.startsWith("http")
      ? href
      : `${BASE_ORIGIN}${href.startsWith("/") ? "" : "/"}${href}`;

    if (!pdfUrls.includes(url)) {
      pdfUrls.push(url);
    }
  }

  return { pdfUrls };
}

/**
 * 指定年の全会議録一覧を取得する。
 * 年フィルタリング: タイトルから西暦年を抽出して対象年と照合する。
 */
export async function fetchMeetingList(year: number): Promise<TaragiMeeting[]> {
  const listHtml = await fetchPage(LIST_URL);
  if (!listHtml) return [];

  const allLinks = parseListPage(listHtml);

  // 年でフィルタ（開催月の西暦年）
  const filtered = allLinks.filter((link) => {
    const titleYear = extractYearFromTitle(link.title);
    return titleYear === year;
  });

  const meetings: TaragiMeeting[] = [];

  for (const link of filtered) {
    const detailId = extractDetailId(link.detailUrl);
    if (!detailId) continue;

    const detailHtml = await fetchPage(link.detailUrl);
    if (!detailHtml) continue;

    const { pdfUrls } = parseDetailPage(detailHtml);

    // 会議録 PDF は2番目（index 1）、なければ最初の PDF を使う
    const pdfUrl = pdfUrls[1] ?? pdfUrls[0];
    if (!pdfUrl) continue;

    const titleYear = extractYearFromTitle(link.title);
    const month = extractMonthFromTitle(link.title);
    if (!titleYear || !month) continue;

    const heldOn = buildHeldOnFromYearMonth(titleYear, month);

    meetings.push({
      detailId,
      title: link.title,
      pdfUrl,
      heldOn,
      detailUrl: link.detailUrl,
      externalId: buildExternalId(detailId),
      meetingType: detectMeetingType(link.title),
    });

    // レート制限: 自治体サイトのため 1 秒待機
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }

  return meetings;
}
