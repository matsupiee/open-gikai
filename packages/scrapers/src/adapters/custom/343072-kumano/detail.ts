/**
 * 熊野町議会（広島県） — detail フェーズ
 *
 * list フェーズで収集済みの detailParams から MeetingData を組み立てる。
 * PDF テキスト抽出は将来対応のため、現時点では statements は空配列とする。
 */

import type { MeetingData } from "../../../utils/types";

export interface KumanoDetailParams {
  title: string;
  heldOn: string | null;
  pdfUrl: string;
  meetingType: "plenary" | "extraordinary" | "committee";
}

/**
 * detailParams から MeetingData を組み立てる。
 */
export function buildMeetingData(
  params: KumanoDetailParams,
  municipalityCode: string
): MeetingData | null {
  if (!params.heldOn) return null;

  return {
    municipalityCode,
    title: params.title,
    meetingType: params.meetingType,
    heldOn: params.heldOn,
    sourceUrl: params.pdfUrl,
    externalId: `kumano_${encodeURIComponent(params.pdfUrl)}`,
    statements: [],
  };
}

/**
 * 役職サフィックスリスト（長い方を先に）
 */
const ROLE_SUFFIXES = [
  "副委員長",
  "委員長",
  "副議長",
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

// 行政側の役職（答弁者として分類する）
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
 * 発言テキストから話者名・役職・本文を抽出する。
 */
export function parseSpeaker(text: string): {
  speakerName: string | null;
  speakerRole: string | null;
  content: string;
} {
  const stripped = text.replace(/^[○◯◎●]\s*/, "");

  // 先頭の名前+役職部分を取得（スペースまで）
  const headerMatch = stripped.match(/^([^\s　]{1,30})[\s　]+/);
  if (!headerMatch?.[1]) {
    return { speakerName: null, speakerRole: null, content: stripped.trim() };
  }

  const header = headerMatch[1];
  const content = stripped.slice(headerMatch[0].length).trim();

  // 役職サフィックスにマッチする場合
  for (const suffix of ROLE_SUFFIXES) {
    if (header.endsWith(suffix)) {
      const name =
        header.length > suffix.length
          ? header.slice(0, -suffix.length)
          : null;
      return { speakerName: name, speakerRole: suffix, content };
    }
  }

  // ◯マーカーがある場合、役職が不明でも先頭を名前として扱う
  if (/^[○◯◎●]/.test(text)) {
    return { speakerName: header, speakerRole: null, content };
  }

  return { speakerName: null, speakerRole: null, content: stripped.trim() };
}

/** 役職から発言種別を分類 */
export function classifyKind(
  speakerRole: string | null
): "question" | "answer" | "remark" {
  if (!speakerRole) return "remark";
  if (ANSWER_ROLES.has(speakerRole)) return "answer";
  if (
    speakerRole === "議長" ||
    speakerRole === "副議長" ||
    speakerRole === "委員長" ||
    speakerRole === "副委員長"
  )
    return "remark";
  return "question";
}
