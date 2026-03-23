/**
 * 板倉町議会 -- list フェーズ
 *
 * 1. 年度別ページ（d000070/d000030/d000NNN/index.html）から詳細ページ URL を収集
 * 2. 各詳細ページから PDF リンクを抽出し、会議ごとの情報を返す
 *
 * fetchDetail は MeetingData | null を1件返すため、
 * list フェーズでは PDF ごとに1レコードを返す。
 */

import {
  BASE_ORIGIN,
  detectMeetingType,
  parseWarekiYear,
  yearToPathSegment,
  fetchPage,
  delay,
} from "./shared";

export interface ItakuraSessionInfo {
  /** 会議タイトル（例: "令和6年 第4回定例会（12月） 本会議"） */
  title: string;
  /** 開催日 YYYY-MM-DD（詳細ページから得られる最初の日付） */
  heldOn: string;
  /** PDF の絶対 URL */
  pdfUrl: string;
  /** 会議種別 */
  meetingType: string;
  /** 詳細ページの URL（externalId 生成用） */
  detailUrl: string;
}

const INTER_PAGE_DELAY_MS = 1500;

/**
 * 指定年の全セッション情報を収集する。
 */
export async function fetchSessionList(
  _baseUrl: string,
  year: number
): Promise<ItakuraSessionInfo[]> {
  const segment = yearToPathSegment(year);
  if (!segment) return [];

  const yearPageUrl = `${BASE_ORIGIN}/d000070/d000030/${segment}/index.html`;
  const yearHtml = await fetchPage(yearPageUrl);
  if (!yearHtml) return [];

  const detailLinks = parseDetailLinks(yearHtml, yearPageUrl);
  const allSessions: ItakuraSessionInfo[] = [];

  for (const link of detailLinks) {
    await delay(INTER_PAGE_DELAY_MS);

    const detailHtml = await fetchPage(link.url);
    if (!detailHtml) continue;

    const sessions = extractPdfRecords(detailHtml, link.url, year);
    allSessions.push(...sessions);
  }

  return allSessions;
}

// --- HTML パーサー（テスト用に export） ---

export interface DetailLink {
  url: string;
}

/**
 * 年度別ページ HTML から詳細ページリンクを抽出する。
 * パターン: href="../../../cont/s034000/d034010/{ID}.html"
 */
export function parseDetailLinks(html: string, baseUrl: string): DetailLink[] {
  const links: DetailLink[] = [];
  const seen = new Set<string>();

  const pattern = /href="([^"]*\/cont\/s034000\/d034010\/[^"]+\.html)"/gi;
  let m: RegExpExecArray | null;

  while ((m = pattern.exec(html)) !== null) {
    const href = m[1]!;
    const absolute = new URL(href, baseUrl).toString();

    if (seen.has(absolute)) continue;
    seen.add(absolute);

    links.push({ url: absolute });
  }

  return links;
}

/**
 * 詳細ページ HTML から会議タイトル・開催日・PDF リンクを抽出する。
 */
export function extractPdfRecords(
  html: string,
  detailUrl: string,
  year: number
): ItakuraSessionInfo[] {
  const records: ItakuraSessionInfo[] = [];

  // 会議タイトルを抽出: <h2> や <h1> から取得
  // 例: "令和6年 第4回定例会（12月）"
  const titleMatch =
    html.match(/<h[12][^>]*>([^<]*(?:定例会|臨時会|委員会)[^<]*)<\/h[12]>/i) ??
    html.match(/<title>([^<]*(?:定例会|臨時会|委員会)[^<]*)<\/title>/i);
  const rawTitle = titleMatch?.[1]?.replace(/\s+/g, " ").trim() ?? "";

  const sessionYear = parseWarekiYear(rawTitle) ?? year;
  const meetingType = detectMeetingType(rawTitle);

  // 開催日一覧を抽出
  // 例: "12月10日"、"12月11日" など
  const datePattern = /(\d{1,2})月(\d{1,2})日/g;
  const dates: string[] = [];
  let dm: RegExpExecArray | null;
  while ((dm = datePattern.exec(html)) !== null) {
    const month = parseInt(dm[1]!, 10);
    const day = parseInt(dm[2]!, 10);
    const iso = `${sessionYear}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    if (!dates.includes(iso)) {
      dates.push(iso);
    }
  }
  // 最初の開催日をデフォルトとして使用
  const firstDate = dates[0] ?? null;

  // PDF リンクを抽出
  // パターン: href="../d034040/{filename}.pdf"
  const pdfPattern = /href="([^"]*d034040\/[^"]+\.pdf)"[^>]*>([^<]+)</gi;
  let m: RegExpExecArray | null;
  while ((m = pdfPattern.exec(html)) !== null) {
    const href = m[1]!;
    const linkText = m[2]!.replace(/\s+/g, " ").trim();

    const pdfUrl = new URL(href, detailUrl).toString();

    // PDF の種別をリンクテキストから取得
    // 例: "本会議（12月10日、12月11日、12月12日、12月13日）（PDF:3,597 KB）"
    //     "予算決算常任委員会　補正予算審査（12月10日）（PDF:258 KB）"
    const kindLabel = linkText.split(/[（(]/)[0]?.replace(/\s+/g, " ").trim() ?? "";

    // PDF に含まれる最初の開催日を特定
    // リンクテキストの日付を優先
    const pdfDateMatch = linkText.match(/(\d{1,2})月(\d{1,2})日/);
    let heldOn: string | null = null;
    if (pdfDateMatch) {
      const month = parseInt(pdfDateMatch[1]!, 10);
      const day = parseInt(pdfDateMatch[2]!, 10);
      heldOn = `${sessionYear}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    } else {
      heldOn = firstDate;
    }

    if (!heldOn) continue;

    // タイトル: 会議タイトル + PDF 種別
    const title = rawTitle
      ? kindLabel
        ? `${rawTitle} ${kindLabel}`
        : rawTitle
      : kindLabel;

    records.push({
      title,
      heldOn,
      pdfUrl,
      meetingType,
      detailUrl,
    });
  }

  return records;
}
