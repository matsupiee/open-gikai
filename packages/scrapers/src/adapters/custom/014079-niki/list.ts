/**
 * 仁木町議会 — list フェーズ
 *
 * 会議録一覧ページ (irv97600000004s6.html) から全 PDF リンクを収集し、
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

export interface NikiPdfLink {
  /** 会議タイトル（例: "第4回定例会"） */
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
 *   第N回定例会（令和X年X月X日開催）
 *   第N回定例会N日目（令和X年X月X日開催）
 *   第N回定例会(N日目)（令和X年X月X日開催）
 *   第N回臨時会（令和X年X月X日開催）
 *   第N回臨時会〔初議会〕（令和X年X月X日開催）
 *
 * 平成年にも対応する。
 * 括弧の種類（全角・半角）が混在する場合にも対応する。
 */
export function parseLinkText(text: string): {
  title: string;
  heldOn: string;
  meetingType: string;
} | null {
  const normalized = toHalfWidth(text.trim());

  // 会議名と開催日のメインパターン
  // 例: 第4回定例会（令和7年12月18日開催）
  // 例: 第1回定例会3日目（令和7年3月17日開催）
  // 例: 第1回定例会(3日目)（令和7年3月17日開催）
  const meetingMatch = normalized.match(
    /第(\d+)回(定例会|臨時会)([^（(]*?)(?:[（(][^）)]*日目[）)])?[^（(]*?[（(](?:令和|平成)/
  );
  if (!meetingMatch) return null;

  // 開催日を抽出: （令和X年X月X日開催）または (令和X年X月X日開催)
  const dateMatch = normalized.match(
    /[（(]((?:令和|平成)(?:元|\d+)年\d+月\d+日)開催[）)]/
  );
  if (!dateMatch) return null;

  const heldOn = convertWarekiDateToISO(dateMatch[1]!);
  if (!heldOn) return null;

  const sessionNum = meetingMatch[1]!;
  const meetingKind = meetingMatch[2]!;

  // 日程番号の抽出（複数日の場合）
  const dayMatch = normalized.match(/(\d+)日目/);
  const dayNum = dayMatch ? dayMatch[1] : null;

  const title = dayNum
    ? `第${sessionNum}回${meetingKind}${dayNum}日目`
    : `第${sessionNum}回${meetingKind}`;

  const meetingType = detectMeetingType(meetingKind);

  return { title, heldOn, meetingType };
}

/**
 * 一覧ページ HTML から PDF リンクをパースする。
 *
 * - `irv97600000004s6-att/...pdf` パターンでリンクを抽出
 * - リンクテキストから会議情報をパース
 */
export function parseListPage(html: string): NikiPdfLink[] {
  const results: NikiPdfLink[] = [];

  const pattern = /<a\s[^>]*href="([^"]*\.pdf)"[^>]*>([\s\S]*?)<\/a>/gi;

  let m: RegExpExecArray | null;
  while ((m = pattern.exec(html)) !== null) {
    const href = m[1]!;
    const linkText = m[2]!.replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim();

    const parsed = parseLinkText(linkText);
    if (!parsed) continue;

    // URL を絶対 URL に変換
    const pdfUrl = href.startsWith("http")
      ? href
      : `${BASE_ORIGIN}${href.startsWith("/") ? "" : "/section/gikai/"}${href}`;

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
 * baseUrl から一覧ページ URL を構築し、全 PDF リンクをパースした後、
 * 対象年度のものだけをフィルタリングして返す。
 *
 * baseUrl は自治体コード DB の値（例: https://www.town.niki.hokkaido.jp/section/gikai/）
 * または一覧ページの完全 URL のどちらでも受け付ける。
 *
 * 年度判定: 4月〜翌年3月を1年度とする。
 */
export async function fetchDocumentList(
  baseUrl: string,
  year: number
): Promise<NikiPdfLink[]> {
  // baseUrl がトップページの場合は一覧ページのパスを付加する
  const listUrl = baseUrl.endsWith(".html")
    ? baseUrl
    : `${BASE_ORIGIN}/section/gikai/irv97600000004s6.html`;

  const html = await fetchPage(listUrl);
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
