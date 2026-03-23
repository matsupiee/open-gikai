/**
 * 東伊豆町議会 — list フェーズ
 *
 * 2 つの一覧ページ（本会議・委員会）から PDF リンクを収集する:
 * - https://www.town.higashiizu.lg.jp/gikai/kaigiroku/1130.html（本会議）
 * - https://www.town.higashiizu.lg.jp/gikai/kaigiroku/1131.html（委員会）
 *
 * HTML 構造:
 * - 年度ごとに h2 見出しで区切られている
 * - 委員会ページは h3 でカテゴリ分類
 * - PDF リンクは a[href$=".pdf"] で直接リンク
 *
 * リンクテキスト例:
 *   "令和7年12月3日 第4回定例会 (PDFファイル: 1.2MB)"
 *   "令和7年6月10日 総務経済常任委員会 (PDFファイル: 0.8MB)"
 */

import {
  BASE_ORIGIN,
  HONKAIGI_PATH,
  IINKAI_PATH,
  fetchPage,
} from "./shared";

export interface HigashiizuMeeting {
  pdfUrl: string;
  title: string;
  heldOn: string;
  section: string;
}

/**
 * 和暦の日付テキストから YYYY-MM-DD 形式に変換する。
 * e.g., "令和7年12月3日" → "2025-12-03"
 *       "令和元年6月10日" → "2019-06-10"
 */
export function parseJapaneseDate(text: string): string | null {
  const match = text.match(/(令和|平成)(元|\d+)年(\d+)月(\d+)日/);
  if (!match) return null;

  const [, era, eraYearRaw, month, day] = match;
  const eraYear = eraYearRaw === "元" ? 1 : Number(eraYearRaw);

  let westernYear: number;
  if (era === "令和") westernYear = eraYear + 2018;
  else if (era === "平成") westernYear = eraYear + 1988;
  else return null;

  return `${westernYear}-${String(Number(month)).padStart(2, "0")}-${String(Number(day)).padStart(2, "0")}`;
}

/**
 * リンクテキストからメタ情報を抽出する。
 *
 * 本会議パターン:
 *   "令和7年12月3日 第4回定例会 (PDFファイル: 1.2MB)"
 *
 * 委員会パターン:
 *   "令和7年6月10日 総務経済常任委員会 (PDFファイル: 0.8MB)"
 */
export function parseMetaFromLinkText(
  text: string,
  currentCategory?: string
): {
  heldOn: string;
  section: string;
  title: string;
} | null {
  // ファイルサイズ情報を除去
  const cleanText = text.replace(/\(PDFファイル[：:].*?\)/g, "").trim();

  // 日付を抽出
  const heldOn = parseJapaneseDate(cleanText);
  if (!heldOn) return null;

  // 日付部分を除去して会議名を取得
  const withoutDate = cleanText.replace(/(令和|平成)(元|\d+)年\d+月\d+日\s*/, "").trim();

  // 会議名の決定
  let section: string;
  if (withoutDate) {
    section = withoutDate;
  } else if (currentCategory) {
    section = currentCategory;
  } else {
    return null;
  }

  const title = `${cleanText.match(/(令和|平成)(元|\d+)年/)?.[0] ?? ""}${section}`;

  return { heldOn, section, title };
}

/**
 * 一覧ページの HTML から PDF リンクとメタ情報を抽出する。
 *
 * h2 見出しから年度を、h3 見出しから委員会カテゴリを取得し、
 * 各 PDF リンクに紐づける。
 */
export function parseListPage(
  html: string,
  targetYear: number
): HigashiizuMeeting[] {
  const results: HigashiizuMeeting[] = [];

  let currentYear = "";
  let currentCategory = "";

  // h2, h3, a[href$=".pdf"] を順に走査する
  // 正規表現で h2, h3, a タグを抽出
  const tagRegex = /<(h2|h3)[^>]*>([\s\S]*?)<\/\1>|<a[^>]+href="([^"]*\.pdf)"[^>]*>([\s\S]*?)<\/a>/gi;

  for (const match of html.matchAll(tagRegex)) {
    const tag = match[1]?.toLowerCase();
    const tagContent = match[2]?.replace(/<[^>]+>/g, "").trim();

    if (tag === "h2" && tagContent) {
      currentYear = tagContent;
      currentCategory = "";
      continue;
    }

    if (tag === "h3" && tagContent) {
      currentCategory = tagContent;
      continue;
    }

    // PDF リンクの処理
    const href = match[3];
    const linkText = match[4]?.replace(/<[^>]+>/g, "").trim();

    if (!href || !linkText) continue;

    // 年度フィルタリング: 見出しテキストに対象年の情報が含まれているか確認
    const eraYear = targetYear - 2018;
    const eraYearPrev = targetYear - 1988;
    const yearPatterns = [
      `${targetYear}年`,
      ...(targetYear >= 2020 ? [`令和${eraYear}年`] : []),
      ...(targetYear === 2019 ? ["令和元年", "平成31年"] : []),
      ...(targetYear >= 1989 && targetYear <= 2019 ? [`平成${eraYearPrev}年`] : []),
    ];

    const yearMatches =
      yearPatterns.some((p) => currentYear.includes(p)) ||
      yearPatterns.some((p) => linkText.includes(p));

    if (!yearMatches) continue;

    const meta = parseMetaFromLinkText(linkText, currentCategory);
    if (!meta) continue;

    // URL を正規化
    let pdfUrl: string;
    if (href.startsWith("//")) {
      pdfUrl = `https:${href}`;
    } else if (href.startsWith("http")) {
      pdfUrl = href;
    } else if (href.startsWith("/")) {
      pdfUrl = `${BASE_ORIGIN}${href}`;
    } else {
      pdfUrl = `${BASE_ORIGIN}/${href}`;
    }

    results.push({
      pdfUrl,
      title: meta.title,
      heldOn: meta.heldOn,
      section: meta.section,
    });
  }

  return results;
}

/**
 * 指定年の全 PDF リンクを取得する。
 * 本会議・委員会の 2 ページからリンクを収集する。
 */
export async function fetchMeetingList(
  _baseUrl: string,
  year: number
): Promise<HigashiizuMeeting[]> {
  const results: HigashiizuMeeting[] = [];

  // 本会議一覧ページ
  const honkaigiUrl = `${BASE_ORIGIN}${HONKAIGI_PATH}`;
  const honkaigiHtml = await fetchPage(honkaigiUrl);
  if (honkaigiHtml) {
    results.push(...parseListPage(honkaigiHtml, year));
  }

  // 委員会一覧ページ
  const iinkaiUrl = `${BASE_ORIGIN}${IINKAI_PATH}`;
  const iinkaiHtml = await fetchPage(iinkaiUrl);
  if (iinkaiHtml) {
    results.push(...parseListPage(iinkaiHtml, year));
  }

  return results;
}
