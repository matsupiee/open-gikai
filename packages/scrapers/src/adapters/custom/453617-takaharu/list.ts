/**
 * 高原町議会 — list フェーズ
 *
 * バックナンバーページ（296447.html）から全年度の PDF リンクを一括収集する。
 * 単一ページに全年度分が掲載されているためページネーション不要。
 *
 * HTML 構造:
 *   <a href="/uploaded/attachment/{ID}.pdf">令和X年　第X回定例会会議録 [PDFファイル／...]</a>
 *
 * リンクテキストのパターン:
 *   "令和6年　第1回定例会会議録 [PDFファイル／ファイルサイズ]"
 *   "令和5年　第1回臨時会会議録 [PDFファイル／ファイルサイズ]"
 */

import {
  BASE_ORIGIN,
  LIST_PAGE_URL,
  buildEraTitle,
  eraToWesternYear,
  fetchPage,
  normalizeFullWidth,
} from "./shared";

export interface TakaharuMeeting {
  pdfUrl: string;
  title: string;
  /** YYYY-01-01 形式（日付が特定できないため年の最初の日を使用） */
  heldOn: string;
  meetingKind: string;
  year: number;
  session: number;
}

/**
 * リンクテキストから会議情報を解析する。
 *
 * テキスト例:
 *   "令和6年　第1回定例会会議録 [PDFファイル／...]" → { year: 2024, session: 1, kind: "定例会" }
 *   "令和5年　第1回臨時会会議録 [PDFファイル／...]" → { year: 2023, session: 1, kind: "臨時会" }
 */
export function parseLinkText(text: string): {
  year: number;
  session: number;
  meetingKind: string;
} | null {
  // 全角数字を正規化
  const normalized = normalizeFullWidth(text);

  const match = normalized.match(
    /(令和|平成)(元|\d+)年[\s　]*第(\d+)回(定例会|臨時会)/,
  );
  if (!match) return null;

  const era = match[1]!;
  const yearStr = match[2]!;
  const session = parseInt(match[3]!, 10);
  const meetingKind = match[4]!;

  const year = eraToWesternYear(era, yearStr);

  return { year, session, meetingKind };
}

/**
 * バックナンバーページの HTML から PDF リンクを抽出する。
 *
 * - 指定年の PDF のみ抽出（year が指定されている場合）
 * - year が null の場合は全件返す
 */
export function parseListPage(
  html: string,
  year: number | null,
): TakaharuMeeting[] {
  const results: TakaharuMeeting[] = [];

  // PDF リンクを抽出
  const linkRegex =
    /<a\s[^>]*href="([^"]*\/uploaded\/attachment\/[^"]*\.pdf)"[^>]*>([\s\S]*?)<\/a>/gi;

  for (const match of html.matchAll(linkRegex)) {
    const href = match[1]!;
    const rawText = match[2]!
      .replace(/<[^>]+>/g, "")
      .replace(/\s+/g, " ")
      .trim();

    const info = parseLinkText(rawText);
    if (!info) continue;

    // 年フィルタリング
    if (year !== null && info.year !== year) continue;

    // PDF の絶対 URL を構築
    let pdfUrl: string;
    if (href.startsWith("http")) {
      pdfUrl = href;
    } else if (href.startsWith("//")) {
      pdfUrl = `https:${href}`;
    } else if (href.startsWith("/")) {
      pdfUrl = `${BASE_ORIGIN}${href}`;
    } else {
      pdfUrl = `${BASE_ORIGIN}/${href}`;
    }

    // タイトルを生成: "令和6年第1回定例会"
    const eraTitle = buildEraTitle(info.year);
    const title = `${eraTitle}第${info.session}回${info.meetingKind}`;

    // heldOn: 日付不明のため年初（YYYY-01-01）を使用
    const heldOn = `${info.year}-01-01`;

    results.push({
      pdfUrl,
      title,
      heldOn,
      meetingKind: info.meetingKind,
      year: info.year,
      session: info.session,
    });
  }

  // session 昇順でソート
  results.sort((a, b) => {
    if (a.year !== b.year) return a.year - b.year;
    return a.session - b.session;
  });

  return results;
}

/**
 * バックナンバーページから指定年の全 PDF リンクを取得する。
 */
export async function fetchMeetingList(
  year: number,
): Promise<TakaharuMeeting[]> {
  const html = await fetchPage(LIST_PAGE_URL);
  if (!html) return [];

  return parseListPage(html, year);
}
