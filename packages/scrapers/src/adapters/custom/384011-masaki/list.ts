/**
 * 松前町議会（愛媛県）-- list フェーズ
 *
 * 3 段階クロール:
 *  1. 年度一覧トップ (list159.html) から年度別ページ URL を収集
 *  2. 各年度別ページ (list159-{ID}.html) から個別会議ページ URL を収集
 *  3. 各個別会議ページ ({ID}.html) から PDF リンクを収集
 *
 * fetchDetail は MeetingData | null を1件返すため、
 * list フェーズでは PDF リンク単位に1レコードを返す。
 */

import {
  BASE_ORIGIN,
  detectMeetingType,
  parseWarekiYear,
  fetchPage,
  delay,
} from "./shared";

export interface MasakiSessionInfo {
  /** 会議タイトル（例: "令和6（2024）年12月定例会"） */
  title: string;
  /** 開催日 YYYY-MM-DD。月のみ判明する場合は YYYY-MM-01 */
  heldOn: string | null;
  /** PDF の絶対 URL */
  pdfUrl: string;
  /** 会議種別 */
  meetingType: string;
  /** 個別会議ページの ID（externalId 生成用） */
  meetingPageId: string;
}

const INTER_PAGE_DELAY_MS = 1500;

/**
 * 指定年の全 PDF セッション情報を収集する。
 */
export async function fetchSessionList(
  _baseUrl: string,
  year: number
): Promise<MasakiSessionInfo[]> {
  const allSessions: MasakiSessionInfo[] = [];

  // Step 1: 年度一覧トップから年度別ページリンクを収集
  const topUrl = `${BASE_ORIGIN}/site/gikai/list159.html`;
  const topHtml = await fetchPage(topUrl);
  if (!topHtml) return [];

  const yearPageLinks = parseYearPageLinks(topHtml);

  // Step 2: 各年度別ページから個別会議リンクを収集（対象年度のみ）
  for (const yearLink of yearPageLinks) {
    await delay(INTER_PAGE_DELAY_MS);

    const yearHtml = await fetchPage(yearLink.url);
    if (!yearHtml) continue;

    const meetingLinks = parseMeetingLinks(yearHtml);

    // Step 3: 各個別会議ページから PDF リンクを収集
    for (const meetingLink of meetingLinks) {
      // 会議名から年度を判定して対象年度のみを処理
      const seirekiYear = parseWarekiYear(meetingLink.title);
      if (seirekiYear !== null && seirekiYear !== year) continue;

      await delay(INTER_PAGE_DELAY_MS);

      const meetingHtml = await fetchPage(meetingLink.url);
      if (!meetingHtml) continue;

      const pdfLinks = parsePdfLinks(meetingHtml, meetingLink.title, meetingLink.id);
      allSessions.push(...pdfLinks);
    }
  }

  return allSessions;
}

// --- HTML パーサー（テスト用に export） ---

export interface YearPageLink {
  url: string;
  id: string;
}

/**
 * 年度一覧トップページ HTML から年度別ページリンクを抽出する。
 * パターン: /site/gikai/list159-{ID}.html
 */
export function parseYearPageLinks(html: string): YearPageLink[] {
  const links: YearPageLink[] = [];
  const seen = new Set<string>();

  const pattern = /href="(\/site\/gikai\/list159-(\d+)\.html)"/gi;
  let m: RegExpExecArray | null;
  while ((m = pattern.exec(html)) !== null) {
    const path = m[1]!;
    const id = m[2]!;
    if (seen.has(id)) continue;
    seen.add(id);
    links.push({ url: `${BASE_ORIGIN}${path}`, id });
  }

  return links;
}

export interface MeetingLink {
  title: string;
  url: string;
  id: string;
}

/**
 * 年度別ページ HTML から個別会議ページリンクを抽出する。
 * パターン: /site/gikai/{4〜6桁の数字}.html（list159 形式を除外）
 */
export function parseMeetingLinks(html: string): MeetingLink[] {
  const links: MeetingLink[] = [];
  const seen = new Set<string>();

  // アンカータグ全体を抽出してタイトルも取得
  const pattern =
    /<a\s[^>]*href="(\/site\/gikai\/(\d{4,6})\.html)"[^>]*>([^<]+)<\/a>/gi;
  let m: RegExpExecArray | null;
  while ((m = pattern.exec(html)) !== null) {
    const path = m[1]!;
    const id = m[2]!;
    const title = m[3]!.replace(/\s+/g, " ").trim();
    if (seen.has(id)) continue;
    seen.add(id);
    links.push({ title, url: `${BASE_ORIGIN}${path}`, id });
  }

  return links;
}

/**
 * 個別会議ページ HTML から PDF リンクを抽出する。
 *
 * HTML パターン:
 *   <a href="/uploaded/attachment/{ID}.pdf">{会議名} [PDFファイル／NKB]</a>
 */
export function parsePdfLinks(
  html: string,
  meetingTitle: string,
  meetingPageId: string
): MasakiSessionInfo[] {
  const records: MasakiSessionInfo[] = [];
  const seen = new Set<string>();

  const seirekiYear = parseWarekiYear(meetingTitle);
  const meetingType = detectMeetingType(meetingTitle);

  const pattern =
    /<a\s[^>]*href="(\/uploaded\/attachment\/(\d+)\.pdf)"[^>]*>([^<]+)<\/a>/gi;
  let m: RegExpExecArray | null;
  while ((m = pattern.exec(html)) !== null) {
    const path = m[1]!;
    const pdfId = m[2]!;
    const linkText = m[3]!.replace(/\s+/g, " ").trim();

    if (seen.has(pdfId)) continue;
    seen.add(pdfId);

    const heldOn = resolveHeldOn(meetingTitle, seirekiYear);

    // リンクテキストから [PDFファイル...] を除去してタイトルを整形
    const title = linkText.replace(/\s*\[PDFファイル[^\]]*\]/, "").trim() || meetingTitle;

    records.push({
      title,
      heldOn,
      pdfUrl: `${BASE_ORIGIN}${path}`,
      meetingType,
      meetingPageId,
    });
  }

  return records;
}

/**
 * 会議タイトルから開催日 YYYY-MM-DD を推定する。
 * 月は会議タイトルから取得し、日は不明のため 01 とする。
 */
function resolveHeldOn(
  meetingTitle: string,
  seirekiYear: number | null
): string | null {
  if (seirekiYear === null) return null;

  // 会議タイトルから月を抽出（例: "12月定例会" → 12）
  const monthMatch = meetingTitle.match(/(\d{1,2})月/);
  if (!monthMatch?.[1]) return null;

  const month = parseInt(monthMatch[1], 10);
  if (month < 1 || month > 12) return null;

  return `${seirekiYear}-${String(month).padStart(2, "0")}-01`;
}
