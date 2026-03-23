/**
 * 塙町議会 DiscussVision Smart — detail フェーズ
 *
 * schedule 単位で受け取った playlist アイテムを statements に変換する。
 *
 * 塙町は会議録テキスト（minute_text）が非公開のため、
 * playlist の content（発言サマリー）と speaker を使って
 * ParsedStatement を構築する。
 */

import { createHash } from "node:crypto";
import type { MeetingData, ParsedStatement } from "../../../utils/types";
import type { PlaylistItem } from "./list";
import { BASE_ORIGIN, detectMeetingType, parseScheduleDate } from "./shared";

/** 行政側の役職キーワード（答弁者として分類する） */
const ANSWER_KEYWORDS = [
  "町長",
  "副町長",
  "教育長",
  "課長",
  "部長",
  "局長",
  "室長",
  "係長",
  "参事",
  "主幹",
  "事務局長",
];

/** 進行役の役職キーワード */
const REMARK_KEYWORDS = ["議長", "副議長", "委員長", "副委員長"];

/**
 * speaker_id と speaker 名から発言種別を分類する。
 *
 * - speaker_id "0" → 発言者なし（議事進行等）→ remark
 * - speaker が null/空 → remark
 * - REMARK_KEYWORDS に含まれる → remark
 * - ANSWER_KEYWORDS に含まれる → answer
 * - それ以外（議員名）→ question
 */
export function classifyKind(
  speaker: string | null,
  speakerId: string,
): "remark" | "question" | "answer" {
  if (speakerId === "0" || !speaker) return "remark";

  for (const kw of REMARK_KEYWORDS) {
    if (speaker.includes(kw)) return "remark";
  }
  for (const kw of ANSWER_KEYWORDS) {
    if (speaker.includes(kw)) return "answer";
  }

  return "question";
}

/**
 * playlist アイテムの配列から ParsedStatement[] を生成する。
 * テスト可能な純粋関数。
 */
export function buildStatements(playlist: PlaylistItem[]): ParsedStatement[] {
  const statements: ParsedStatement[] = [];
  let offset = 0;

  for (const item of playlist) {
    const content = (item.content ?? "").trim();
    if (!content) continue;

    const kind = classifyKind(item.speaker, item.speaker_id);
    const contentHash = createHash("sha256").update(content).digest("hex");
    const startOffset = offset;
    const endOffset = offset + content.length;

    statements.push({
      kind,
      speakerName: item.speaker || null,
      speakerRole: null, // DiscussVision API は role を分離して提供しない
      content,
      contentHash,
      startOffset,
      endOffset,
    });

    offset = endOffset + 1;
  }

  return statements;
}

/** schedule の視聴ページ URL を構築する */
function buildScheduleUrl(councilId: string, scheduleId: string): string {
  return `${BASE_ORIGIN}/smart/tenant/hanawa/WebView/rd/schedule.html?council_id=${councilId}&schedule_id=${scheduleId}`;
}

/**
 * detailParams から MeetingData を組み立てる。
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
  municipalityId: string,
): MeetingData | null {
  const statements = buildStatements(params.playlist);
  if (statements.length === 0) return null;

  const heldOn = parseScheduleDate(params.scheduleLabel, params.councilYear);
  if (!heldOn) return null;

  const title = `${params.councilLabel} ${params.scheduleLabel}`;

  return {
    municipalityId,
    title,
    meetingType: detectMeetingType(params.councilLabel),
    heldOn,
    sourceUrl: buildScheduleUrl(params.councilId, params.scheduleId),
    externalId: `hanawa_${params.councilId}_${params.scheduleId}`,
    statements,
  };
}
