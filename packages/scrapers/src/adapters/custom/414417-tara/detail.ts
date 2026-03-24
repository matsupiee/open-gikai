/**
 * 太良町議会 — detail フェーズ
 *
 * list フェーズで収集済みの detailParams から MeetingData を組み立てる。
 * PDF テキスト抽出は将来の PDF 抽出サービス対応時に追加するため、
 * 現時点では statements は空配列とする。
 */

import type { MeetingData } from "../../../utils/types";

export interface TaraDetailParams {
  title: string;
  heldOn: string;
  pdfUrl: string;
  meetingType: "plenary" | "extraordinary" | "committee";
  yearPageUrl: string;
}

/**
 * detailParams から MeetingData を組み立てる。
 */
export function buildMeetingData(
  params: TaraDetailParams,
  municipalityId: string
): MeetingData | null {
  // PDF URL のファイル名部分を ID のキーとして使用
  const fileName = decodeURIComponent(params.pdfUrl.split("/").pop() ?? "");
  const externalId = `tara_${params.heldOn}_${fileName.replace(/[^a-zA-Z0-9_\-]/g, "_")}`;

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
