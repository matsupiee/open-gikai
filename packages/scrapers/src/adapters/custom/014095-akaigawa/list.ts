/**
 * 赤井川村議会 — list フェーズ
 *
 * 会議録一覧ページ (post_95.html) から全 PDF リンクを収集し、
 * リンクテキストから会議情報をパースする。
 *
 * 一覧ページは単一ページ（ページネーションなし）で、
 * 全年度の会議録が1ページに掲載されている。
 */

import {
  BASE_ORIGIN,
  detectMeetingType,
  toHalfWidth,
  convertWarekiDateToISO,
  fetchPage,
} from "./shared";

export interface AkaigawaPdfLink {
  /** 会議タイトル（例: "第１回定例会本会議 第１日"） */
  title: string;
  /** 開催日 YYYY-MM-DD */
  heldOn: string;
  /** PDF の絶対 URL */
  pdfUrl: string;
  /** 会議種別 */
  meetingType: string;
}

/**
 * リンクテキストから会議情報をパースする。
 *
 * パターン:
 *   第N回定例会本会議 第N日(令和X年X月X日開催)
 *   第N回臨時会本会議N日目（令和X年X月X日開催）
 *
 * 全角数字・表記揺れに対応する。
 */
export function parseLinkText(text: string): {
  title: string;
  heldOn: string;
  meetingType: string;
} | null {
  const normalized = toHalfWidth(text);

  // 会議名パターン: 第N回(定例会|臨時会)本会議 + 日目情報 + (開催日)
  const meetingMatch = normalized.match(
    /第(\d+)回(定例会|臨時会)本会議\s*第?(\d+)日目?/
  );
  if (!meetingMatch) return null;

  // 開催日を抽出
  const dateMatch = normalized.match(
    /[(\(（](令和(?:元|\d+)年\d+月\d+日)開催[)\)）]/
  );
  if (!dateMatch) return null;

  const heldOn = convertWarekiDateToISO(dateMatch[1]!);
  if (!heldOn) return null;

  const sessionNum = meetingMatch[1]!;
  const meetingKind = meetingMatch[2]!;
  const dayNum = meetingMatch[3]!;

  const title = `第${sessionNum}回${meetingKind}本会議 第${dayNum}日`;
  const meetingType = detectMeetingType(meetingKind);

  return { title, heldOn, meetingType };
}

/**
 * 一覧ページ HTML から PDF リンクをパースする。
 *
 * - `.pdf` で終わるリンクのみ抽出
 * - 一般質問資料など会議録本文でない PDF は除外
 * - リンクテキストから会議情報をパース
 */
export function parseListPage(html: string): AkaigawaPdfLink[] {
  const results: AkaigawaPdfLink[] = [];

  const pattern = /<a\s[^>]*href="([^"]*\.pdf)"[^>]*>([\s\S]*?)<\/a>/gi;

  let m: RegExpExecArray | null;
  while ((m = pattern.exec(html)) !== null) {
    const href = m[1]!;
    const linkText = m[2]!.replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim();

    // 一般質問資料・質問事項など会議録本文でない PDF を除外
    if (linkText.includes("一般質問") && !linkText.includes("本会議")) continue;
    if (linkText.includes("質問事項")) continue;
    if (linkText.includes("資料")) continue;

    const parsed = parseLinkText(linkText);
    if (!parsed) continue;

    // URL を絶対 URL に変換
    const pdfUrl = href.startsWith("http")
      ? href
      : `${BASE_ORIGIN}${href.startsWith("/") ? "" : "/"}${href}`;

    results.push({
      title: parsed.title,
      heldOn: parsed.heldOn,
      pdfUrl,
      meetingType: parsed.meetingType,
    });
  }

  return results;
}

/**
 * 指定年度の PDF リンクを収集する。
 *
 * baseUrl (post_95.html) を取得し、全 PDF リンクをパースした後、
 * 対象年度のものだけをフィルタリングして返す。
 *
 * 年度判定: 4月〜翌年3月を1年度とする。
 */
export async function fetchDocumentList(
  baseUrl: string,
  year: number
): Promise<AkaigawaPdfLink[]> {
  const html = await fetchPage(baseUrl);
  if (!html) return [];

  const allLinks = parseListPage(html);

  // 年度フィルタ: heldOn の月で年度を判定
  return allLinks.filter((link) => {
    const [y, monthStr] = link.heldOn.split("-");
    const heldYear = parseInt(y!, 10);
    const month = parseInt(monthStr!, 10);

    // 1-3月は前年度に属する
    const nendo = month <= 3 ? heldYear - 1 : heldYear;
    return nendo === year;
  });
}
