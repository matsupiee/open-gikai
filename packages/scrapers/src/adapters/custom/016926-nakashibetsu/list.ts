/**
 * 中標津町議会 会議録 — list フェーズ
 *
 * 一般質問・意見書一覧ページから各定例会ページへのリンクを収集し、
 * 定例会ページ内のPDFリンクを抽出する。
 *
 * HTML 構造（一覧ページ）:
 *   <a href="/gikai/ippansitumon-ikensyo/ippannsitumon/reiwa6/R0603teireikai/">令和6年3月定例会</a>
 *
 * HTML 構造（定例会ページ）:
 *   <a href="/file/contents/5857/48136/{ファイル名}.pdf">一般質問全文</a>
 */

import {
  BASE_ORIGIN,
  IPPAN_PATH,
  fetchPage,
  parseSessionCode,
  reiwaToWestern,
  yearToEraCode,
} from "./shared";

export interface NakashibetsuMeeting {
  /** PDF の完全 URL */
  pdfUrl: string;
  /** 会議タイトル（例: "令和6年3月定例会 一般質問"） */
  title: string;
  /** 開催年 */
  year: number;
  /** 開催月 */
  month: number;
  /** セッション名（例: "令和6年3月定例会"） */
  sessionName: string;
  /** 定例会コード（例: "R0603teireikai"） */
  sessionCode: string;
}

/**
 * 一覧ページ HTML から定例会ページへのリンクを抽出する。
 * /gikai/ippansitumon-ikensyo/ippannsitumon/{年度}/{定例会コード}/ 形式のリンクを収集する。
 */
export function parseSessionLinks(html: string): string[] {
  const links: string[] = [];
  const seen = new Set<string>();

  const regex =
    /href="(\/gikai\/ippansitumon-ikensyo\/ippannsitumon\/[^"]+\/)"/gi;

  for (const match of html.matchAll(regex)) {
    const path = match[1]!;
    if (!seen.has(path)) {
      seen.add(path);
      links.push(`${BASE_ORIGIN}${path}`);
    }
  }

  return links;
}

/**
 * 定例会ページ URL からセッションコードを抽出する。
 * e.g., "/gikai/ippansitumon-ikensyo/ippannsitumon/reiwa6/R0603teireikai/" → "R0603teireikai"
 */
function extractSessionCode(url: string): string | null {
  const match = url.match(/\/ippannsitumon\/[^/]+\/([^/]+)\//);
  return match?.[1] ?? null;
}

/**
 * 定例会ページ HTML から PDF リンクを抽出する。
 */
export function parsePdfLinks(html: string): string[] {
  const links: string[] = [];
  const seen = new Set<string>();

  const regex = /href="(\/file\/contents\/[^"]+\.pdf)"/gi;

  for (const match of html.matchAll(regex)) {
    const path = match[1]!;
    if (!seen.has(path)) {
      seen.add(path);
      links.push(`${BASE_ORIGIN}${path}`);
    }
  }

  return links;
}

/**
 * セッションコードとPDFリンクからミーティング情報を組み立てる。
 */
function buildMeetings(sessionCode: string, pdfUrls: string[]): NakashibetsuMeeting[] {
  const parsed = parseSessionCode(sessionCode);
  if (!parsed) return [];

  const { eraYear, month } = parsed;
  const year = reiwaToWestern(eraYear);
  const sessionName = `令和${eraYear === 1 ? "元" : eraYear}年${month}月定例会`;

  return pdfUrls.map((pdfUrl) => ({
    pdfUrl,
    title: `${sessionName} 一般質問`,
    year,
    month,
    sessionName,
    sessionCode,
  }));
}

/**
 * 指定年の全一般質問 PDF 一覧を取得する。
 */
export async function fetchMeetingList(year: number): Promise<NakashibetsuMeeting[]> {
  const eraCode = yearToEraCode(year);

  // 一般質問一覧ページを取得
  const listHtml = await fetchPage(`${BASE_ORIGIN}${IPPAN_PATH}`);
  if (!listHtml) return [];

  const sessionUrls = parseSessionLinks(listHtml);

  // 指定年の定例会ページのみフィルタする
  const targetUrls = eraCode
    ? sessionUrls.filter((url) => url.includes(`/${eraCode}/`))
    : [];

  const meetings: NakashibetsuMeeting[] = [];

  for (const sessionUrl of targetUrls) {
    const sessionCode = extractSessionCode(sessionUrl);
    if (!sessionCode) continue;

    const sessionHtml = await fetchPage(sessionUrl);
    if (!sessionHtml) continue;

    const pdfUrls = parsePdfLinks(sessionHtml);
    const sessionMeetings = buildMeetings(sessionCode, pdfUrls);
    meetings.push(...sessionMeetings);
  }

  return meetings;
}
