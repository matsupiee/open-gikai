/**
 * 上富田町議会 — list フェーズ
 *
 * 1. インデックスページから年度別詳細ページの URL を収集
 * 2. 対象年に該当する詳細ページから PDF リンクを抽出
 *    - 目次 PDF（mokuji）は除外し、本文 PDF（gijiroku）のみ対象
 *
 * fetchDetail は MeetingData | null を1件返すため、
 * list フェーズでセッション日ごとに1レコードを返す。
 */

import {
  BASE_ORIGIN,
  INDEX_URL,
  detectMeetingType,
  parseWarekiYear,
  fetchPage,
  delay,
} from "./shared";

export interface KamitondaSessionInfo {
  /** 会議タイトル（例: "第4回（12月）定例会 第1日目"） */
  title: string;
  /** 開催日 YYYY-MM-DD（解析できない場合は null） */
  heldOn: string | null;
  /** PDF の絶対 URL */
  pdfUrl: string;
  /** 会議種別 */
  meetingType: string;
  /** ファイル名（externalId 生成用） */
  fileName: string;
}

const INTER_PAGE_DELAY_MS = 1500;

/**
 * 指定年の全セッション日を収集する。
 */
export async function fetchSessionList(
  year: number,
): Promise<KamitondaSessionInfo[]> {
  // Step 1: インデックスページから年度別ページを取得
  const indexHtml = await fetchPage(INDEX_URL);
  if (!indexHtml) return [];

  const yearPages = parseYearPages(indexHtml);

  // 対象年に該当する年度ページを特定
  const targetPages = yearPages.filter((p) => p.year === year);
  if (targetPages.length === 0) return [];

  const allSessions: KamitondaSessionInfo[] = [];

  for (const page of targetPages) {
    await delay(INTER_PAGE_DELAY_MS);

    const detailHtml = await fetchPage(page.url);
    if (!detailHtml) continue;

    const sessions = extractSessionRecords(detailHtml, page.url);
    allSessions.push(...sessions);
  }

  return allSessions;
}

// --- HTML パーサー（テスト用に export） ---

export interface YearPageLink {
  year: number;
  url: string;
}

/**
 * インデックスページから年度別詳細ページリンクを抽出する。
 * リンクパターン: /soshiki/gikai/kaigiroku/{ID}.html
 * テキストパターン: "上富田町議会 令和6年 会議録"
 */
export function parseYearPages(html: string): YearPageLink[] {
  const pages: YearPageLink[] = [];
  const seen = new Set<string>();

  const pattern =
    /href="([^"]*\/soshiki\/gikai\/kaigiroku\/\d+\.html)"[^>]*>([^<]*(?:令和|平成)[^<]*会議録[^<]*)</gi;

  let m: RegExpExecArray | null;
  while ((m = pattern.exec(html)) !== null) {
    const rawHref = m[1]!;
    const linkText = m[2]!;

    const url = rawHref.startsWith("http")
      ? rawHref
      : `${BASE_ORIGIN}${rawHref}`;

    if (seen.has(url)) continue;
    seen.add(url);

    const year = parseWarekiYear(linkText);
    if (year !== null) {
      pages.push({ year, url });
    }
  }

  return pages;
}

/**
 * 年度別詳細ページ HTML からセッション日ごとの PDF レコードを抽出する。
 *
 * - href が .pdf で終わるリンクを全量収集
 * - mokuji（目次）は除外
 * - ファイル名から会議種別・日付を判別
 */
export function extractSessionRecords(
  html: string,
  pageUrl: string,
): KamitondaSessionInfo[] {
  const records: KamitondaSessionInfo[] = [];
  const seen = new Set<string>();

  // PDF リンクを抽出
  const pdfPattern =
    /href="([^"]*\.pdf)"[^>]*>([^<]*)</gi;

  let m: RegExpExecArray | null;
  while ((m = pdfPattern.exec(html)) !== null) {
    const rawHref = m[1]!;
    const linkText = m[2]!.replace(/\s+/g, " ").trim();

    // PDF URL を絶対 URL に変換
    let pdfUrl: string;
    if (rawHref.startsWith("http")) {
      pdfUrl = rawHref;
    } else if (rawHref.startsWith("//")) {
      // プロトコル相対 URL → http: を補完
      pdfUrl = `http:${rawHref}`;
    } else if (rawHref.startsWith("/")) {
      pdfUrl = `${BASE_ORIGIN}${rawHref}`;
    } else {
      const base = pageUrl.replace(/\/[^/]*$/, "/");
      pdfUrl = new URL(rawHref, base).href;
    }

    const fileName = pdfUrl.split("/").pop() ?? rawHref;

    // 目次（mokuji）は除外
    if (fileName.toLowerCase().includes("mokuji")) continue;

    // 重複チェック
    if (seen.has(pdfUrl)) continue;
    seen.add(pdfUrl);

    // リンクテキストから会議情報を取得
    const sessionInfo = parseSessionInfo(linkText, fileName);
    if (!sessionInfo) continue;

    records.push({
      title: sessionInfo.title,
      heldOn: sessionInfo.heldOn,
      pdfUrl,
      meetingType: sessionInfo.meetingType,
      fileName,
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
 * リンクテキストとファイル名からセッション情報を解析する。
 *
 * リンクテキスト例:
 *   "第4回（12月）定例会 第1日目"
 *   "第2回（5月）臨時会 第1日目"
 *
 * ファイル名例:
 *   "20241206Tgijiroku.pdf" → 2024-12-06, 定例会
 *   "202405Rgijiroku.pdf"  → 日付不明（月のみ）, 臨時会
 */
export function parseSessionInfo(
  linkText: string,
  fileName: string,
): SessionInfo | null {
  if (!linkText) return null;

  const meetingType = detectMeetingType(linkText);

  // ファイル名から日付を解析（yyyymmdd 形式）
  const dateMatch = fileName.match(/^(\d{4})(\d{2})(\d{2})[TR]/);
  const monthOnlyMatch = fileName.match(/^(\d{4})(\d{2})[TR]/);

  let heldOn: string | null = null;
  if (dateMatch) {
    const year = dateMatch[1]!;
    const month = dateMatch[2]!;
    const day = dateMatch[3]!;
    heldOn = `${year}-${month}-${day}`;
  } else if (monthOnlyMatch) {
    // 月のみの場合（202405Rgijiroku.pdf 等）は日付を null に
    heldOn = null;
  }

  return {
    title: linkText,
    heldOn,
    meetingType,
  };
}
