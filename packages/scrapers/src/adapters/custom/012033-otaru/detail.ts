/**
 * 小樽市議会 会議録 — detail フェーズ
 *
 * API から取得した発言レコードを解析し、MeetingData に変換する。
 *
 * speaker フィールドは "[部署名][氏名][役職]" の形式で格納されている。
 * 例: "松岩委員", "企画政策室山本主幹", "委員長", "子育て支援課長"
 */

import { createHash } from "node:crypto";
import type { MeetingData, ParsedStatement } from "../../../utils/types";
import { detectMeetingType, ymToDate } from "./shared";

// 役職サフィックス（長い方を先に置いて誤マッチを防ぐ）
const ROLE_SUFFIXES = [
  "副委員長",
  "委員長",
  "副議長",
  "副市長",
  "副部長",
  "副課長",
  "議長",
  "市長",
  "委員",
  "議員",
  "部長",
  "課長",
  "室長",
  "局長",
  "係長",
  "参事",
  "主幹",
  "次長",
];

// 行政側の役職（答弁者として分類する）
const ANSWER_ROLES = new Set([
  "市長",
  "副市長",
  "部長",
  "課長",
  "室長",
  "局長",
  "係長",
  "参事",
  "主幹",
  "副部長",
  "副課長",
  "次長",
]);

/**
 * speaker フィールドから話者名・役職を抽出する。
 *
 * パターン:
 * - "委員長" → name=null, role="委員長"
 * - "松岩委員" → name="松岩", role="委員"
 * - "企画政策室山本主幹" → name="企画政策室山本", role="主幹"
 * - "子育て支援課長" → name="子育て支援", role="課長"
 */
export function parseSpeaker(speaker: string): {
  speakerName: string | null;
  speakerRole: string | null;
} {
  const trimmed = speaker.trim();
  if (!trimmed) return { speakerName: null, speakerRole: null };

  for (const suffix of ROLE_SUFFIXES) {
    if (trimmed.endsWith(suffix)) {
      const name =
        trimmed.length > suffix.length
          ? trimmed.slice(0, -suffix.length)
          : null;
      return { speakerName: name, speakerRole: suffix };
    }
  }

  // 既知の役職に一致しない場合は名前として扱う
  return { speakerName: trimmed, speakerRole: null };
}

/** 役職から発言種別を分類 */
export function classifyKind(speakerRole: string | null): string {
  if (!speakerRole) return "remark";
  if (ANSWER_ROLES.has(speakerRole)) return "answer";
  if (
    speakerRole === "議長" ||
    speakerRole === "副議長" ||
    speakerRole === "委員長"
  )
    return "remark";
  for (const role of ANSWER_ROLES) {
    if (speakerRole.endsWith(role)) return "answer";
  }
  return "question";
}

/**
 * 発言レコード配列を ParsedStatement[] に変換する。
 */
export function buildStatements(
  records: Array<{ speaker: string; text: string }>,
): ParsedStatement[] {
  const statements: ParsedStatement[] = [];
  let offset = 0;

  for (const record of records) {
    const content = record.text.trim();
    if (!content) continue;

    const { speakerName, speakerRole } = parseSpeaker(record.speaker);
    const contentHash = createHash("sha256").update(content).digest("hex");
    const startOffset = offset;
    const endOffset = offset + content.length;

    statements.push({
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

  return statements;
}

/**
 * 会議データから MeetingData を組み立てる。
 */
export function buildMeetingData(
  params: {
    title: string;
    ym: string;
    records: Array<{ speaker: string; text: string }>;
  },
  municipalityId: string,
): MeetingData | null {
  const statements = buildStatements(params.records);
  if (statements.length === 0) return null;

  return {
    municipalityId,
    title: params.title,
    meetingType: detectMeetingType(params.title),
    heldOn: ymToDate(params.ym),
    sourceUrl: `http://local-politics.jp/otaru/#/hatsugen`,
    externalId: `otaru_${params.title}_${params.ym}`,
    statements,
  };
}
