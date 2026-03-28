/**
 * 葛尾村議会 -- detail フェーズ
 *
 * 会議結果ページの HTML から会議名・会期・議決一覧を抽出し、
 * 議案ごとに remark statement を生成する。
 */

import { createHash } from "node:crypto";
import type { MeetingData, ParsedStatement } from "../../../utils/types";
import { detectMeetingType, fetchPage, parseWarekiYear, toHalfWidth } from "./shared";

export interface KatsuraoDetailParams {
  /** 会議結果ページ URL */
  pageUrl: string;
  /** 一覧ページ上の記事タイトル */
  articleTitle: string;
}

function decodeEntities(text: string): string {
  return text
    .replace(/&nbsp;|&#160;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'");
}

function cleanText(text: string): string {
  return toHalfWidth(
    decodeEntities(text)
      .replace(/<br\s*\/?>/gi, " ")
      .replace(/<[^>]+>/g, " ")
      .replace(/[\u200B-\u200D\uFEFF]/g, "")
      .replace(/\s+/g, " ")
      .trim(),
  );
}

function buildIsoDate(year: number, month: number, day: number): string {
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function extractPageKey(pageUrl: string): string {
  return pageUrl.replace(/^.*\//, "").replace(/\.html$/, "");
}

export function normalizeMeetingTitle(text: string): string {
  return cleanText(text)
    .replace(/\s*[-|｜]\s*葛尾村ホームページ$/, "")
    .replace(/の結果について$/, "")
    .trim();
}

/**
 * ページ見出しまたは fallback title から会議名を抽出する。
 */
export function extractMeetingTitle(
  html: string,
  fallbackTitle: string | null = null,
): string | null {
  const candidates: string[] = [];

  const h1Match = html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i);
  if (h1Match?.[1]) candidates.push(h1Match[1]);

  const titleMatch = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  if (titleMatch?.[1]) candidates.push(titleMatch[1]);

  if (fallbackTitle) candidates.push(fallbackTitle);

  for (const candidate of candidates) {
    const meetingTitle = normalizeMeetingTitle(candidate);
    if (/(定例会|臨時会|委員会)/.test(meetingTitle)) {
      return meetingTitle;
    }
  }

  return null;
}

/**
 * 会期開始日を抽出する。
 * 例: "会期 令和6年3月8日～14日" → "2024-03-08"
 */
export function extractHeldOn(html: string, meetingTitle: string): string | null {
  const text = cleanText(html);

  const fullDateMatch = text.match(/会期\s*(令和|平成)(元|\d+)年(\d{1,2})月(\d{1,2})日/);
  if (fullDateMatch) {
    const era = fullDateMatch[1]!;
    const eraYear = fullDateMatch[2]!;
    const westernYear = parseWarekiYear(`${era}${eraYear}年`);
    if (!westernYear) return null;

    const month = Number.parseInt(fullDateMatch[3]!, 10);
    const day = Number.parseInt(fullDateMatch[4]!, 10);
    return buildIsoDate(westernYear, month, day);
  }

  const titleYear = parseWarekiYear(meetingTitle);
  if (!titleYear) return null;

  const monthDayMatch = text.match(/会期\s*(\d{1,2})月(\d{1,2})日/);
  if (!monthDayMatch) return null;

  const month = Number.parseInt(monthDayMatch[1]!, 10);
  const day = Number.parseInt(monthDayMatch[2]!, 10);
  return buildIsoDate(titleYear, month, day);
}

/**
 * 議決結果テーブルから各議案行を抽出する。
 */
export function extractResolutionRows(html: string): string[] {
  const rows: string[] = [];

  for (const tableMatch of html.matchAll(/<table[\s\S]*?<\/table>/gi)) {
    const tableHtml = tableMatch[0]!;

    for (const rowMatch of tableHtml.matchAll(/<tr[\s\S]*?<\/tr>/gi)) {
      const cells = [...rowMatch[0]!.matchAll(/<t[dh][^>]*>([\s\S]*?)<\/t[dh]>/gi)]
        .map((match) => cleanText(match[1]!))
        .filter(Boolean);

      if (cells.length < 4) continue;

      if (
        cells[0] === "議案番号" ||
        cells.includes("議決結果") ||
        cells.includes("議決月日")
      ) {
        continue;
      }

      const content = [cells[0], cells[1], cells[2], cells[3]].filter(Boolean).join(" ");
      if (!content) continue;

      rows.push(content);
    }
  }

  return rows;
}

/**
 * 会議結果ページ HTML を ParsedStatement 配列に変換する。
 */
export function parsePageStatements(html: string): ParsedStatement[] {
  const statements: ParsedStatement[] = [];
  let offset = 0;

  for (const content of extractResolutionRows(html)) {
    const contentHash = createHash("sha256").update(content).digest("hex");
    const startOffset = offset;
    const endOffset = offset + content.length;

    statements.push({
      kind: "remark",
      speakerName: null,
      speakerRole: null,
      content,
      contentHash,
      startOffset,
      endOffset,
    });

    offset = endOffset + 1;
  }

  return statements;
}

/**
 * 会議結果ページを取得して MeetingData を組み立てる。
 */
export async function fetchMeetingData(
  params: KatsuraoDetailParams,
  municipalityCode: string,
): Promise<MeetingData | null> {
  const html = await fetchPage(params.pageUrl);
  if (!html) return null;

  const title = extractMeetingTitle(html, params.articleTitle);
  if (!title) {
    console.warn(`[075485-katsurao] 会議タイトル抽出失敗: ${params.pageUrl}`);
    return null;
  }

  const heldOn = extractHeldOn(html, title);
  if (!heldOn) {
    console.warn(`[075485-katsurao] 開催日抽出失敗: ${params.pageUrl}`);
    return null;
  }

  const statements = parsePageStatements(html);
  if (statements.length === 0) return null;

  return {
    municipalityCode,
    title,
    meetingType: detectMeetingType(title),
    heldOn,
    sourceUrl: params.pageUrl,
    externalId: `katsurao_${extractPageKey(params.pageUrl)}`,
    statements,
  };
}
