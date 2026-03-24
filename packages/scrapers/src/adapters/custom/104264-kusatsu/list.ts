/**
 * 草津町議会（群馬県） — list フェーズ
 *
 * 一覧ページ（単一ページ）から PDF リンクを収集し、
 * アンカーテキストをパースして年度・回次・会議種別を取得する。
 *
 * パターン: "令和{N}年第{M}回草津町議会{定例会|臨時会}会議録"
 */

import {
  BASE_ORIGIN,
  LIST_PAGE_PATH,
  detectMeetingType,
  fetchPage,
  delay,
} from "./shared";

export interface KusatsuSessionInfo {
  /** 会議タイトル（例: "令和6年第2回草津町議会定例会会議録"） */
  title: string;
  /** 開催年（西暦）。アンカーテキストから解析 */
  year: number | null;
  /** PDF の絶対 URL */
  pdfUrl: string;
  /** 会議種別 */
  meetingType: "plenary" | "extraordinary" | "committee";
}

const INTER_PAGE_DELAY_MS = 1500;

/** アンカーテキストから草津町議会会議録のセッション情報を解析する */
export function parseLinkText(
  linkText: string,
  pdfUrl: string
): KusatsuSessionInfo | null {
  // パターン: "令和{N}年第{M}回草津町議会{定例会|臨時会}会議録"
  const m = /^(令和|平成)(元|\d+)年第(\d+)回草津町議会(定例会|臨時会)会議録/.exec(
    linkText
  );
  if (!m) return null;

  const era = m[1]!;
  const yearNum = m[2]!;
  const n = yearNum === "元" ? 1 : parseInt(yearNum, 10);
  const westernYear = era === "令和" ? 2018 + n : 1988 + n;
  const meetingKind = m[4]!;

  return {
    title: linkText.trim(),
    year: westernYear,
    pdfUrl,
    meetingType: detectMeetingType(meetingKind),
  };
}

/** 一覧ページ HTML から PDF リンクを抽出する */
export function extractPdfLinks(
  html: string
): Array<{ pdfUrl: string; linkText: string }> {
  const results: Array<{ pdfUrl: string; linkText: string }> = [];

  // href が .pdf で終わるリンクを抽出
  const pdfPattern = /<a\s[^>]*href="([^"]*\.pdf)"[^>]*>([^<]*)<\/a>/gi;

  let m: RegExpExecArray | null;
  while ((m = pdfPattern.exec(html)) !== null) {
    const href = m[1]!.trim();
    const rawText = m[2]!.trim();

    if (!href || !rawText) continue;

    // "(PDF文書：XXX)" や "(PDFファイル：XXX)" 等のファイルサイズ表記を除去
    const text = rawText.replace(/\(PDF[^)]*\)/g, "").trim();

    if (!text) continue;

    // 絶対 URL に変換
    const pdfUrl = href.startsWith("http") ? href : `${BASE_ORIGIN}${href}`;

    results.push({ pdfUrl, linkText: text });
  }

  return results;
}

/**
 * 一覧ページ HTML から会議録セッション情報を収集する。
 * 草津町議会会議録のパターンに一致しないリンクはスキップする。
 */
export function parsePdfLinks(html: string): KusatsuSessionInfo[] {
  const pdfLinks = extractPdfLinks(html);
  const results: KusatsuSessionInfo[] = [];

  for (const { pdfUrl, linkText } of pdfLinks) {
    const session = parseLinkText(linkText, pdfUrl);
    if (session) {
      results.push(session);
    }
  }

  return results;
}

/**
 * 指定年の会議録セッション一覧を取得する。
 * 単一の一覧ページから全件を収集し、指定年のものだけ返す。
 */
export async function fetchSessionList(
  year: number
): Promise<KusatsuSessionInfo[]> {
  const url = `${BASE_ORIGIN}${LIST_PAGE_PATH}`;
  const html = await fetchPage(url);
  if (!html) return [];

  await delay(INTER_PAGE_DELAY_MS);

  const all = parsePdfLinks(html);
  // 指定年度に一致するセッションのみ返す
  return all.filter((s) => s.year === year);
}
