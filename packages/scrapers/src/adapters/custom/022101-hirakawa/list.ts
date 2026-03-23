/**
 * 平川市議会 — list フェーズ
 *
 * 単一の HTML ページ (kaigiroku.html) に全年度の会議録 PDF リンクが掲載されている。
 *
 * 見出し階層:
 *   <h2> 年度（令和７年会議録一覧 etc.）
 *     <h3> 会議種別（定例会 / 臨時会）
 *       <h4> 個別会議（令和７年第４回定例会 etc.）
 *         <p><a href="...pdf"> or <li><a href="...pdf">
 *
 * リンクテキスト例: "第１日12月２日", "第1号12月6日", "目次"
 */

import { BASE_ORIGIN, eraToWestern, fetchPage } from "./shared";

export interface HirakawaMeeting {
  pdfUrl: string;
  title: string;
  heldOn: string; // YYYY-MM-DD
  section: string; // h4 見出し（例: "令和７年第４回定例会"）
}

/**
 * リンクテキストから開催日を抽出する。
 * e.g., "第１日12月２日" → { month: 12, day: 2 }
 *       "第1号12月6日"  → { month: 12, day: 6 }
 */
export function parseLinkDate(
  linkText: string
): { month: number; day: number } | null {
  // 全角数字を半角に変換
  const normalized = linkText.replace(/[０-９]/g, (ch) =>
    String.fromCharCode(ch.charCodeAt(0) - 0xfee0)
  );
  const match = normalized.match(/(?:第\d+[日号])\s*(\d{1,2})月(\d{1,2})日/);
  if (!match) return null;
  return { month: Number(match[1]), day: Number(match[2]) };
}

/**
 * h4 見出しから西暦年を抽出する。
 * e.g., "令和７年第４回定例会" → 2025, "平成24年第4回定例会" → 2012
 */
export function extractYearFromHeading(heading: string): number | null {
  // 全角数字を半角に変換
  const normalized = heading.replace(/[０-９]/g, (ch) =>
    String.fromCharCode(ch.charCodeAt(0) - 0xfee0)
  );
  const match = normalized.match(/(令和|平成)(元|\d+)年/);
  if (!match) return null;
  return eraToWestern(match[1]!, match[2]!);
}

/**
 * 単一 HTML ページから全 PDF リンクとメタ情報を抽出する（テスト可能な純粋関数）。
 *
 * year を指定すると、その西暦年の会議録のみを返す。
 */
export function parseListPage(
  html: string,
  year?: number
): HirakawaMeeting[] {
  const results: HirakawaMeeting[] = [];

  // h4 見出しの位置を収集
  const h4Pattern = /<h4[^>]*>([\s\S]*?)<\/h4>/gi;
  const headings: { index: number; text: string; year: number | null }[] = [];
  for (const match of html.matchAll(h4Pattern)) {
    const text = match[1]!.replace(/<[^>]+>/g, "").trim();
    headings.push({
      index: match.index!,
      text,
      year: extractYearFromHeading(text),
    });
  }

  // PDF URL のベースパス
  const basePath = "/jouhou/gikai/nittei/";

  // PDF リンクを抽出
  const linkPattern = /<a[^>]+href="([^"]+\.pdf)"[^>]*>([\s\S]*?)<\/a>/gi;
  for (const match of html.matchAll(linkPattern)) {
    const linkIndex = match.index!;
    const href = match[1]!;
    const linkText = match[2]!.replace(/<[^>]+>/g, "").trim();

    // 目次はスキップ
    if (linkText.includes("目次") || href.includes("mokuji")) continue;

    // 現在の h4 見出しを特定
    let currentHeading: (typeof headings)[0] | null = null;
    for (const h of headings) {
      if (h.index < linkIndex) {
        currentHeading = h;
      }
    }
    if (!currentHeading) continue;

    // 年フィルタリング
    if (year !== undefined && currentHeading.year !== year) continue;

    // リンクテキストから月日を取得
    const dateInfo = parseLinkDate(linkText);
    if (!dateInfo) continue;

    const meetingYear = currentHeading.year;
    if (!meetingYear) continue;

    const heldOn = `${meetingYear}-${String(dateInfo.month).padStart(2, "0")}-${String(dateInfo.day).padStart(2, "0")}`;

    // PDF URL を構築
    let pdfUrl: string;
    if (href.startsWith("http")) {
      pdfUrl = href;
    } else if (href.startsWith("/")) {
      pdfUrl = `${BASE_ORIGIN}${href}`;
    } else if (href.startsWith("files/")) {
      pdfUrl = `${BASE_ORIGIN}${basePath}${href}`;
    } else {
      pdfUrl = `${BASE_ORIGIN}${basePath}${href}`;
    }

    results.push({
      pdfUrl,
      title: currentHeading.text,
      heldOn,
      section: currentHeading.text,
    });
  }

  return results;
}

/**
 * 指定年の全会議録 PDF リンクを取得する。
 */
export async function fetchMeetingList(
  baseUrl: string,
  year: number
): Promise<HirakawaMeeting[]> {
  const html = await fetchPage(baseUrl);
  if (!html) return [];

  return parseListPage(html, year);
}
