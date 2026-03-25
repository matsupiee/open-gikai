/**
 * ニセコ町議会 会議録 — detail フェーズ
 *
 * PDF をダウンロードしてテキストを抽出し、発言者と発言内容を ParsedStatement 配列に変換する。
 *
 * 発言者パターン:
 *   ○議長（青羽雄士君）
 *   ○町長（片山健也君）
 *   ○副町長（山本契太君）
 *   ○3番（高木直良君）
 *
 * 「○」で始まり、役職 or 番号 + 括弧内に氏名（「君」敬称付き）
 */

import { createHash } from "node:crypto";
import { extractText, getDocumentProxy } from "unpdf";
import type { MeetingData, ParsedStatement } from "../../../utils/types";
import type { NisekoMeeting } from "./list";
import { detectMeetingType, fetchBinary } from "./shared";

// 役職サフィックス（長いものを先に置いて誤マッチを防ぐ）
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
export function classifyKind(
  speakerRole: string | null,
): "remark" | "question" | "answer" {
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
 * 発言者行から役職と氏名を抽出する。
 *
 * パターン:
 *   "○議長（青羽雄士君）" → role="議長", name="青羽雄士"
 *   "○町長（片山健也君）" → role="町長", name="片山健也"
 *   "○3番（高木直良君）"  → role="議員", name="高木直良"
 *
 * @returns { role, name } or null（マッチしない場合）
 */
export function parseSpeakerLine(line: string): {
  role: string;
  name: string;
} | null {
  const trimmed = line.trim();

  // "○" で始まる発言者行
  if (!trimmed.startsWith("○")) return null;

  // 括弧内の氏名を抽出（「君」敬称を除去）
  // パターン: ○役職（氏名君）  または ○N番（氏名君）
  const match = trimmed.match(/^○(.+?)（(.+?)君）/);
  if (!match) return null;

  const roleText = match[1]!.trim();
  const nameWithHonorific = match[2]!.trim();
  // 「君」は既にパターンで除外している

  // 番号付き議員: "3番" → role="議員"
  if (/^\d+番$/.test(roleText)) {
    return { role: "議員", name: nameWithHonorific };
  }

  // 役職から正規のサフィックスを探す
  for (const suffix of ROLE_SUFFIXES) {
    if (roleText === suffix || roleText.endsWith(suffix)) {
      return { role: suffix, name: nameWithHonorific };
    }
  }

  // 不明な役職でもそのまま返す
  return { role: roleText, name: nameWithHonorific };
}

/**
 * PDF テキスト全体（全ページ連結）から ParsedStatement 配列を生成する。
 *
 * ニセコ町のPDFは発言者行（○で始まる）が発言内容の前に来る構造。
 * 発言者行を検出してその後のテキストを発言内容として収集する。
 */
export function parseStatements(pages: string[]): ParsedStatement[] {
  const statements: ParsedStatement[] = [];
  const fullText = pages.join("\n");
  const lines = fullText.split("\n");

  let currentSpeaker: { role: string; name: string } | null = null;
  let contentLines: string[] = [];
  let offset = 0;

  const flushStatement = () => {
    if (!currentSpeaker || contentLines.length === 0) return;

    const content = contentLines
      .filter((l) => l.trim().length > 0)
      .join("\n")
      .replace(/\n+/g, " ")
      .trim();

    if (!content || content.length < 3) return;

    const contentHash = createHash("sha256").update(content).digest("hex");
    const startOffset = offset;
    const endOffset = offset + content.length;

    statements.push({
      kind: classifyKind(currentSpeaker.role),
      speakerName: currentSpeaker.name,
      speakerRole: currentSpeaker.role,
      content,
      contentHash,
      startOffset,
      endOffset,
    });

    offset = endOffset + 1;
    contentLines = [];
  };

  for (const line of lines) {
    const trimmed = line.trim();

    // 発言者行の検出
    const speaker = parseSpeakerLine(trimmed);
    if (speaker) {
      // 直前の発言者のコンテンツを確定
      flushStatement();
      currentSpeaker = speaker;
      continue;
    }

    // 発言内容行
    if (currentSpeaker) {
      contentLines.push(trimmed);
    }
  }

  // 最後の発言者のコンテンツを確定
  flushStatement();

  return statements;
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
      `[013951-niseko] PDF 取得失敗: ${pdfUrl}`,
      err instanceof Error ? err.message : err,
    );
    return null;
  }
}

/**
 * PDF をダウンロード・テキスト抽出し、MeetingData に変換する。
 */
export async function fetchMeetingData(
  meeting: NisekoMeeting,
  municipalityId: string,
): Promise<MeetingData | null> {
  if (!meeting.heldOn) return null;

  const pages = await fetchPdfPages(meeting.pdfUrl);
  if (!pages) return null;

  const statements = parseStatements(pages);
  if (statements.length === 0) return null;

  // PDF URL のファイル名から externalId を生成
  const urlPath = new URL(meeting.pdfUrl).pathname;
  const fileName = urlPath.split("/").pop()?.replace(/\.pdf$/i, "") ?? null;
  const externalId = fileName ? `niseko_${fileName}` : null;

  return {
    municipalityId,
    title: meeting.title,
    meetingType: detectMeetingType(meeting.title),
    heldOn: meeting.heldOn,
    sourceUrl: meeting.pdfUrl,
    externalId,
    statements,
  };
}
