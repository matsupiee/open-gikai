/**
 * 滑川町議会 会議録 — detail フェーズ
 *
 * API レスポンスの playlist エントリから発言データを生成する。
 * 滑川町は DiscussVision Smart API を使用しており、
 * content フィールドに発言要旨が含まれる。
 * PDF は使用せず、API の content を直接パースする。
 */

import { createHash } from "node:crypto";
import type { MeetingData, ParsedStatement } from "../../../utils/types";
import type { NamegawaListRecord, PlaylistEntry } from "./list";
import { buildSourceUrl, buildExternalId, detectMeetingType } from "./list";
import { normalizeSpeakerName } from "./shared";

// 行政側の役職（答弁者として分類する）
const ANSWER_ROLES = new Set([
  "町長",
  "副町長",
  "教育長",
  "副教育長",
  "部長",
  "副部長",
  "課長",
  "副課長",
  "室長",
  "局長",
  "係長",
  "参事",
  "主幹",
  "事務局長",
  "代表監査委員",
  "監査委員",
  "会計管理者",
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
 * playlist エントリから ParsedStatement を生成する。
 */
export function parsePlaylistEntry(entry: PlaylistEntry): ParsedStatement | null {
  if (!entry.speaker || !entry.content.trim()) return null;

  const { speakerName, speakerRole } = normalizeSpeakerName(entry.speaker);
  const content = entry.content.trim();
  const contentHash = createHash("sha256").update(content).digest("hex");

  return {
    kind: classifyKind(speakerRole),
    speakerName,
    speakerRole,
    content,
    contentHash,
    startOffset: 0,
    endOffset: content.length,
  };
}

/**
 * playlist エントリ列から ParsedStatement[] を生成する。
 * offset は連結した内容に基づいて計算する。
 */
export function parseStatements(playlist: PlaylistEntry[]): ParsedStatement[] {
  const statements: ParsedStatement[] = [];
  let offset = 0;

  for (const entry of playlist) {
    if (!entry.speaker || !entry.content.trim()) continue;

    const { speakerName, speakerRole } = normalizeSpeakerName(entry.speaker);
    const content = entry.content.trim();
    const contentHash = createHash("sha256").update(content).digest("hex");

    statements.push({
      kind: classifyKind(speakerRole),
      speakerName,
      speakerRole,
      content,
      contentHash,
      startOffset: offset,
      endOffset: offset + content.length,
    });

    offset += content.length + 1;
  }

  return statements;
}

/**
 * NamegawaListRecord から MeetingData を生成する。
 */
export function fetchMeetingData(
  record: NamegawaListRecord,
  municipalityCode: string
): MeetingData | null {
  const statements = parseStatements(record.playlist);
  if (statements.length === 0) return null;

  return {
    municipalityCode,
    title: record.councilLabel,
    meetingType: detectMeetingType(record.councilLabel),
    heldOn: record.heldOn,
    sourceUrl: buildSourceUrl(record.councilId, record.scheduleId),
    externalId: buildExternalId(record.councilId, record.scheduleId),
    statements,
  };
}
