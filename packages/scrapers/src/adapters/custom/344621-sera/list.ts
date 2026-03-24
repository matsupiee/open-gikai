/**
 * 世羅町議会 — list フェーズ
 *
 * 一覧ページ https://www.town.sera.hiroshima.jp/soshiki/16/14729.html から
 * 全 PDF リンクを抽出する。
 *
 * - 単一ページに令和3年〜令和7年の全会議録が掲載されている
 * - ページネーションなし
 * - リンクテキスト形式: 令和X年第Y回定例会第Z日目（M月D日）
 *   または 令和X年第Y回臨時会（M月D日）
 */

import {
  buildPdfUrl,
  detectMeetingType,
  fetchPage,
} from "./shared";

export interface SeraSessionInfo {
  /** 会議タイトル（例: "令和7年第3回定例会第1日目（9月4日）"） */
  title: string;
  /** 開催日 YYYY-MM-DD */
  heldOn: string;
  /** PDF の絶対 URL */
  pdfUrl: string;
  /** 会議種別 */
  meetingType: string;
}

/**
 * 一覧ページ HTML から PDF リンクを抽出する。
 *
 * リンクテキストから会議名・日程のメタ情報を抽出する。
 * 対応フォーマット:
 *   令和X年第Y回定例会第Z日目（M月D日）
 *   令和X年第Y回臨時会（M月D日）
 */
export function parsePdfLinks(html: string, targetYear?: number): SeraSessionInfo[] {
  const records: SeraSessionInfo[] = [];

  // /uploaded/attachment/{ID}.pdf パターンの PDF リンクを抽出
  const pdfPattern =
    /<a\s[^>]*href="(\/uploaded\/attachment\/\d+\.pdf)"[^>]*>([\s\S]*?)<\/a>/gi;

  let m: RegExpExecArray | null;
  while ((m = pdfPattern.exec(html)) !== null) {
    const pdfPath = m[1]!;
    // リンクテキストからHTMLタグと改行・スペースを除去
    const rawText = m[2]!.replace(/<[^>]+>/g, "").trim();

    // メタ情報を正規表現で抽出
    // 定例会: 令和X年第Y回定例会第Z日目（M月D日）
    // 臨時会: 令和X年第Y回臨時会（M月D日）
    const metaPattern =
      /(令和|平成)(元|\d+)年第(\d+)回(定例会|臨時会)(?:第\d+日目)?[（(](\d+)月(\d+)日[）)]/;
    const meta = rawText.match(metaPattern);
    if (!meta) continue;

    const era = meta[1]!;
    const eraYearStr = meta[2]!;
    const meetingKind = meta[4]!;
    const month = parseInt(meta[5]!, 10);
    const day = parseInt(meta[6]!, 10);

    const eraYear = eraYearStr === "元" ? 1 : parseInt(eraYearStr, 10);
    const year = era === "令和" ? 2018 + eraYear : 1988 + eraYear;

    // targetYear が指定されている場合はフィルタリング
    if (targetYear !== undefined && year !== targetYear) continue;

    const heldOn = `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    const meetingType = detectMeetingType(meetingKind);

    // ファイルサイズ表記を除去してタイトルを整形
    const title = rawText
      .replace(/\s*[（(]\d+KB[）)]/i, "")
      .replace(/\s*\(PDF.*$/i, "")
      .replace(/\s*（PDF.*$/i, "")
      .replace(/\s+/g, " ")
      .trim();

    records.push({
      title,
      heldOn,
      pdfUrl: buildPdfUrl(pdfPath),
      meetingType,
    });
  }

  return records;
}

/**
 * 指定年度の全セッション日 PDF を収集する。
 */
export async function fetchSessionList(
  baseUrl: string,
  year: number,
): Promise<SeraSessionInfo[]> {
  const html = await fetchPage(baseUrl);
  if (!html) return [];

  return parsePdfLinks(html, year);
}
