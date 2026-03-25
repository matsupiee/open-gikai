/**
 * 羽後町議会 — detail フェーズ
 *
 * list フェーズで収集済みの detailParams から MeetingData を組み立てる。
 * 会議録は PDF 形式のため、statements は空配列とする。
 */

import type { MeetingData } from "../../../utils/types";

export interface UgoDetailParams {
  title: string;
  heldOn: string | null;
  pdfUrl: string;
  meetingType: "plenary" | "extraordinary" | "committee";
  yearPageUrl: string;
  pdfLabel: string;
  meetingName: string;
}

/**
 * detailParams から MeetingData を組み立てる。
 * heldOn が null（日付解析不能）の場合は null を返す。
 */
export function buildMeetingData(
  params: UgoDetailParams,
  municipalityCode: string
): MeetingData | null {
  if (params.heldOn === null) return null;

  // externalId は yearPageUrl + meetingName + pdfLabel から生成
  const externalId = `ugo_${encodeURIComponent(params.yearPageUrl)}_${encodeURIComponent(params.meetingName)}_${encodeURIComponent(params.pdfLabel)}`;

  return {
    municipalityCode,
    title: params.title,
    meetingType: params.meetingType,
    heldOn: params.heldOn,
    sourceUrl: params.pdfUrl,
    externalId,
    statements: [],
  };
}
