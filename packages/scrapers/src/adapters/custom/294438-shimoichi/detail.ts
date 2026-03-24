/**
 * 下市町議会 -- detail フェーズ
 *
 * 各会議の概要ページを取得し、以下の情報を抽出して MeetingData を組み立てる:
 *   - 会議名（例: 令和6年第6回定例会）
 *   - 会期（開会日）
 *   - 議決事項一覧（議案番号・件名・議決結果）
 *   - 一般質問（質問議員名・質問テーマ）
 *
 * 会議録全文は非公開のため、議決事項と一般質問をそれぞれ remark / question として
 * ParsedStatement に変換する。
 */

import { createHash } from "node:crypto";
import type { MeetingData, ParsedStatement } from "../../../utils/types";
import type { ShimoimchiMeetingRef } from "./list";
import { detectMeetingType, eraToWesternYear, fetchPage } from "./shared";

/**
 * HTML のタグを除去してプレーンテキストを返す。
 */
function stripTags(html: string): string {
  return html.replace(/<[^>]+>/g, "").trim();
}

/**
 * ページタイトルや見出しから会議名を抽出する。
 *
 * 例: "令和6年第6回定例会（12月）" → "令和6年第6回定例会"
 */
export function extractMeetingTitle(html: string): string | null {
  // h1 または title タグから取得を試みる
  const h1Match = html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i);
  if (h1Match) {
    const text = stripTags(h1Match[1]!);
    if (/(令和|平成)(元|\d+)年/.test(text)) return text;
  }

  const titleMatch = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  if (titleMatch) {
    const text = stripTags(titleMatch[1]!);
    // サイト名部分を除去（例: "令和6年第6回定例会 | 下市町"）
    const parts = text.split(/[|｜]/);
    const meetingPart = parts[0]!.trim();
    if (/(令和|平成)(元|\d+)年/.test(meetingPart)) return meetingPart;
  }

  return null;
}

/**
 * 会議タイトルから開会日（YYYY-MM-DD）を抽出する。
 *
 * 対応パターン:
 *   "令和6年第6回定例会（12月）" → 月は12月、日付は1日（暫定）
 *   ページ本文中の日付パターン（例: "12月3日"）から補完する
 */
export function extractHeldOn(html: string, title: string): string | null {
  // 会議タイトルから年・回・月を抽出
  const sessionPattern = /(令和|平成)(元|\d+)年第(\d+)回(?:\d+月)?(?:定例会|臨時会)/;
  const sessionMatch = title.match(sessionPattern);

  const era = sessionMatch?.[1] ?? null;
  const eraYearStr = sessionMatch?.[2] ?? null;

  // 年を西暦に変換
  let westernYear: number | null = null;
  if (era && eraYearStr) {
    const eraYear = eraYearStr === "元" ? 1 : Number(eraYearStr);
    if (era === "令和") westernYear = eraYear + 2018;
    else if (era === "平成") westernYear = eraYear + 1988;
  }

  if (!westernYear) {
    // eraToWesternYear で再試行
    const eraMatch = title.match(/(令和|平成)(元|\d+)年/);
    if (eraMatch) westernYear = eraToWesternYear(eraMatch[0]);
  }

  if (!westernYear) return null;

  // ページ本文から開会日を探す
  // 「令和6年12月3日」「12月3日」形式の最初の日付を取得
  const fullDatePattern = /(令和|平成)(元|\d+)年(\d+)月(\d+)日/;
  const fullDateMatch = html.match(fullDatePattern);
  if (fullDateMatch) {
    const dateEra = fullDateMatch[1]!;
    const dateEraYear = fullDateMatch[2] === "元" ? 1 : Number(fullDateMatch[2]);
    let dateYear: number;
    if (dateEra === "令和") dateYear = dateEraYear + 2018;
    else if (dateEra === "平成") dateYear = dateEraYear + 1988;
    else return null;

    const month = Number(fullDateMatch[3]);
    const day = Number(fullDateMatch[4]);
    return `${dateYear}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
  }

  // 月のみのパターン（例: "12月3日"）
  const monthDayPattern = /(\d+)月(\d+)日/;
  const monthDayMatch = html.match(monthDayPattern);
  if (monthDayMatch && westernYear) {
    const month = Number(monthDayMatch[1]);
    const day = Number(monthDayMatch[2]);
    return `${westernYear}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
  }

  return null;
}

/**
 * HTML ページから議決事項を抽出する。
 *
 * パターン例:
 *   "議案第1号　○○に関する条例　可決"
 *   "議案第12号　令和6年度一般会計補正予算　原案可決"
 */
export function extractResolutions(html: string): string[] {
  const results: string[] = [];

  // 議案番号パターンを含む行を探す
  const billPattern = /議案第\d+号[^\n<]*/g;
  const plainText = stripTags(html);

  for (const match of plainText.matchAll(billPattern)) {
    const text = match[0]!.trim();
    if (text.length > 5) {
      results.push(text);
    }
  }

  return results;
}

/**
 * HTML ページから一般質問を抽出する。
 *
 * パターン例:
 *   議員名 + 質問テーマ がセットになって掲載される
 */
export function extractGeneralQuestions(html: string): string[] {
  const results: string[] = [];

  // "一般質問" セクション以降を探す
  const plainText = stripTags(html);
  const questionSection = plainText.match(/一般質問([\s\S]*?)(?=\n\n\n|$)/);
  if (!questionSection) return results;

  const sectionText = questionSection[1]!;

  // 複数の質問を改行区切りで取得
  const lines = sectionText
    .split(/\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0);

  // 議員名らしい短いテキスト + 長いテキスト（質問テーマ）のペアを探す
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]!;
    // 「について」「に関する」「問題」「施策」等を含む質問テーマらしい行
    if (
      line.length > 5 &&
      !line.includes("一般質問") &&
      !line.match(/^議案/) &&
      !line.match(/^令和|^平成/)
    ) {
      results.push(line);
    }
  }

  return results;
}

/**
 * ParsedStatement を生成する。
 */
function makeStatement(
  content: string,
  kind: "remark" | "question" | "answer",
  speakerName: string | null,
  speakerRole: string | null,
  offset: number
): ParsedStatement {
  const contentHash = createHash("sha256").update(content).digest("hex");
  return {
    kind,
    speakerName,
    speakerRole,
    content,
    contentHash,
    startOffset: offset,
    endOffset: offset + content.length,
  };
}

/**
 * 会議概要ページの HTML から ParsedStatement 配列を生成する。
 *
 * 議決事項 → remark、一般質問テーマ → question として変換する。
 */
export function parsePageStatements(html: string): ParsedStatement[] {
  const statements: ParsedStatement[] = [];
  let offset = 0;

  // 議決事項
  const resolutions = extractResolutions(html);
  for (const text of resolutions) {
    const stmt = makeStatement(text, "remark", null, null, offset);
    statements.push(stmt);
    offset = stmt.endOffset + 1;
  }

  // 一般質問
  const questions = extractGeneralQuestions(html);
  for (const text of questions) {
    const stmt = makeStatement(text, "question", null, null, offset);
    statements.push(stmt);
    offset = stmt.endOffset + 1;
  }

  return statements;
}

/**
 * 会議概要ページを取得し、MeetingData に変換する。
 */
export async function fetchMeetingData(
  ref: ShimoimchiMeetingRef,
  municipalityId: string
): Promise<MeetingData | null> {
  const html = await fetchPage(ref.pageUrl);
  if (!html) return null;

  const title = extractMeetingTitle(html);
  if (!title) {
    console.warn(`[294438-shimoichi] 会議タイトル抽出失敗: ${ref.pageUrl}`);
    return null;
  }

  const heldOn = extractHeldOn(html, title);
  if (!heldOn) {
    console.warn(`[294438-shimoichi] 開催日抽出失敗: ${ref.pageUrl}`);
    return null;
  }

  const statements = parsePageStatements(html);
  if (statements.length === 0) return null;

  return {
    municipalityId,
    title,
    meetingType: detectMeetingType(title),
    heldOn,
    sourceUrl: ref.pageUrl,
    externalId: `shimoichi_${ref.numericId}`,
    statements,
  };
}
