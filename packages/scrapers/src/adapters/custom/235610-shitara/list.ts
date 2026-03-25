/**
 * 設楽町議会 — list フェーズ
 *
 * 単一の会議録一覧ページから PDF リンクを収集する。
 *
 * HTML 構造:
 *   単一ページに全年度の会議録が掲載されている（ページネーションなし）
 *   各会議録は <a href="/uploaded/attachment/{ID}.pdf"> 形式のリンク
 *   リンクテキストに会議種別・開催日が含まれる
 *
 * - 全角・半角数字が混在するため正規化が必要
 */

import {
  BASE_ORIGIN,
  eraToWesternYear,
  fetchPage,
  normalizeFullWidth,
} from "./shared";

export interface ShitaraMeeting {
  pdfUrl: string;
  title: string;
  heldOn: string;
  meetingKind: string;
}

/**
 * リンクテキストから会議情報を解析する。
 *
 * テキスト例:
 *   "令和８年第１回設楽町議会臨時会会議録" → { year: 2026, session: 1, kind: "臨時会", ... }
 *   "令和７年第１回定例会第１日" → { year: 2025, session: 1, kind: "定例会", day: 1 }
 *   "令和６年第１回定例会第１日" → { year: 2024, session: 1, kind: "定例会", day: 1 }
 *
 * 注意:
 *   - リンクテキストには日付が直接含まれないことがある
 *   - 「第N日」から日付を直接取得できないため、heldOn はタイトルから生成
 */
export function parseLinkText(linkText: string): {
  year: number;
  session: number;
  meetingKind: string;
  dayInSession: number | null;
} | null {
  const normalized = normalizeFullWidth(linkText.trim());

  // 会議情報を抽出: "令和N年第X回(設楽町議会)?(定例会|臨時会)"
  const sessionMatch = normalized.match(
    /(令和|平成)(元|\d+)年第(\d+)回(?:設楽町議会)?(定例会|臨時会)/
  );
  if (!sessionMatch) return null;

  const era = sessionMatch[1]!;
  const yearStr = sessionMatch[2]!;
  const session = parseInt(sessionMatch[3]!, 10);
  const meetingKind = sessionMatch[4]!;

  const year = eraToWesternYear(era, yearStr);

  // 定例会の「第N日」を抽出
  const dayMatch = normalized.match(/第(\d+)日/);
  const dayInSession = dayMatch ? parseInt(dayMatch[1]!, 10) : null;

  return { year, session, meetingKind, dayInSession };
}

/**
 * PDF の添付ファイル ID から externalId を生成する。
 * e.g., "/uploaded/attachment/4804.pdf" → "shitara_4804"
 */
export function buildExternalId(pdfUrl: string): string | null {
  const match = pdfUrl.match(/\/uploaded\/attachment\/(\d+)\.pdf$/);
  if (!match) return null;
  return `shitara_${match[1]}`;
}

/**
 * 西暦年を和暦文字列に変換する（タイトル生成用）。
 */
function toEraYear(year: number): string {
  if (year >= 2019) {
    const rYear = year - 2018;
    return rYear === 1 ? "令和元年" : `令和${rYear}年`;
  }
  if (year >= 1989) {
    const hYear = year - 1988;
    return hYear === 1 ? "平成元年" : `平成${hYear}年`;
  }
  return `${year}年`;
}

/**
 * 会議録一覧ページの HTML から PDF リンクを抽出する。
 *
 * - 指定年の PDF のみ抽出
 * - heldOn はリンクテキストから日付が取得できない場合は年のみで代替
 */
export function parseListPage(html: string, year: number): ShitaraMeeting[] {
  const results: ShitaraMeeting[] = [];
  const seen = new Set<string>();

  // PDF リンクを抽出: /uploaded/attachment/{ID}.pdf
  const linkRegex =
    /<a\s[^>]*href="([^"]*\/uploaded\/attachment\/\d+\.pdf)"[^>]*>([\s\S]*?)<\/a>/gi;

  for (const match of html.matchAll(linkRegex)) {
    const href = match[1]!;
    const rawText = match[2]!
      .replace(/<[^>]+>/g, "")
      .replace(/\s+/g, " ")
      .trim();

    // 重複を除去
    if (seen.has(href)) continue;
    seen.add(href);

    const info = parseLinkText(rawText);
    if (!info) continue;

    // 対象年のみ抽出
    if (info.year !== year) continue;

    // PDF の絶対 URL を構築
    let pdfUrl: string;
    if (href.startsWith("http")) {
      pdfUrl = href;
    } else if (href.startsWith("//")) {
      pdfUrl = `https:${href}`;
    } else if (href.startsWith("/")) {
      pdfUrl = `${BASE_ORIGIN}${href}`;
    } else {
      pdfUrl = `${BASE_ORIGIN}/${href}`;
    }

    // タイトルを生成
    const eraTitle = toEraYear(info.year);
    let title: string;
    if (info.dayInSession !== null) {
      title = `${eraTitle}第${info.session}回${info.meetingKind}第${info.dayInSession}日`;
    } else {
      title = `${eraTitle}第${info.session}回${info.meetingKind}`;
    }

    // heldOn: リンクテキストには日付が含まれないため、年初を仮の日付とする
    // 実際の日付は PDF 内テキストから取得する
    const heldOn = `${info.year}-01-01`;

    results.push({
      pdfUrl,
      title,
      heldOn,
      meetingKind: info.meetingKind,
    });
  }

  // pdfUrl でソート（添付ファイル ID は時系列順）
  results.sort((a, b) => a.pdfUrl.localeCompare(b.pdfUrl));

  return results;
}

/**
 * 指定年の全 PDF リンクを取得する。
 */
export async function fetchMeetingList(
  baseUrl: string,
  year: number
): Promise<ShitaraMeeting[]> {
  const html = await fetchPage(baseUrl);
  if (!html) return [];

  return parseListPage(html, year);
}
