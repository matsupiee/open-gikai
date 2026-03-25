/**
 * 三郷町議会 -- list フェーズ
 *
 * 2段階クロールで PDF リンクを収集する:
 * 1. 年度別一覧インデックスから各年度ページ URL を取得
 * 2. 各年度ページから PDF リンクとメタ情報を抽出
 *
 * 年度別一覧インデックス: /site/gikai/list7-28.html
 *   → 年度別ページ: /site/gikai/{ページID}.html
 *     → PDF リンク: /uploaded/attachment/{ID}.pdf
 *
 * リンクテキスト例:
 *   "令和6年第1回（3月）三郷町議会定例会会議録（初日）"
 *   "令和6年第1回（5月）三郷町議会臨時会会議録"
 */

import {
  BASE_ORIGIN,
  YEAR_INDEX_PATH,
  eraToWesternYear,
  fetchPage,
  toJapaneseEra,
} from "./shared";

export interface SangoMeeting {
  pdfUrl: string;
  title: string;
  heldOn: string | null; // YYYY-MM-DD or null
  section: string;
}

/**
 * 年度別一覧インデックスから年度ページのリンクを抽出する。
 * "令和6年会議録" → "/site/gikai/11718.html"
 */
export function parseYearIndexPage(html: string): { label: string; url: string }[] {
  const results: { label: string; url: string }[] = [];

  const linkRegex = /<a[^>]+href="([^"]*\/site\/gikai\/\d+\.html)"[^>]*>([^<]+)<\/a>/g;

  for (const match of html.matchAll(linkRegex)) {
    const href = match[1]!;
    const label = match[2]!.trim();

    // 会議録ページのみ対象（"〜会議録" というラベルのみ）
    if (!label.includes("会議録")) continue;

    const url = href.startsWith("http")
      ? href
      : `${BASE_ORIGIN}${href.startsWith("/") ? "" : "/"}${href}`;

    results.push({ label, url });
  }

  return results;
}

/**
 * リンクテキストから会議名（section）を抽出する。
 * "令和6年第1回（3月）三郷町議会定例会会議録（初日）" → "第1回（3月）定例会"
 * "令和6年第1回（5月）三郷町議会臨時会会議録" → "第1回（5月）臨時会"
 */
export function parseSectionFromLinkText(linkText: string): string {
  // "第N回（M月）三郷町議会定例会" or "第N回（M月）三郷町議会臨時会"
  const match = linkText.match(/(第\d+回[（(]\d+月[）)])(?:.*?)(定例会|臨時会)/);
  if (match) {
    return `${match[1]!}${match[2]!}`;
  }

  // フォールバック: 定例会/臨時会部分を返す
  const fallback = linkText.match(/((?:定例会|臨時会)[^（(（]*)/);
  return fallback ? fallback[1]!.trim() : linkText.replace(/\[.*?\]/, "").trim();
}

/**
 * リンクテキストから日付ヒント（月）を抽出する。
 * "令和6年第1回（3月）三郷町議会定例会会議録（初日）" → { year: 2024, month: 3 }
 */
export function parseDateHint(
  linkText: string,
  defaultYear: number
): { year: number; month: number } | null {
  // まず令和/平成から年を取る
  const eraMatch = linkText.match(/(令和|平成)(元|\d+)年/);
  let year = defaultYear;
  if (eraMatch) {
    const westernYear = eraToWesternYear(eraMatch[0]!);
    if (westernYear) year = westernYear;
  }

  // 月を取る: "（3月）" or "（12月）"
  const monthMatch = linkText.match(/[（(](\d+)月[）)]/);
  if (!monthMatch) return null;

  const month = Number(monthMatch[1]!);
  return { year, month };
}

/**
 * 年度ページから PDF リンクを抽出する（テスト可能な純粋関数）。
 *
 * HTML 構造:
 *   <ul>
 *     <li><a href="/uploaded/attachment/9737.pdf">令和6年第1回（3月）三郷町議会定例会会議録（初日）[PDFファイル／1.5MB]</a></li>
 *     ...
 *   </ul>
 */
export function parseYearPage(html: string, year: number): SangoMeeting[] {
  const results: SangoMeeting[] = [];

  const linkPattern =
    /<a[^>]+href="(\/uploaded\/attachment\/\d+\.pdf)"[^>]*>([\s\S]*?)<\/a>/gi;

  for (const match of html.matchAll(linkPattern)) {
    const pdfPath = match[1]!;
    const rawText = match[2]!.replace(/<[^>]+>/g, "").trim();
    // ファイルサイズ表記を除去
    const linkText = rawText.replace(/\s*\[PDFファイル[^\]]*\]/g, "").trim();

    const pdfUrl = `${BASE_ORIGIN}${pdfPath}`;
    const section = parseSectionFromLinkText(linkText);

    // 日付ヒントから YYYY-MM-01 を生成（正確な日付はPDF内から取得できないため月初で代替）
    const dateHint = parseDateHint(linkText, year);
    let heldOn: string | null = null;
    if (dateHint) {
      heldOn = `${dateHint.year}-${String(dateHint.month).padStart(2, "0")}-01`;
    }

    // タイトル: 初日/最終日 suffix を付加
    const dayMatch = linkText.match(/[（(](初日|最終日|第\d+日)[）)]/);
    const daySuffix = dayMatch ? `（${dayMatch[1]!}）` : "";
    const title = `${section}${daySuffix}`.trim();

    results.push({ pdfUrl, title, heldOn, section });
  }

  return results;
}

/**
 * 指定年の全 PDF リンクを取得する。
 */
export async function fetchMeetingList(
  _baseUrl: string,
  year: number
): Promise<SangoMeeting[]> {
  const eraTexts = toJapaneseEra(year);

  // 年度別一覧インデックスから対象年のページを探す
  const indexUrl = `${BASE_ORIGIN}${YEAR_INDEX_PATH}`;
  const indexHtml = await fetchPage(indexUrl);
  if (!indexHtml) return [];

  const yearPages = parseYearIndexPage(indexHtml);

  // 対象年度のページを見つける（令和/平成どちらかに合致すれば OK）
  const targetPage = yearPages.find((p) =>
    eraTexts.some((era) => p.label.includes(era))
  );
  if (!targetPage) return [];

  const yearHtml = await fetchPage(targetPage.url);
  if (!yearHtml) return [];

  return parseYearPage(yearHtml, year);
}
