/**
 * 小坂町議会 — detail フェーズ
 *
 * list フェーズで収集済みの detailParams から MeetingData を組み立てる。
 * 会議録は PDF 形式のため、statements は空配列とする。
 */

import type { MeetingData } from "../../../utils/types";

export interface KosakaDetailParams {
  title: string;
  heldOn: string | null;
  pdfUrl: string;
  meetingType: "plenary" | "extraordinary" | "committee";
  detailUrl: string;
  pdfLabel: string;
}

/**
 * detailParams から MeetingData を組み立てる。
 * heldOn が null（日付解析不能）の場合は null を返す。
 */
export function buildMeetingData(
  params: KosakaDetailParams,
  municipalityId: string
): MeetingData | null {
  if (params.heldOn === null) return null;

  // externalId は detailUrl + pdfLabel から生成（同一会議の複数 PDF を区別）
  const externalId = `kosaka_${encodeURIComponent(params.detailUrl)}_${encodeURIComponent(params.pdfLabel)}`;

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
