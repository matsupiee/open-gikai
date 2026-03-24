/**
 * 黒石市議会 — list フェーズ
 *
 * 会議録一覧ページから会議録本文 PDF のリンクを収集する。
 * 全年度が単一ページに掲載されているため、1回のリクエストで全リンクを取得できる。
 * 補助資料（目次・日程・通告表・議案）はスキップし、指定年の会議録本文のみを返す。
 *
 * ページ構成:
 *   <h4> 年号別セクション（例: "令和7年", "平成30年"）
 *     各号の PDF リンクがリスト形式で配置
 *
 * heldOn の取得:
 *   ファイル名には日付情報が含まれないため、リンクテキストや周辺テキストから
 *   月日を抽出する。抽出できない場合は null を返す。
 */

import {
  BASE_ORIGIN,
  LIST_PATH,
  detectMeetingType,
  isAuxiliaryFile,
  parsePdfFilename,
  fetchPage,
  delay,
} from "./shared";

export interface KuroishiSessionInfo {
  /** 会議タイトル（例: "2025年第1回定例会第1号"） */
  title: string;
  /** 開催日 YYYY-MM-DD（解析できない場合は null） */
  heldOn: string | null;
  /** 会議種別 */
  meetingType: "plenary" | "extraordinary" | "committee";
  /** PDF の絶対 URL */
  pdfUrl: string;
}

const INTER_REQUEST_DELAY_MS = 1000;

/**
 * テキストから月日を抽出する。
 * 例: "3月15日" → { month: 3, day: 15 }
 */
export function extractMonthDay(
  text: string
): { month: number; day: number } | null {
  // 全角数字を半角に変換
  const normalized = text.replace(/[０-９]/g, (ch) =>
    String.fromCharCode(ch.charCodeAt(0) - 0xfee0)
  );
  const m = normalized.match(/(\d{1,2})月(\d{1,2})日/);
  if (!m) return null;
  return { month: parseInt(m[1]!, 10), day: parseInt(m[2]!, 10) };
}

/**
 * 月日と西暦年から YYYY-MM-DD 文字列を生成する。
 */
export function buildDateString(
  year: number,
  month: number,
  day: number
): string {
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

/**
 * 一覧ページ HTML から指定年の会議録セッション情報を抽出する。
 *
 * ページ構造:
 *   - <h4> タグで年号別にセクション分けされている
 *   - 各セクション内に PDF リンクがリスト形式で配置
 *   - リンクテキストや周辺テキストに月日情報が含まれる場合がある
 */
export function parseSessionsForYear(
  html: string,
  year: number
): KuroishiSessionInfo[] {
  const results: KuroishiSessionInfo[] = [];

  // PDF リンクを抽出: href が files/*.pdf のパターン
  const pdfPattern =
    /<a\s[^>]*href="([^"]*\/files\/([^"/]+\.pdf))"[^>]*>([\s\S]*?)<\/a>/gi;

  let m: RegExpExecArray | null;
  while ((m = pdfPattern.exec(html)) !== null) {
    const href = m[1]!;
    const filename = m[2]!;
    const rawLinkText = m[3]!.replace(/<[^>]+>/g, "").trim();

    if (!href || !filename) continue;

    // 補助資料はスキップ
    if (isAuxiliaryFile(filename)) continue;

    const meta = parsePdfFilename(filename);
    if (!meta) continue;

    // 指定年のみ対象
    if (meta.westernYear !== year) continue;

    // 絶対 URL に変換
    const pdfUrl = href.startsWith("http") ? href : `${BASE_ORIGIN}${href}`;

    const sessionType = meta.isExtraordinary ? "臨時会" : "定例会";
    const title = `${meta.westernYear}年第${meta.session}回${sessionType}第${meta.issue}号`;
    const meetingType = detectMeetingType(title);

    // リンクテキストから月日を抽出
    let heldOn: string | null = null;
    const dateFromLinkText = extractMonthDay(rawLinkText);
    if (dateFromLinkText) {
      heldOn = buildDateString(
        meta.westernYear,
        dateFromLinkText.month,
        dateFromLinkText.day
      );
    } else {
      // リンクテキストに日付がない場合、前後 200 文字の HTML コンテキストから日付を探す
      const linkEndIndex = (m.index ?? 0) + m[0].length;
      const contextAfter = html.slice(linkEndIndex, linkEndIndex + 200);
      const dateFromContext = extractMonthDay(contextAfter);
      if (dateFromContext) {
        heldOn = buildDateString(
          meta.westernYear,
          dateFromContext.month,
          dateFromContext.day
        );
      }
    }

    results.push({
      title,
      heldOn,
      meetingType,
      pdfUrl,
    });
  }

  return results;
}

/**
 * 指定年の会議録セッション一覧を取得する。
 */
export async function fetchSessionList(
  year: number
): Promise<KuroishiSessionInfo[]> {
  const url = `${BASE_ORIGIN}${LIST_PATH}`;
  const html = await fetchPage(url);
  if (!html) return [];

  await delay(INTER_REQUEST_DELAY_MS);

  return parseSessionsForYear(html, year);
}
