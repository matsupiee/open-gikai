/**
 * 美祢市議会 -- list フェーズ
 *
 * 1. 会議録一覧ページ (/soshiki/gikai/gijiroku/index.html) から全 PDF リンクを収集
 * 2. リンクテキストまたはページ見出しから年度・会議種別・開催日を抽出
 * 3. 指定年度に絞り込んで返す
 */

import {
  BASE_ORIGIN,
  detectMeetingType,
  parseWarekiYear,
  fetchPage,
  delay,
} from "./shared";

export interface MineSessionInfo {
  /** 会議タイトル（例: "令和6年第4回定例会"） */
  title: string;
  /** 開催日 YYYY-MM-DD または null */
  heldOn: string | null;
  /** PDF の絶対 URL */
  pdfUrl: string;
  /** 会議種別 */
  meetingType: string;
}

const LIST_URL = `${BASE_ORIGIN}/soshiki/gikai/gijiroku/index.html`;
const INTER_PAGE_DELAY_MS = 1500;

/**
 * 一覧ページ HTML から PDF リンクと付随情報を抽出する（純粋関数）。
 *
 * 美祢市のサイトでは会議録一覧ページに直接 PDF リンクが並んでいる想定。
 * 見出し（h2/h3）や前後テキストから年度・会議種別を推定する。
 *
 * リンクテキスト例:
 *   "令和6年第4回定例会会議録（令和6年12月10日）"
 *   "令和6年第1回臨時会会議録（令和6年3月15日）"
 */
export function parseListPage(html: string): MineSessionInfo[] {
  const records: MineSessionInfo[] = [];

  // PDF リンクを抽出
  const pdfPattern = /<a\s[^>]*href="([^"]*\.pdf)"[^>]*>([^<]*)<\/a>/gi;

  let m: RegExpExecArray | null;
  while ((m = pdfPattern.exec(html)) !== null) {
    const href = m[1]!;
    const linkText = m[2]!.replace(/\s+/g, " ").trim();

    const absoluteUrl = new URL(href, LIST_URL).toString();
    const seirekiYear = parseWarekiYear(linkText);
    if (seirekiYear === null) continue;

    const meetingType = detectMeetingType(linkText);
    const heldOn = extractHeldOn(linkText, seirekiYear);

    // タイトルから（日付）部分を除いた会議名
    const title = linkText.replace(/（[^）]*）$/, "").replace(/\s*\[PDF[^\]]*\]$/, "").trim();

    records.push({
      title,
      heldOn,
      pdfUrl: absoluteUrl,
      meetingType,
    });
  }

  return records;
}

/**
 * リンクテキストから開催日 YYYY-MM-DD を抽出する。
 * パターン: "（令和6年12月10日）" や "（令和元年6月1日）"
 * 解析できない場合は null を返す。
 */
export function extractHeldOn(text: string, seirekiYear: number): string | null {
  // （月日）パターン: （12月10日）または（令和X年12月10日）
  const dateInParens = text.match(/[（(](?:令和|平成)?(?:\d+|元)年(\d{1,2})月(\d{1,2})日[）)]/);
  if (dateInParens) {
    const month = parseInt(dateInParens[1]!, 10);
    const day = parseInt(dateInParens[2]!, 10);
    return `${seirekiYear}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
  }

  // 括弧なしで月日だけのパターン: "12月10日"
  const dateRaw = text.match(/(\d{1,2})月(\d{1,2})日/);
  if (dateRaw) {
    const month = parseInt(dateRaw[1]!, 10);
    const day = parseInt(dateRaw[2]!, 10);
    return `${seirekiYear}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
  }

  return null;
}

/**
 * 指定年度の全会議録 PDF 情報を収集する。
 */
export async function fetchDocumentList(
  _baseUrl: string,
  year: number
): Promise<MineSessionInfo[]> {
  const html = await fetchPage(LIST_URL);
  if (!html) return [];

  await delay(INTER_PAGE_DELAY_MS);

  const allRecords = parseListPage(html);

  // 指定年度に絞り込む
  return allRecords.filter((record) => {
    const recordYear = parseWarekiYear(record.title);
    return recordYear === year;
  });
}
