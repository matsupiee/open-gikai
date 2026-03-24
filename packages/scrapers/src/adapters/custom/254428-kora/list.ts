/**
 * 甲良町議会 — list フェーズ
 *
 * インデックスページから年度別ページ URL を取得し、
 * 指定年に該当する年度ページから会議録 PDF リンクを収集する。
 *
 * 各年度ページには h2 見出しで会議名が示され、
 * その下の ul/li に PDF リンクが列挙されている。
 * リンクテキストに「会議録」を含むもの、または「日程」「一般質問」「議決結果」を含まないものを
 * 会議録 PDF として扱う。
 */

import {
  INDEX_URL,
  PDF_PATH_FILTER,
  YEAR_PAGE_BASE_PATH,
  buildHeldOn,
  detectMeetingType,
  extractMonthFromTitle,
  extractYearFromTitle,
  fetchPage,
  resolveUrl,
} from "./shared";

export interface KoraMeetingRecord {
  /** 会議名（例: 令和6年3月甲良町議会定例会） */
  sessionTitle: string;
  /** 会議録 PDF の絶対 URL */
  pdfUrl: string;
  /** PDF のリンクテキスト（例: 3月6日会議録） */
  linkText: string;
  /** 会議種別 */
  meetingType: string;
  /** 開催日（YYYY-MM-DD）。月が不明な場合は null */
  heldOn: string | null;
  /** 年度ページの URL */
  yearPageUrl: string;
}

/**
 * インデックスページ HTML から年度別ページの URL を抽出する（テスト可能な純粋関数）。
 *
 * /cyonososhiki/.../kaigiroku/*.html パターンのリンクを収集する。
 * index.html 自体は除外する。
 */
export function parseIndexPage(html: string): string[] {
  const urls: string[] = [];
  const seen = new Set<string>();

  const linkPattern = /<a[^>]+href="([^"]+)"[^>]*>/gi;

  for (const match of html.matchAll(linkPattern)) {
    const href = match[1]!;

    // 年度別ページのパターンにマッチするか確認
    if (!href.includes(YEAR_PAGE_BASE_PATH)) continue;
    // index.html 自体は除外
    if (href.endsWith("index.html")) continue;
    // .html で終わるページのみ
    if (!href.endsWith(".html")) continue;

    const absoluteUrl = resolveUrl(href);
    if (seen.has(absoluteUrl)) continue;
    seen.add(absoluteUrl);

    urls.push(absoluteUrl);
  }

  return urls;
}

/**
 * 会議録 PDF リンクかどうか判定する。
 *
 * リンクテキストが「日程」「一般質問」「議決結果」のいずれかを含む場合は
 * 会議録以外の資料として除外する。
 * それ以外（「会議録」を含む、または何も含まない）は会議録として扱う。
 */
export function isMeetingMinutes(linkText: string): boolean {
  const NON_MINUTES_PATTERNS = ["日程", "一般質問", "議決結果", "議案等"];
  return !NON_MINUTES_PATTERNS.some((pattern) => linkText.includes(pattern));
}

/**
 * 年度ページ HTML から会議録 PDF リンクを抽出する（テスト可能な純粋関数）。
 *
 * h2 要素をセクション区切りとして使い、各 h2 の下にある
 * material/files/group/17/ を含む PDF リンクを収集する。
 */
export function parseYearPage(
  html: string,
  yearPageUrl: string,
): KoraMeetingRecord[] {
  const results: KoraMeetingRecord[] = [];

  // h2 タグとリンクを順番に処理するため、HTML を行ごとに解析
  // h2 要素の内容と、直後のリンクを関連付ける
  const elementPattern =
    /<h2[^>]*>([\s\S]*?)<\/h2>|<a[^>]+href="([^"]*)"[^>]*>([\s\S]*?)<\/a>/gi;

  let currentSessionTitle = "";

  for (const match of html.matchAll(elementPattern)) {
    const fullMatch = match[0]!;

    if (fullMatch.startsWith("<h2")) {
      // h2: 会議セクションの開始
      const rawTitle = match[1]!
        .replace(/<[^>]+>/g, "")
        .replace(/\s+/g, " ")
        .trim();
      currentSessionTitle = rawTitle;
    } else {
      // a タグ: PDF リンクかチェック
      const href = match[2]!;
      const rawLinkText = match[3]!
        .replace(/<[^>]+>/g, "")
        .replace(/\s+/g, " ")
        .trim();

      if (!href.includes(PDF_PATH_FILTER)) continue;
      if (!currentSessionTitle) continue;
      if (!isMeetingMinutes(rawLinkText)) continue;

      // リンクテキストからファイルサイズ情報を除去
      const linkText = rawLinkText.replace(/\s*\(PDFファイル[^)]*\)\s*/g, "").trim();

      const pdfUrl = resolveUrl(href);
      const year = extractYearFromTitle(currentSessionTitle);
      const month = extractMonthFromTitle(currentSessionTitle);
      const heldOn = year ? buildHeldOn(year, month) : null;
      const meetingType = detectMeetingType(currentSessionTitle);

      results.push({
        sessionTitle: currentSessionTitle,
        pdfUrl,
        linkText,
        meetingType,
        heldOn,
        yearPageUrl,
      });
    }
  }

  return results;
}

/**
 * 年度ページの URL から西暦年を推定する。
 *
 * 年度ページのタイトル（h2）に含まれる年号から推定するが、
 * ページ自体はそのまま使うので、外部からフィルタを行う。
 * ここでは URL から年を推定する機能は不要で、代わりに
 * 各レコードの heldOn の year 部分でフィルタする。
 */
export function extractYearFromHeldOn(heldOn: string | null): number | null {
  if (!heldOn) return null;
  const match = heldOn.match(/^(\d{4})-/);
  return match ? parseInt(match[1]!, 10) : null;
}

/**
 * インデックスページから全年度ページの URL を取得する。
 */
export async function fetchYearPageUrls(): Promise<string[]> {
  const html = await fetchPage(INDEX_URL);
  if (!html) return [];
  return parseIndexPage(html);
}

/**
 * 指定年の会議録 PDF リンクを全年度ページから収集する。
 *
 * 年号が含まれるタイトル（h2）から西暦を推定し、
 * 指定年に一致するレコードのみ返す。
 */
export async function fetchMeetingRecords(
  year: number,
): Promise<KoraMeetingRecord[]> {
  const yearPageUrls = await fetchYearPageUrls();
  if (yearPageUrls.length === 0) return [];

  const allRecords: KoraMeetingRecord[] = [];

  for (const url of yearPageUrls) {
    const html = await fetchPage(url);
    if (!html) continue;

    const records = parseYearPage(html, url);

    // 指定年に一致するレコードのみ追加
    for (const record of records) {
      const recordYear = extractYearFromHeldOn(record.heldOn);
      // heldOn が null の場合（月が不明）は sessionTitle から年を推定
      const fallbackYear = extractYearFromTitle(record.sessionTitle);
      const effectiveYear = recordYear ?? fallbackYear;
      if (effectiveYear === year) {
        allRecords.push(record);
      }
    }
  }

  return allRecords;
}
