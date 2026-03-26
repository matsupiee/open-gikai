/**
 * 蘭越町議会 会議録 — detail フェーズ
 *
 * PDF をダウンロードしてテキストを抽出し、ParsedStatement 配列に変換する。
 *
 * PDF は「議事の経過」テーブル形式で、発言者（左列）と発言内容（右列）が
 * テーブルレイアウトで記録されている。unpdf でテキスト抽出後にパースする。
 */

import { createHash } from "node:crypto";
import { extractText, getDocumentProxy } from "../../../utils/pdf";
import type { MeetingData, ParsedStatement } from "../../../utils/types";
import type { RankoshiMeeting } from "./list";
import { detectMeetingType, fetchBinary } from "./shared";

// 役職サフィックス（長い方を先に置いて誤マッチを防ぐ）
const ROLE_SUFFIXES = [
  "副委員長",
  "委員長",
  "副議長",
  "副町長",
  "教育長",
  "議長",
  "町長",
  "委員",
  "議員",
  "副部長",
  "副課長",
  "部長",
  "課長",
  "室長",
  "局長",
  "係長",
  "参事",
  "主幹",
  "次長",
] as const;

// 行政側の役職（答弁者として分類する）
const ANSWER_ROLES = new Set([
  "町長",
  "副町長",
  "教育長",
  "部長",
  "副部長",
  "課長",
  "副課長",
  "室長",
  "局長",
  "係長",
  "参事",
  "主幹",
  "次長",
]);

/** 役職から発言種別を分類 */
export function classifyKind(speakerRole: string | null): "remark" | "question" | "answer" {
  if (!speakerRole) return "remark";
  if (ANSWER_ROLES.has(speakerRole)) return "answer";
  if (
    speakerRole === "議長" ||
    speakerRole === "副議長" ||
    speakerRole === "委員長" ||
    speakerRole === "副委員長"
  )
    return "remark";
  for (const role of ANSWER_ROLES) {
    if (speakerRole.endsWith(role)) return "answer";
  }
  return "question";
}

/**
 * スペースを除去した文字列で役職をマッチする。
 * 「議 長」「副 町 長」のようなスペース入り文字列に対応。
 */
function matchRole(line: string): string | null {
  const normalized = line.replace(/[\s　]+/g, "");

  // 議員番号パターン: "5番" / "10番"
  if (/^\d+番$/.test(normalized)) {
    return "議員";
  }

  for (const suffix of ROLE_SUFFIXES) {
    if (normalized === suffix || normalized.endsWith(suffix)) {
      return suffix;
    }
  }
  return null;
}

/**
 * 氏名行（括弧内）から氏名を抽出する。
 * パターン: "（佐藤太郎）" / "( 田 中 花 子 )"
 */
function extractName(line: string): string | null {
  const match = line.match(/^[\s　]*[（(]\s*(.+?)\s*[)）][\s　]*$/);
  if (!match) return null;
  return match[1]!.replace(/[\s　]+/g, "");
}

/**
 * 行が「発言者セクション行」かどうかを判定する。
 * 役職行、氏名行、〃行、ページ番号、日程行、時刻行、状態行など。
 */
function isSpeakerSectionLine(line: string): boolean {
  const trimmed = line.trim();
  if (!trimmed) return false;

  // 〃（同一発言者の繰り返し）
  if (trimmed === "〃" || trimmed === "″") return true;

  // ページ番号（数字のみ）
  if (/^\d+$/.test(trimmed)) return true;

  // テーブルヘッダー
  if (trimmed.includes("議 事 の 経 過") || trimmed.includes("日 程 発 言 者 発 言")) return true;

  // 時刻行: "10：00" / "14：30"
  if (/^\d+[：:]\d+$/.test(trimmed)) return true;

  // 開会・閉会などの状態行
  if (
    trimmed === "開会" ||
    trimmed === "閉会" ||
    trimmed === "散会" ||
    trimmed === "休憩" ||
    trimmed === "再開"
  )
    return true;

  // 日程行: "日程１" / "日程 ３"（全角・半角数字に対応）
  if (/^日程[\s　]*[\d０-９]+$/.test(trimmed)) return true;

  // 役職行
  if (matchRole(trimmed) !== null) return true;

  // 氏名行（括弧で囲まれた短い行）
  if (extractName(trimmed) !== null) return true;

  return false;
}

/**
 * ページテキストから発言者リストと発言内容リストを分離する。
 */
export function parsePageText(pageText: string): Array<{
  speakerName: string | null;
  speakerRole: string | null;
  content: string;
}> {
  const lines = pageText.split("\n");
  const results: Array<{
    speakerName: string | null;
    speakerRole: string | null;
    content: string;
  }> = [];

  let inMeetingSection = false;
  const speakerQueue: Array<{ role: string | null; name: string | null }> = [];
  const contentLines: string[] = [];

  let pendingRole: string | null = null;
  let lastSpeakerName: string | null = null;
  let prevWasRole = false;

  for (const line of lines) {
    const trimmed = line.trim();

    if (!inMeetingSection) {
      if (trimmed.includes("議 事 の 経 過") || trimmed.includes("議事の経過")) {
        inMeetingSection = true;
      }
      continue;
    }

    if (!trimmed) continue;

    // テーブルヘッダーはスキップ
    if (trimmed.includes("日 程 発 言 者 発 言") || trimmed.includes("日程 発言者 発言")) continue;

    // 〃 は前の役職+氏名を繰り返す
    if (trimmed === "〃" || trimmed === "″") {
      speakerQueue.push({ role: pendingRole, name: lastSpeakerName });
      prevWasRole = true;
      continue;
    }

    // 役職行
    const role = matchRole(trimmed);
    if (role) {
      pendingRole = role;
      prevWasRole = true;
      continue;
    }

    // 氏名行（役職行の直後）
    const name = extractName(trimmed);
    if (name !== null && prevWasRole) {
      lastSpeakerName = name;
      speakerQueue.push({ role: pendingRole, name });
      prevWasRole = false;
      continue;
    }

    // ページ番号・日程行・時刻行・状態行はスキップ
    if (isSpeakerSectionLine(trimmed)) {
      prevWasRole = false;
      continue;
    }

    // 発言内容行
    prevWasRole = false;
    contentLines.push(trimmed);
  }

  if (speakerQueue.length === 0) return results;
  if (contentLines.length === 0) return results;

  // コンテンツ行を発言者数で均等分割
  const speakerCount = speakerQueue.length;
  const linesPerSpeaker = Math.ceil(contentLines.length / speakerCount);

  for (let i = 0; i < speakerCount; i++) {
    const speaker = speakerQueue[i]!;
    const start = i * linesPerSpeaker;
    const end = Math.min(start + linesPerSpeaker, contentLines.length);
    const contentSlice = contentLines.slice(start, end);

    if (contentSlice.length === 0) break;

    const content = contentSlice
      .join("\n")
      .replace(/\n+/g, " ")
      .trim();

    if (!content) continue;

    results.push({
      speakerRole: speaker.role,
      speakerName: speaker.name,
      content,
    });
  }

  return results;
}

/**
 * PDF テキスト全体（全ページ）から ParsedStatement 配列を生成する。
 */
export function parseStatements(pages: string[]): ParsedStatement[] {
  const allStatements: ParsedStatement[] = [];
  let offset = 0;

  for (const pageText of pages) {
    const pageResults = parsePageText(pageText);

    for (const { speakerRole, speakerName, content } of pageResults) {
      if (!content || content.length < 5) continue;

      const contentHash = createHash("sha256").update(content).digest("hex");
      const startOffset = offset;
      const endOffset = offset + content.length;

      allStatements.push({
        kind: classifyKind(speakerRole),
        speakerName,
        speakerRole,
        content,
        contentHash,
        startOffset,
        endOffset,
      });

      offset = endOffset + 1;
    }
  }

  return allStatements;
}

/**
 * PDF URL からページごとのテキストを取得する。
 */
async function fetchPdfPages(pdfUrl: string): Promise<string[] | null> {
  try {
    const buffer = await fetchBinary(pdfUrl);
    if (!buffer) return null;

    const pdf = await getDocumentProxy(new Uint8Array(buffer));
    const { text } = await extractText(pdf, { mergePages: false });
    // unpdf の mergePages: false は string[] を返す
    return text as unknown as string[];
  } catch (err) {
    console.warn(
      `[013943-rankoshi] PDF 取得失敗: ${pdfUrl}`,
      err instanceof Error ? err.message : err,
    );
    return null;
  }
}

/**
 * PDF をダウンロード・テキスト抽出し、MeetingData に変換する。
 */
export async function fetchMeetingData(
  meeting: RankoshiMeeting,
  municipalityCode: string,
): Promise<MeetingData | null> {
  if (!meeting.heldOn) return null;

  const pages = await fetchPdfPages(meeting.pdfUrl);
  if (!pages) return null;

  const statements = parseStatements(pages);
  if (statements.length === 0) return null;

  // PDF URL のファイル名から externalId を生成
  const urlPath = new URL(meeting.pdfUrl).pathname;
  const fileName = urlPath.split("/").pop()?.replace(/\.pdf$/i, "") ?? null;
  const externalId = fileName ? `rankoshi_${fileName}` : null;

  return {
    municipalityCode,
    title: meeting.title,
    meetingType: detectMeetingType(meeting.title),
    heldOn: meeting.heldOn,
    sourceUrl: meeting.pdfUrl,
    externalId,
    statements,
  };
}
