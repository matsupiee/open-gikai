/**
 * 鏡石町議会 DiscussVision Smart — detail フェーズ
 *
 * list フェーズで取得した playlist エントリから MeetingData を組み立てる。
 * DiscussVision Smart では content フィールドに質問項目テキストが含まれる。
 */

import { createHash } from "node:crypto";
import type { MeetingData, ParsedStatement } from "../../../utils/types";
import { buildSpeechUrl, classifyMeetingType } from "./shared";
import type { KagamiishiListRecord } from "./list";

// 役職サフィックス（長い方を先に置いて誤マッチを防ぐ）
const ROLE_SUFFIXES = [
  "副委員長",
  "副議長",
  "委員長",
  "副町長",
  "副部長",
  "副課長",
  "議長",
  "町長",
  "委員",
  "議員",
  "部長",
  "課長",
  "室長",
  "局長",
  "係長",
  "参事",
  "主幹",
] as const;

// 行政側の役職
const ANSWER_ROLES = new Set([
  "町長",
  "副町長",
  "部長",
  "課長",
  "室長",
  "局長",
  "係長",
  "参事",
  "主幹",
  "副部長",
  "副課長",
]);

/**
 * 発言者名文字列から名前と役職を抽出する。
 * 例: "込山靖子議員" → { speakerName: "込山靖子", speakerRole: "議員" }
 */
export function parseSpeaker(rawSpeaker: string | null): {
  speakerName: string | null;
  speakerRole: string | null;
} {
  if (!rawSpeaker) return { speakerName: null, speakerRole: null };

  const text = rawSpeaker.trim();

  for (const suffix of ROLE_SUFFIXES) {
    if (text.endsWith(suffix)) {
      const name =
        text.length > suffix.length ? text.slice(0, -suffix.length) : null;
      return { speakerName: name, speakerRole: suffix };
    }
  }

  // 役職が見つからなければそのまま名前として扱う
  return { speakerName: text, speakerRole: null };
}

/**
 * 役職から発言種別を分類する。
 */
export function classifyKind(
  speakerRole: string | null,
): "question" | "answer" | "remark" {
  if (!speakerRole) return "remark";
  if (ANSWER_ROLES.has(speakerRole)) return "answer";
  if (speakerRole === "議長" || speakerRole === "副議長" || speakerRole === "委員長")
    return "remark";
  for (const role of ANSWER_ROLES) {
    if (speakerRole.endsWith(role)) return "answer";
  }
  return "question";
}

/**
 * schedule.label 先頭の日付部分と council.year の年を組み合わせて YYYY-MM-DD を返す。
 * パースできない場合は null を返す。
 *
 * 例: scheduleLabel="06月12日　一般質問（1日目）", councilYear="2025-06-13"
 *   → "2025-06-12"
 */
export function parseHeldOn(
  scheduleLabel: string,
  councilYear: string,
): string | null {
  const dateMatch = scheduleLabel.match(/^(\d{2})月(\d{2})日/);
  if (!dateMatch?.[1] || !dateMatch?.[2]) return null;

  const yearMatch = councilYear.match(/^(\d{4})/);
  if (!yearMatch?.[1]) return null;

  return `${yearMatch[1]}-${dateMatch[1]}-${dateMatch[2]}`;
}

/**
 * playlist エントリの content フィールドから ParsedStatement 配列を生成する。
 * content は改行区切りの質問項目テキスト。
 * content が null または空の場合は空配列を返す。
 */
export function buildStatements(
  content: string | null,
  speaker: string | null,
): ParsedStatement[] {
  if (!content || !content.trim()) return [];

  const { speakerName, speakerRole } = parseSpeaker(speaker);
  const kind = classifyKind(speakerRole);
  const text = content.trim();
  const contentHash = createHash("sha256").update(text).digest("hex");

  return [
    {
      kind,
      speakerName,
      speakerRole,
      content: text,
      contentHash,
      startOffset: 0,
      endOffset: text.length,
    },
  ];
}

/**
 * KagamiishiListRecord から MeetingData を組み立てる。
 */
export function buildMeetingData(
  record: KagamiishiListRecord,
  municipalityCode: string,
): MeetingData | null {
  const heldOn = parseHeldOn(record.scheduleLabel, record.councilYear);
  if (!heldOn) return null;

  const statements = buildStatements(record.content, record.speaker);
  if (statements.length === 0) return null;

  const sourceUrl = buildSpeechUrl(
    record.councilId,
    record.scheduleId,
    record.playlistId,
  );

  const externalId = `kagamiishi_${record.councilId}_${record.scheduleId}_${record.playlistId}`;

  return {
    municipalityCode,
    title: record.councilLabel,
    meetingType: classifyMeetingType(record.councilLabel),
    heldOn,
    sourceUrl,
    externalId,
    statements,
  };
}
