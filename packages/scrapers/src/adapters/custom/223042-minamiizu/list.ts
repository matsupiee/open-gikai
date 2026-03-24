/**
 * 南伊豆町議会 — list フェーズ
 *
 * 3 つの固定 URL から PDF リンクを収集する:
 * - https://www.town.minamiizu.shizuoka.jp/docs/2022012000012/ （令和元年～）
 * - https://www.town.minamiizu.shizuoka.jp/docs/2021122800062/ （平成21年～31年）
 * - https://www.town.minamiizu.shizuoka.jp/docs/2021122800055/ （平成11年～20年）
 *
 * PDF ファイル命名規則:
 *   R{年}-T{月}.pdf   → 定例会
 *   R{年}-YK{月}.pdf  → 予算決算常任委員会
 *   R{年}-R{回}.pdf   → 臨時会
 *   H{年}-T{月}.pdf   → 定例会（平成期）
 *   H{年}-R{回}.pdf   → 臨時会（平成期）
 *
 * アンカーテキスト例:
 *   "令和6年12月南伊豆町議会定例会.pdf[PDF：1.2MB]"
 *   "令和7年第2回南伊豆町議会臨時会.pdf[PDF：0.5MB]"
 */

import { BASE_ORIGIN, LIST_URLS, fetchPage, toWesternYear } from "./shared";

export interface MinamiizuMeeting {
  pdfUrl: string;
  title: string;
  heldOn: string | null;
  section: string;
  filename: string;
}

/**
 * PDF ファイル名からメタ情報を抽出する。
 *
 * ファイル名パターン: [R/H]{年}-[T/YK/R]{月or回}.pdf
 */
export function parseFilename(filename: string): {
  westernYear: number;
  meetingCode: string;
  number: number;
} | null {
  const match = filename.match(/^([RH])(\d+)-([A-Z]+)(\d+)\.pdf$/i);
  if (!match) return null;

  const eraChar = match[1]!.toUpperCase();
  const eraYearStr = match[2]!;
  const meetingCode = match[3]!.toUpperCase();
  const number = Number(match[4]);

  const era = eraChar === "R" ? "令和" : "平成";
  const westernYear = toWesternYear(era, eraYearStr);
  if (!westernYear) return null;

  return { westernYear, meetingCode, number };
}

/**
 * アンカーテキストから会議情報を抽出する。
 *
 * 定例会: "令和6年12月南伊豆町議会定例会"
 * 臨時会: "令和7年第2回南伊豆町議会臨時会"
 * 委員会: "令和7年9月予算決算常任委員会"
 */
export function parseAnchorText(text: string): {
  section: string;
  heldOn: string | null;
  title: string;
} | null {
  // ファイルサイズ情報などのゴミを除去
  const clean = text.replace(/\.pdf.*$/i, "").trim();

  const eraMatch = clean.match(/(令和|平成)(元|\d+)年/);
  if (!eraMatch) return null;

  const era = eraMatch[1]!;
  const eraYearRaw = eraMatch[2]!;
  const westernYear = toWesternYear(era, eraYearRaw);
  if (!westernYear) return null;

  // 臨時会: 令和7年第2回南伊豆町議会臨時会
  const rinjiMatch = clean.match(
    /(令和|平成)(元|\d+)年第(\d+)回南伊豆町議会臨時会/
  );
  if (rinjiMatch) {
    const kaisu = rinjiMatch[3]!;
    const section = `第${kaisu}回臨時会`;
    return {
      section,
      heldOn: null,
      title: `${era}${eraYearRaw}年${section}`,
    };
  }

  // 定例会: 令和6年12月南伊豆町議会定例会
  const teireiMatch = clean.match(
    /(令和|平成)(元|\d+)年(\d+)月南伊豆町議会定例会/
  );
  if (teireiMatch) {
    const month = Number(teireiMatch[3]!);
    const section = `${month}月定例会`;
    const heldOn = `${westernYear}-${String(month).padStart(2, "0")}-01`;
    return {
      section,
      heldOn,
      title: `${era}${eraYearRaw}年${section}`,
    };
  }

  // 予算決算常任委員会: 令和7年9月予算決算常任委員会
  const iinkaiMatch = clean.match(
    /(令和|平成)(元|\d+)年(\d+)月(.+委員会)/
  );
  if (iinkaiMatch) {
    const month = Number(iinkaiMatch[3]!);
    const committeeName = iinkaiMatch[4]!;
    const section = committeeName;
    const heldOn = `${westernYear}-${String(month).padStart(2, "0")}-01`;
    return {
      section,
      heldOn,
      title: `${era}${eraYearRaw}年${month}月${committeeName}`,
    };
  }

  return null;
}

/**
 * 一覧ページの HTML から PDF リンクとメタ情報を抽出する（純粋関数）。
 * file_contents/ を含むアンカー要素を対象とする。
 */
export function parseListPage(
  html: string,
  pageUrl: string,
  targetYear: number
): MinamiizuMeeting[] {
  const results: MinamiizuMeeting[] = [];

  // ページ ID を URL から取得 (e.g., "/docs/2022012000012/" → "2022012000012")
  const pageIdMatch = pageUrl.match(/\/docs\/(\d+)\//);
  const pageId = pageIdMatch ? pageIdMatch[1] : null;

  // file_contents/*.pdf を含むアンカーを抽出
  const linkRegex =
    /<a[^>]+href="([^"]*file_contents\/[^"]*\.pdf)"[^>]*>([\s\S]*?)<\/a>/gi;

  for (const match of html.matchAll(linkRegex)) {
    const href = match[1]!;
    const rawText = match[2]!.replace(/<[^>]+>/g, "").trim();

    // ファイル名を取得
    const filenameMatch = href.match(/\/([^/]+\.pdf)$/i);
    if (!filenameMatch) continue;
    const filename = filenameMatch[1]!;

    // ファイル名からメタ情報を取得
    const filenameMeta = parseFilename(filename);
    if (!filenameMeta) continue;

    // 対象年のみ処理
    if (filenameMeta.westernYear !== targetYear) continue;

    // アンカーテキストからメタ情報を取得
    const textMeta = parseAnchorText(rawText);

    // section と title を決定（テキストを優先、フォールバックはファイル名）
    let section: string;
    let title: string;
    let heldOn: string | null = null;

    if (textMeta) {
      section = textMeta.section;
      title = textMeta.title;
      heldOn = textMeta.heldOn;
    } else {
      // ファイル名からフォールバック
      const { meetingCode, number } = filenameMeta;
      if (meetingCode === "T") {
        section = `${number}月定例会`;
        title = `${targetYear}年${section}`;
        heldOn = `${targetYear}-${String(number).padStart(2, "0")}-01`;
      } else if (meetingCode === "YK") {
        section = "予算決算常任委員会";
        title = `${targetYear}年${number}月${section}`;
        heldOn = `${targetYear}-${String(number).padStart(2, "0")}-01`;
      } else if (meetingCode === "R") {
        section = `第${number}回臨時会`;
        title = `${targetYear}年${section}`;
      } else {
        continue;
      }
    }

    // PDF URL を組み立て
    let pdfUrl: string;
    if (href.startsWith("http")) {
      pdfUrl = href;
    } else if (href.startsWith("/")) {
      pdfUrl = `${BASE_ORIGIN}${href}`;
    } else if (pageId) {
      pdfUrl = `${BASE_ORIGIN}/docs/${pageId}/${href}`;
    } else {
      pdfUrl = `${BASE_ORIGIN}/${href}`;
    }

    results.push({
      pdfUrl,
      title,
      heldOn,
      section,
      filename,
    });
  }

  return results;
}

/**
 * 指定年の全 PDF リンクを取得する。
 * 3 つの固定一覧ページからリンクを収集する。
 */
export async function fetchDocumentList(
  _baseUrl: string,
  year: number
): Promise<MinamiizuMeeting[]> {
  const results: MinamiizuMeeting[] = [];

  for (const url of LIST_URLS) {
    const html = await fetchPage(url);
    if (html) {
      results.push(...parseListPage(html, url, year));
    }
  }

  return results;
}
