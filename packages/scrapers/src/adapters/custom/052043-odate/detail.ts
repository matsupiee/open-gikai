/**
 * 大館市議会 — detail フェーズ
 *
 * list フェーズで収集済みの detailParams から MeetingData を組み立てる。
 * 会議録は PDF 形式のため、statements は空配列とする。
 */

import type { MeetingData } from "../../../utils/types";

export interface OdateDetailParams {
  title: string;
  heldOn: string | null;
  pdfUrl: string;
  meetingType: "plenary" | "extraordinary" | "committee";
  sessionGroupTitle: string;
  dayLabel: string;
}

/**
 * detailParams から MeetingData を組み立てる。
 * heldOn が null（日付解析不能）の場合は null を返す。
 */
export function buildMeetingData(
  params: OdateDetailParams,
  municipalityId: string
): MeetingData | null {
  if (params.heldOn === null) return null;

  // externalId は PDF URL から生成（各 PDF を一意に識別）
  const externalId = `odate_${encodeURIComponent(params.pdfUrl)}`;

  return {
    municipalityId,
    title: params.title,
    meetingType: params.meetingType,
    heldOn: params.heldOn,
    sourceUrl: params.pdfUrl,
    externalId,
    statements: [],
  };
}
