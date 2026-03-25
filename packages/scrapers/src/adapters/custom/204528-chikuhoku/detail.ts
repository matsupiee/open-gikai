/**
 * 筑北村議会（実態: 筑西市議会） — detail フェーズ
 *
 * DiscussVision Smart API の playlist データから MeetingData を組み立てる。
 *
 * minute/text API は全会議で error_code: 2004（データなし）を返すため、
 * councilrd/all API の playlist 内の content（議題一覧）と speaker を使用して
 * statements を構築する。
 *
 * playlist item の構造:
 *   - speaker が null: 開会・閉会等の本会議進行 → kind: "remark"
 *   - speaker が "○○議員": 一般質問の議題 → kind: "question"
 */

import { createHash } from "node:crypto";
import type { MeetingData, ParsedStatement } from "../../../utils/types";
import type { PlaylistItem } from "./list";
import {
  TENANT_ID,
  VIEW_BASE,
  detectMeetingType,
  extractDateFromScheduleLabel,
} from "./shared";

/**
 * speaker フィールドから話者名と役職を抽出する。
 *
 * パターン: "三澤隆一議員" → name: "三澤隆一", role: "議員"
 * null の場合: name: null, role: null
 */
export function parseSpeaker(speaker: string | null): {
  speakerName: string | null;
  speakerRole: string | null;
} {
  if (!speaker) return { speakerName: null, speakerRole: null };

  const trimmed = speaker.trim();

  // "○○議員" パターン
  const m = trimmed.match(/^(.+?)(議員)$/);
  if (m?.[1] && m[2]) {
    return { speakerName: m[1], speakerRole: m[2] };
  }

  // その他のパターン（役職名のみ等）
  return { speakerName: trimmed, speakerRole: null };
}

/**
 * speaker と content から発言種別を分類する。
 *
 * - speaker が null → remark（本会議進行）
 * - speaker が "○○議員" → question
 */
export function classifyKind(speaker: string | null): string {
  if (!speaker) return "remark";
  return "question";
}

/**
 * playlist 配列から ParsedStatement[] を生成する。
 */
export function parseStatements(playlist: PlaylistItem[]): ParsedStatement[] {
  const statements: ParsedStatement[] = [];
  let offset = 0;

  for (const item of playlist) {
    const content = item.content?.trim();
    if (!content) continue;

    const { speakerName, speakerRole } = parseSpeaker(item.speaker);
    const kind = classifyKind(item.speaker);

    const contentHash = createHash("sha256")
      .update(`${item.playlist_id}:${content}`)
      .digest("hex");

    const startOffset = offset;
    const endOffset = offset + content.length;

    statements.push({
      kind,
      speakerName,
      speakerRole,
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
 * ドキュメント情報から MeetingData を組み立てる。
 */
export function buildMeetingData(
  params: {
    councilId: string;
    councilLabel: string;
    councilYear: string;
    scheduleId: string;
    scheduleLabel: string;
    playlist: PlaylistItem[];
  },
  municipalityCode: string,
): MeetingData | null {
  const heldOn = extractDateFromScheduleLabel(
    params.scheduleLabel,
    params.councilYear,
  );
  if (!heldOn) return null;

  const statements = parseStatements(params.playlist);
  if (statements.length === 0) return null;

  const title = `${params.councilLabel} ${params.scheduleLabel}`;
  const externalId = `dvsmart_${TENANT_ID}_${params.councilId}_${params.scheduleId}`;
  const sourceUrl = `${VIEW_BASE}/rd/council_${params.councilId}.html`;

  return {
    municipalityCode,
    title,
    meetingType: detectMeetingType(params.councilLabel),
    heldOn,
    sourceUrl,
    externalId,
    statements,
  };
}
