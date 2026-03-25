/**
 * 内子町議会（愛媛県）-- list フェーズ
 *
 * 3 段階クロール:
 *  1. 全年度一覧トップ (list591.html) から会議種別一覧ページ URL を収集
 *  2. 各会議種別一覧ページ (list{カテゴリID}-{サブID}.html) から会議録詳細ページ URL を収集
 *  3. 各会議録詳細ページ ({ページID}.html) から PDF リンクを収集
 *
 * URL 構造:
 *   全年度一覧:     https://www.town.uchiko.ehime.jp/site/kaigiroku/list591.html
 *   会議種別一覧:   https://www.town.uchiko.ehime.jp/site/kaigiroku/list{カテゴリID}-{サブID}.html
 *   会議録詳細:     https://www.town.uchiko.ehime.jp/site/kaigiroku/{ページID}.html
 *   PDF:           https://www.town.uchiko.ehime.jp/uploaded/life/{ページID}_{ファイルID}_misc.pdf
 */

import {
  BASE_ORIGIN,
  detectMeetingType,
  parseWarekiYear,
  fetchPage,
  delay,
} from "./shared";

export interface UchikoSessionInfo {
  /** 会議タイトル（例: "令和７年１２月第１５２回内子町議会定例会会議録"） */
  title: string;
  /** 開催年（西暦）*/
  year: number | null;
  /** 開催月 */
  month: number | null;
  /** 開催日（解析できる場合のみ） */
  day: number | null;
  /** 開催日 YYYY-MM-DD（解析できない場合は null） */
  heldOn: string | null;
  /** PDF の絶対 URL */
  pdfUrl: string;
  /** 会議種別 */
  meetingType: string;
  /** 詳細ページの ID（externalId 生成用） */
  pageId: string;
}

const INTER_PAGE_DELAY_MS = 1500;

const TOP_URL = `${BASE_ORIGIN}/site/kaigiroku/list591.html`;

/**
 * 指定年の全 PDF セッション情報を収集する。
 */
export async function fetchSessionList(
  _baseUrl: string,
  year: number
): Promise<UchikoSessionInfo[]> {
  const allSessions: UchikoSessionInfo[] = [];

  // Step 1: 全年度一覧トップから会議種別一覧ページリンクを収集
  const topHtml = await fetchPage(TOP_URL);
  if (!topHtml) return [];

  const meetingListUrls = parseMeetingListUrls(topHtml);

  // Step 2: 各会議種別一覧ページから詳細ページリンクを収集
  for (const listUrl of meetingListUrls) {
    await delay(INTER_PAGE_DELAY_MS);

    const listHtml = await fetchPage(listUrl);
    if (!listHtml) continue;

    const detailUrls = parseDetailUrls(listHtml);

    // Step 3: 各詳細ページから PDF リンクを収集
    for (const detailUrl of detailUrls) {
      await delay(INTER_PAGE_DELAY_MS);

      const detailHtml = await fetchPage(detailUrl);
      if (!detailHtml) continue;

      const pageId = extractPageId(detailUrl);
      if (!pageId) continue;

      const sessions = parseDetailPage(detailHtml, pageId);

      // 対象年のものだけ追加
      for (const session of sessions) {
        if (session.year === year) {
          allSessions.push(session);
        }
      }
    }
  }

  return allSessions;
}

// --- HTML パーサー（テスト用に export） ---

/**
 * 全年度一覧ページから会議種別一覧ページの URL を抽出する。
 *
 * パターン: /site/kaigiroku/list{カテゴリID}-{サブID}.html
 */
export function parseMeetingListUrls(html: string): string[] {
  const urls: string[] = [];
  const seen = new Set<string>();

  const pattern =
    /href="(?:https?:\/\/www\.town\.uchiko\.ehime\.jp)?(\/site\/kaigiroku\/list(\d+-\d+)\.html)"/gi;
  let m: RegExpExecArray | null;
  while ((m = pattern.exec(html)) !== null) {
    const path = m[1]!;
    const id = m[2]!;
    if (seen.has(id)) continue;
    seen.add(id);
    urls.push(`${BASE_ORIGIN}${path}`);
  }

  return urls;
}

/**
 * 会議種別一覧ページから会議録詳細ページの URL を抽出する。
 *
 * パターン: /site/kaigiroku/{数値のみ}.html（list から始まらない）
 */
export function parseDetailUrls(html: string): string[] {
  const urls: string[] = [];
  const seen = new Set<string>();

  const pattern =
    /href="(?:https?:\/\/www\.town\.uchiko\.ehime\.jp)?(\/site\/kaigiroku\/(\d+)\.html)"/gi;
  let m: RegExpExecArray | null;
  while ((m = pattern.exec(html)) !== null) {
    const path = m[1]!;
    const id = m[2]!;
    if (seen.has(id)) continue;
    seen.add(id);
    urls.push(`${BASE_ORIGIN}${path}`);
  }

  return urls;
}

/**
 * 詳細ページ URL からページ ID を抽出する。
 *
 * 例: https://www.town.uchiko.ehime.jp/site/kaigiroku/145604.html → "145604"
 */
export function extractPageId(url: string): string | null {
  const m = url.match(/\/site\/kaigiroku\/(\d+)\.html/);
  return m?.[1] ?? null;
}

/**
 * 会議録詳細ページ HTML からタイトルと PDF URL を抽出する。
 *
 * ページタイトル例: 「令和７年１２月第１５２回内子町議会定例会会議録」
 * PDF URL パターン: /uploaded/life/{ページID}_{ファイルID}_misc.pdf
 */
export function parseDetailPage(
  html: string,
  pageId: string
): UchikoSessionInfo[] {
  const sessions: UchikoSessionInfo[] = [];

  // タイトルを抽出（h1 またはページタイトルから）
  const title = extractTitle(html);

  // 年月を抽出
  const { year, month } = parseTitleYearMonth(title);

  // heldOn を組み立て（月のみわかる場合は1日とする）
  let heldOn: string | null = null;
  if (year !== null && month !== null) {
    heldOn = `${year}-${String(month).padStart(2, "0")}-01`;
  }

  const meetingType = detectMeetingType(title);

  // PDF リンクを抽出
  const pdfPattern = /href="(\/uploaded\/life\/\d+_\d+_misc\.pdf)"/gi;
  let m: RegExpExecArray | null;
  const seen = new Set<string>();

  while ((m = pdfPattern.exec(html)) !== null) {
    const pdfPath = m[1]!;
    const pdfUrl = `${BASE_ORIGIN}${pdfPath}`;

    if (seen.has(pdfUrl)) continue;
    seen.add(pdfUrl);

    sessions.push({
      title,
      year,
      month,
      day: null,
      heldOn,
      pdfUrl,
      meetingType,
      pageId,
    });
  }

  return sessions;
}

/**
 * HTML から会議録タイトルを抽出する。
 * h1 タグを優先し、なければ title タグを使用する。
 */
export function extractTitle(html: string): string {
  // h1 タグから取得
  const h1Match = html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i);
  if (h1Match) {
    const text = h1Match[1]!.replace(/<[^>]+>/g, "").trim();
    if (text) return normalizeText(text);
  }

  // title タグから取得
  const titleMatch = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  if (titleMatch) {
    const text = titleMatch[1]!
      .replace(/<[^>]+>/g, "")
      .trim()
      .split("|")[0]!
      .trim();
    if (text) return normalizeText(text);
  }

  return "";
}

/**
 * 全角数字を半角に変換する。
 */
export function normalizeText(text: string): string {
  return text.replace(/[０-９]/g, (c) =>
    String.fromCharCode(c.charCodeAt(0) - 0xfee0)
  );
}

/**
 * 会議録タイトルから年と月を抽出する。
 *
 * 例:
 *   "令和7年12月第152回内子町議会定例会会議録" → { year: 2025, month: 12 }
 *   "令和7年1月内子町議会臨時会会議録" → { year: 2025, month: 1 }
 *   "平成25年3月第123回内子町議会定例会会議録" → { year: 2013, month: 3 }
 */
export function parseTitleYearMonth(title: string): {
  year: number | null;
  month: number | null;
} {
  const normalized = normalizeText(title);
  const year = parseWarekiYear(normalized);

  const monthMatch = normalized.match(/年(\d{1,2})月/);
  const month = monthMatch ? parseInt(monthMatch[1]!, 10) : null;

  return { year, month };
}
