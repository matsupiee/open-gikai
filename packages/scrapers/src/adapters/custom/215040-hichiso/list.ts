/**
 * 七宗町議会 — list フェーズ
 *
 * 単一の一覧ページから PDF リンクを収集する。
 * PDF ファイル名の命名規則: {和暦}年{月}月{会議種別}.pdf
 * 例: 令和7年12月定例会.pdf
 */

import { BASE_ORIGIN, fetchPage, toJapaneseEra } from "./shared";

export interface HichisoMeeting {
  pdfUrl: string;
  title: string;
  heldOn: string;
  sessionType: string;
}

/**
 * PDF ファイル名から会議情報をパースする。
 * e.g., "令和7年12月定例会.pdf" → { eraText: "令和7年", month: 12, sessionType: "定例会" }
 */
export function parsePdfFilename(filename: string): {
  eraText: string;
  month: number;
  sessionType: string;
} | null {
  const match = filename.match(/(令和|平成)(元|\d+)年(\d+)月(定例会|臨時会)\.pdf$/);
  if (!match) return null;

  const era = match[1]!;
  const eraYear = match[2] === "元" ? 1 : Number(match[2]);
  const month = Number(match[3]);
  const sessionType = match[4]!;

  return {
    eraText: `${era}${eraYear === 1 ? "元" : eraYear}年`,
    month,
    sessionType,
  };
}

/**
 * 和暦テキストから西暦年を返す。
 * e.g., "令和7年" → 2025, "令和元年" → 2019
 */
export function eraToWesternYear(eraText: string): number | null {
  const match = eraText.match(/(令和|平成)(元|\d+)年/);
  if (!match) return null;

  const era = match[1]!;
  const eraYear = match[2] === "元" ? 1 : Number(match[2]);

  if (era === "令和") return eraYear + 2018;
  if (era === "平成") return eraYear + 1988;
  return null;
}

/**
 * 一覧ページの HTML から PDF リンクを抽出する（テスト可能な純粋関数）。
 *
 * 対象: <a href="/wp-content/uploads/giziroku/令和7年12月定例会.pdf"> のパターン
 */
export function parseListPage(html: string): HichisoMeeting[] {
  const results: HichisoMeeting[] = [];

  const linkRegex =
    /<a[^>]+href="([^"]*\/wp-content\/uploads\/giziroku\/[^"]+\.pdf)"[^>]*>/gi;

  for (const match of html.matchAll(linkRegex)) {
    const href = match[1]!;

    // URL からファイル名を取得（URL デコード）
    const decodedHref = decodeURIComponent(href);
    const filenameMatch = decodedHref.match(/([^/]+\.pdf)$/i);
    if (!filenameMatch) continue;

    const filename = filenameMatch[1]!;
    const parsed = parsePdfFilename(filename);
    if (!parsed) continue;

    const westernYear = eraToWesternYear(parsed.eraText);
    if (!westernYear) continue;

    // heldOn: 開催月の1日を仮の日付として使う（PDF 内で正確な日付を取得する）
    const heldOn = `${westernYear}-${String(parsed.month).padStart(2, "0")}-01`;

    // 完全 URL を構築
    const pdfUrl = href.startsWith("http")
      ? href
      : `${BASE_ORIGIN}${href.startsWith("/") ? "" : "/"}${href}`;

    const title = `${parsed.eraText}${parsed.month}月${parsed.sessionType}`;

    results.push({
      pdfUrl,
      title,
      heldOn,
      sessionType: parsed.sessionType,
    });
  }

  return results;
}

/**
 * 指定年の PDF リンクを取得する。
 */
export async function fetchMeetingList(
  baseUrl: string,
  year: number
): Promise<HichisoMeeting[]> {
  const html = await fetchPage(baseUrl);
  if (!html) return [];

  const allMeetings = parseListPage(html);
  const eraTexts = toJapaneseEra(year);

  // 対象年のみフィルタ
  return allMeetings.filter((m) =>
    eraTexts.some((era) => m.title.startsWith(era))
  );
}
