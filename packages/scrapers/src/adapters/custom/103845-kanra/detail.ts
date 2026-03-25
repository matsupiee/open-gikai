/**
 * 甘楽町議会 — detail フェーズ
 *
 * list フェーズで収集済みの detailParams から MeetingData を組み立てる。
 * 会議録は PDF 形式で提供されており、現時点では statements は空配列とする。
 */

import type { MeetingData } from "../../../utils/types";
import { detectMeetingType } from "./shared";

export interface KanraDetailParams {
  title: string;
  heldOn: string | null;
  pdfUrl: string;
  meetingType: "plenary" | "extraordinary" | "committee";
  detailPageUrl: string;
  sessionIndex: number;
}

/**
 * detailParams から MeetingData を組み立てる。
 * heldOn が null の場合は null を返す（フォールバック値禁止）。
 */
export function buildMeetingData(
  params: KanraDetailParams,
  municipalityCode: string,
): MeetingData | null {
  if (params.heldOn === null) return null;

  return {
    municipalityCode,
    title: params.title,
    meetingType: detectMeetingType(params.title),
    heldOn: params.heldOn,
    sourceUrl: params.pdfUrl,
    externalId: `kanra_${params.detailPageUrl.split("/").pop()?.replace(".html", "")}_${params.sessionIndex}`,
    statements: [],
  };
}
