/**
 * 有田市議会 — detail フェーズ
 *
 * list フェーズで収集済みの detailParams から MeetingData を組み立てる。
 * PDF テキスト抽出は将来の PDF 抽出サービス対応時に追加するため、
 * 現時点では statements は空配列とする。
 */

import type { MeetingData } from "../../../utils/types";

export interface AridaDetailParams {
  title: string;
  heldOn: string;
  pdfUrl: string;
  meetingType: string;
  meetingId: string;
}

/**
 * detailParams から MeetingData を組み立てる。
 */
export function buildMeetingData(
  params: AridaDetailParams,
  municipalityId: string,
): MeetingData {
  return {
    municipalityId,
    title: params.title,
    meetingType: params.meetingType,
    heldOn: params.heldOn,
    sourceUrl: params.pdfUrl,
    externalId: `arida_${params.meetingId}_${params.heldOn}`,
    statements: [],
  };
}
