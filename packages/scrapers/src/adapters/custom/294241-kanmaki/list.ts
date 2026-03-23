/**
 * 上牧町議会 — list フェーズ
 *
 * 一覧ページ（353.html）から会議録セクションの PDF リンクを収集する。
 *
 * HTML 構造:
 *   <h2>会議録</h2>
 *   <p><a href="//www.town.kanmaki.nara.jp/material/files/group/17/xxx.pdf">
 *     令和7年第4回（12月）上牧町定例会会議録 (PDFファイル: 2.6MB)
 *   </a></p>
 *   ...次の <h2> まで続く
 */

import { LIST_URL, detectMeetingType, parseWarekiYear, fetchPage } from "./shared";

export interface KanmakiSessionInfo {
  /** 会議タイトル（例: "令和7年第4回（12月）上牧町定例会会議録"） */
  title: string;
  /** 開催日 YYYY-MM-DD（解析できない場合は null） */
  heldOn: string | null;
  /** PDF の絶対 URL */
  pdfUrl: string;
  /** 会議種別 */
  meetingType: string;
  /** リンクテキスト（externalId 生成用の元テキスト） */
  linkText: string;
}

/**
 * 会議録一覧ページから PDF リンクを収集する。
 */
export async function fetchSessionList(
  year: number,
): Promise<KanmakiSessionInfo[]> {
  const html = await fetchPage(LIST_URL);
  if (!html) return [];

  const allRecords = parseMinutesLinks(html);

  // 対象年のレコードのみフィルタリング
  return allRecords.filter((record) => {
    const recordYear = parseWarekiYear(record.linkText);
    return recordYear === year;
  });
}

// --- HTML パーサー（テスト用に export） ---

/**
 * 一覧ページの HTML から「会議録」セクションの PDF リンクを抽出する。
 *
 * <h2>会議録</h2> と次の <h2> の間にある <a href="...pdf"> を対象とする。
 */
export function parseMinutesLinks(html: string): KanmakiSessionInfo[] {
  const records: KanmakiSessionInfo[] = [];
  const seen = new Set<string>();

  // 「会議録」セクションを切り出す
  // <h2>...</h2>（span ネストあり）と次の <h2> の間を抽出
  const sectionMatch = html.match(
    /<h2[^>]*>(?:<[^>]+>)*[^<]*会議録[^<]*(?:<\/[^>]+>)*<\/h2>([\s\S]*?)(?=<h2|$)/i,
  );
  if (!sectionMatch?.[1]) return [];

  const sectionHtml = sectionMatch[1];

  // PDF リンクを抽出
  const pdfPattern = /href="([^"]*\.pdf)"[^>]*>([\s\S]*?)<\/a>/gi;
  let m: RegExpExecArray | null;

  while ((m = pdfPattern.exec(sectionHtml)) !== null) {
    const rawHref = m[1]!;
    const rawText = m[2]!.replace(/\s+/g, " ").trim();

    // プロトコル相対 URL を https: に補完
    let pdfUrl: string;
    if (rawHref.startsWith("//")) {
      pdfUrl = `https:${rawHref}`;
    } else if (rawHref.startsWith("http")) {
      pdfUrl = rawHref;
    } else if (rawHref.startsWith("/")) {
      pdfUrl = `https://www.town.kanmaki.nara.jp${rawHref}`;
    } else {
      continue;
    }

    // 重複チェック
    if (seen.has(pdfUrl)) continue;
    seen.add(pdfUrl);

    // リンクテキストからメタ情報を解析
    const sessionInfo = parseSessionInfo(rawText);
    if (!sessionInfo) continue;

    records.push({
      title: sessionInfo.title,
      heldOn: sessionInfo.heldOn,
      pdfUrl,
      meetingType: sessionInfo.meetingType,
      linkText: rawText,
    });
  }

  return records;
}

interface SessionInfo {
  title: string;
  heldOn: string | null;
  meetingType: string;
}

/**
 * リンクテキストからセッション情報を解析する。
 *
 * テキスト例:
 *   "令和7年_第4回（12月）上牧町臨時会会議録 (PDFファイル: 263.3KB)"
 *   "令和7年第4回（12月）上牧町定例会会議録 (PDFファイル: 2.6MB)"
 *   "令和6年_第3回（9月）上牧町議会定例会会議録 (PDFファイル: 5.1MB)"
 *
 * パターン: (令和|平成)X年_?第N回（M月）上牧町(?:議会)?(定例会|臨時会)会議録
 */
export function parseSessionInfo(linkText: string): SessionInfo | null {
  if (!linkText) return null;

  // メタ情報抽出パターン
  const metaPattern =
    /^((?:令和|平成)\d+年)_?第(\d+)回（(\d+)月）上牧町(?:議会)?(定例会|臨時会)会議録/;
  const match = linkText.match(metaPattern);
  if (!match) return null;

  const yearText = match[1]!;
  const month = parseInt(match[3]!, 10);
  const sessionType = match[4] as "定例会" | "臨時会";

  const year = parseWarekiYear(yearText);
  if (year === null) return null;

  // heldOn: 年と月から YYYY-MM-DD を生成（日は不明なので月の1日とはせず null）
  // ただし year と month が揃っていれば月初を使う
  const heldOn = buildHeldOn(year, month);

  // タイトルは (PDFファイル: ...) を除いた部分
  const title = linkText.replace(/\s*\(PDFファイル:[^)]*\)\s*$/, "").trim();

  const meetingType = detectMeetingType(sessionType);

  return {
    title,
    heldOn,
    meetingType,
  };
}

/**
 * 年・月から heldOn (YYYY-MM-01) を生成する。
 * 日は会議録テキストから特定できないため、月の1日とする。
 * 解析できない場合は null を返す。
 */
function buildHeldOn(year: number, month: number): string | null {
  if (!year || !month || month < 1 || month > 12) return null;
  const mm = String(month).padStart(2, "0");
  return `${year}-${mm}-01`;
}
