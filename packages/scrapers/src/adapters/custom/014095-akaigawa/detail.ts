/**
 * 赤井川村議会 — detail フェーズ
 *
 * list フェーズで収集済みの detailParams から MeetingData を組み立てる。
 * PDF テキスト抽出は将来の PDF 抽出サービス対応時に追加するため、
 * 現時点では statements は空配列とする。
 */

import type { MeetingData } from "../../../utils/types";

export interface AkaigawaDetailParams {
  title: string;
  heldOn: string;
  pdfUrl: string;
  meetingType: string;
}

/**
 * detailParams から MeetingData を組み立てる。
 */
export function buildMeetingData(
  params: AkaigawaDetailParams,
  municipalityId: string
): MeetingData {
  return {
    municipalityId,
    title: params.title,
    meetingType: params.meetingType,
    heldOn: params.heldOn,
    sourceUrl: params.pdfUrl,
    externalId: `akaigawa_${params.heldOn}`,
    statements: [],
  };
}
