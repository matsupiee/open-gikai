/**
 * 吉野町議会 — list フェーズ
 *
 * 固定 URL リストを使用して年度別ページから PDF リンクを収集する。
 *
 * HTML 構造（年度別ページ）:
 *   <a href="//www.town.yoshino.nara.jp/material/files/group/20/{ファイル名}.pdf">
 *     令和7年第1回(3月)定例会 (PDFファイル: 1.9MB)
 *   </a>
 *
 * リンクテキスト例:
 *   令和7年第1回(3月)定例会 (PDFファイル: 1.9MB)
 *   令和7年第1回臨時会(4月28日) (PDFファイル: 472.4KB)
 */

import {
  BASE_ORIGIN,
  YEAR_PAGE_MAP,
  detectMeetingType,
  parseWarekiYear,
  fetchPage,
  delay,
} from "./shared";

export interface YoshinoSessionInfo {
  /** 会議タイトル（例: "令和7年第1回(3月)定例会"） */
  title: string;
  /** 開催日 YYYY-MM-DD（解析できない場合は null） */
  heldOn: string | null;
  /** PDF の絶対 URL */
  pdfUrl: string;
  /** 会議種別 */
  meetingType: string;
}

/**
 * リンクテキストから開催月・日を取得する。
 *
 * パターン:
 *   "(3月)" → month=3, day=null
 *   "(4月28日)" → month=4, day=28
 */
export function parseMeetingDate(
  linkText: string,
  year: number,
): { heldOn: string | null; month: number | null } {
  // 日付パターン: (M月D日) または (M月)
  const dateWithDay = linkText.match(/\((\d+)月(\d+)日\)/);
  if (dateWithDay) {
    const month = parseInt(dateWithDay[1]!, 10);
    const day = parseInt(dateWithDay[2]!, 10);
    const mm = String(month).padStart(2, "0");
    const dd = String(day).padStart(2, "0");
    return { heldOn: `${year}-${mm}-${dd}`, month };
  }

  const dateMonthOnly = linkText.match(/\((\d+)月\)/);
  if (dateMonthOnly) {
    const month = parseInt(dateMonthOnly[1]!, 10);
    // 月のみの場合は heldOn を null に（日が不明）
    return { heldOn: null, month };
  }

  return { heldOn: null, month: null };
}

/**
 * 年度別ページから PDF リンクを収集する。
 *
 * 対象リンクパターン: href に "/material/files/group/20/" を含む <a> タグ
 */
export function parseYearPage(html: string, year: number): YoshinoSessionInfo[] {
  const records: YoshinoSessionInfo[] = [];
  const seen = new Set<string>();

  // PDF リンクを抽出: href="/material/files/group/20/..." または href="//www.town.yoshino.nara.jp/material/files/group/20/..."
  const pdfPattern =
    /href="([^"]*\/material\/files\/group\/20\/[^"]*\.pdf)"[^>]*>([\s\S]*?)<\/a>/gi;

  for (const pdfMatch of html.matchAll(pdfPattern)) {
    const rawHref = pdfMatch[1]!;
    const rawText = pdfMatch[2]!.replace(/\s+/g, " ").trim();

    // プロトコル相対 URL または絶対パスを https: に補完
    let pdfUrl: string;
    if (rawHref.startsWith("//")) {
      pdfUrl = `https:${rawHref}`;
    } else if (rawHref.startsWith("http")) {
      pdfUrl = rawHref;
    } else if (rawHref.startsWith("/")) {
      pdfUrl = `${BASE_ORIGIN}${rawHref}`;
    } else {
      continue;
    }

    // 重複チェック
    if (seen.has(pdfUrl)) continue;
    seen.add(pdfUrl);

    // リンクテキストからメタ情報を取得
    // 例: "令和7年第1回(3月)定例会 (PDFファイル: 1.9MB)"
    // テキスト先頭から「令和/平成XX年第X回...定例会/臨時会」を抽出
    const titleMatch = rawText.match(
      /^((?:令和|平成)(?:元|\d+)年第\d+回[^）]*(?:定例会|臨時会))/,
    );
    const title = titleMatch?.[1] ?? rawText.replace(/\s*\(PDFファイル:[^)]*\)/i, "").trim();

    // 年を取得（テキスト中の和暦から）
    const textYear = parseWarekiYear(title) ?? year;

    const { heldOn } = parseMeetingDate(rawText, textYear);
    const meetingType = detectMeetingType(title);

    records.push({
      title,
      heldOn,
      pdfUrl,
      meetingType,
    });
  }

  return records;
}

/**
 * 指定年の会議 PDF リンク一覧を取得する。
 */
export async function fetchSessionList(
  year: number,
): Promise<YoshinoSessionInfo[]> {
  const pageId = YEAR_PAGE_MAP[year];
  if (!pageId) return [];

  const url = `${BASE_ORIGIN}/gikai/kaigiroku/${pageId}.html`;
  await delay(1000);
  const html = await fetchPage(url);
  if (!html) return [];

  return parseYearPage(html, year);
}
