/**
 * 阿蘇市議会 — list フェーズ
 *
 * 年度別ページから会議録 PDF のリンクを収集する。
 *
 * ページ構造:
 * - h3: セッション名（例: "令和7年 第4回 定例会"）
 * - h4: 会期（例: "会期：令和7年5月30日"）
 * - PDF リンク: <a href="/files/uploads/YYYY/MM/filename.pdf">リンクテキスト</a>
 *
 * 会議録 PDF のみを抽出し、議案一覧・通告書・審議結果などは除外する。
 */

import { BASE_ORIGIN, buildYearPageUrl, fetchPage } from "./shared";

export interface AsoMeeting {
  /** PDF の完全 URL */
  pdfUrl: string;
  /** ドキュメントタイトル（セッション名 + リンクテキスト） */
  title: string;
  /** セッション名（例: "令和7年 第4回 定例会"） */
  sessionName: string;
  /** 会期の日付テキスト（例: "令和7年5月30日"） */
  sessionDate: string;
  /** 開催日 YYYY-MM-DD */
  heldOn: string;
}

/**
 * 会期テキストから YYYY-MM-DD を抽出する。
 * e.g., "会期：令和7年5月30日" → "2025-05-30"
 * e.g., "会期：平成30年8月31日～9月21日" → "2018-08-31"（開始日を使用）
 */
export function parseSessionDate(text: string): string | null {
  const match = text.match(/(令和|平成)(元|\d+)年(\d+)月(\d+)日/);
  if (!match) return null;

  const [, era, eraYearStr, monthStr, dayStr] = match;
  const eraYear = eraYearStr === "元" ? 1 : parseInt(eraYearStr!, 10);
  const month = parseInt(monthStr!, 10);
  const day = parseInt(dayStr!, 10);

  let westernYear: number;
  if (era === "令和") westernYear = eraYear + 2018;
  else if (era === "平成") westernYear = eraYear + 1988;
  else return null;

  return `${westernYear}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

/**
 * リンクテキストから日付テキスト部分の YYYY-MM-DD を抽出する。
 * e.g., "12月 3日　議案質疑・委員会付託" → 月=12, 日=3
 * e.g., "8月31日　開会・諸般の報告・提案理由の説明" → 月=8, 日=31
 *
 * 年はセッションの heldOn から推定する。
 */
export function parseLinkDate(
  linkText: string,
  sessionHeldOn: string
): string | null {
  // "12月 3日" or "12月3日" or "12月13日" パターン
  const match = linkText.match(/(\d{1,2})月\s*(\d{1,2})日/);
  if (!match) return null;

  const month = parseInt(match[1]!, 10);
  const day = parseInt(match[2]!, 10);

  // セッションの年を使う
  const year = parseInt(sessionHeldOn.slice(0, 4), 10);

  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

/** PDF リンクが会議録であるかを判定する */
function isMinutesPdf(linkText: string, href: string): boolean {
  // 除外: 議案一覧・通告書・審議結果・決議
  const excludeTexts = [
    "議案一覧",
    "一般質問通告書",
    "審議結果",
    "追加議案",
    "決議",
  ];
  for (const t of excludeTexts) {
    if (linkText.includes(t)) return false;
  }

  // 除外: ファイル名ベース
  const excludePatterns = [
    /giann/i,
    /gian_/i,
    /bill_list/i,
    /question_list/i,
    /question_notice/i,
    /general_interpellation/i,
    /deliberation_result/i,
    /eliberation_result/i,
  ];
  for (const p of excludePatterns) {
    if (p.test(href)) return false;
  }

  // 会議録に該当するリンクテキスト
  const minutesTexts = [
    "目次",
    "開会",
    "議案質疑",
    "委員長報告",
    "一般質問",
    "会議録",
    "議事録",
  ];
  for (const t of minutesTexts) {
    if (linkText.includes(t)) return true;
  }

  // ファイル名に _teirei_ or _rinji_ が含まれる場合は会議録
  if (/_teirei_/i.test(href) || /_rinji_/i.test(href)) return true;

  // 日付パターン（例: "12月 3日　議案質疑"）を含むリンクも会議録
  if (/\d{1,2}月\s*\d{1,2}日/.test(linkText)) return true;

  return false;
}

/**
 * 年度別ページの HTML から会議録 PDF リンクを抽出する（テスト可能な純粋関数）。
 *
 * 実際のページ構造:
 * - h2: セッション名（例: "令和7年 第4回 定例会"）
 * - h3: 会期（例: "会期：令和7年5月30日"）
 * - h4: 一部の古い年度で会期見出しに使われる場合がある
 */
export function parseYearPage(html: string): AsoMeeting[] {
  const results: AsoMeeting[] = [];

  // h2/h3 セッション見出しの位置を収集（定例会/臨時会を含むもの）
  const sessions: { index: number; name: string }[] = [];
  const sessionPattern = /<h[23][^>]*>([\s\S]*?)<\/h[23]>/gi;
  for (const match of html.matchAll(sessionPattern)) {
    const text = match[1]!.replace(/<[^>]+>/g, "").trim();
    if (text.includes("定例会") || text.includes("臨時会")) {
      sessions.push({ index: match.index!, name: text });
    }
  }

  // h3/h4 会期の位置を収集（"会期："を含むもの）
  const sessionDates: { index: number; dateText: string; heldOn: string }[] =
    [];
  const dateHeadingPattern = /<h[34][^>]*>([\s\S]*?)<\/h[34]>/gi;
  for (const match of html.matchAll(dateHeadingPattern)) {
    const text = match[1]!.replace(/<[^>]+>/g, "").trim();
    const heldOn = parseSessionDate(text);
    if (heldOn) {
      sessionDates.push({ index: match.index!, dateText: text, heldOn });
    }
  }

  // PDF リンクを抽出
  const linkPattern =
    /<a[^>]+href="([^"]+\.pdf)"[^>]*>([\s\S]*?)<\/a>/gi;

  for (const match of html.matchAll(linkPattern)) {
    const linkIndex = match.index!;
    const href = match[1]!;
    const linkText = match[2]!.replace(/<[^>]+>/g, "").trim();

    if (!isMinutesPdf(linkText, href)) continue;

    // 現在のセッションを特定
    let currentSession = "";
    for (const session of sessions) {
      if (session.index < linkIndex) {
        currentSession = session.name;
      }
    }

    // 現在の会期日付を特定
    let currentDateText = "";
    let currentHeldOn = "";
    for (const sd of sessionDates) {
      if (sd.index < linkIndex) {
        currentDateText = sd.dateText;
        currentHeldOn = sd.heldOn;
      }
    }

    // PDF の完全 URL を構築
    let pdfUrl: string;
    if (href.startsWith("http")) {
      pdfUrl = href;
    } else if (href.startsWith("/")) {
      pdfUrl = `${BASE_ORIGIN}${href}`;
    } else {
      pdfUrl = `${BASE_ORIGIN}/${href}`;
    }

    // リンクテキストから日付を抽出して heldOn を上書き
    const linkDate = parseLinkDate(linkText, currentHeldOn);
    const heldOn = linkDate || currentHeldOn;

    // タイトルを構築（サイズ表記 [232KB] を除去）
    const cleanLinkText = linkText
      .replace(/\[[\d.]+[KMG]B\]/gi, "")
      .trim();
    const title = currentSession
      ? `${currentSession} ${cleanLinkText}`
      : cleanLinkText;

    results.push({
      pdfUrl,
      title,
      sessionName: currentSession,
      sessionDate: currentDateText,
      heldOn,
    });
  }

  return results;
}

/**
 * 指定年の全会議録 PDF リンクを取得する。
 */
export async function fetchMeetingList(year: number): Promise<AsoMeeting[]> {
  const pageUrl = buildYearPageUrl(year);
  if (!pageUrl) return [];

  const html = await fetchPage(pageUrl);
  if (!html) return [];

  return parseYearPage(html);
}
