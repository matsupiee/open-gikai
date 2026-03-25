/**
 * 嬉野市議会 — detail フェーズ
 *
 * list フェーズで収集済みの detailParams から MeetingData を組み立てる。
 * PDF テキスト抽出は将来の PDF 抽出サービス対応時に追加するため、
 * 現時点では statements は空配列とする。
 */

import type { MeetingData } from "../../../utils/types";

export interface UreshinoDetailParams {
  title: string;
  heldOn: string;
  pdfUrl: string;
  meetingType: "plenary" | "extraordinary" | "committee";
  sessionPagePath: string;
}

/**
 * detailParams から MeetingData を組み立てる。
 */
export function buildMeetingData(
  params: UreshinoDetailParams,
  municipalityId: string
): MeetingData | null {
  // PDF URL のパス部分をIDのキーとして使用
  // 例: /var/rev0/0047/2592/1258610641.pdf → rev0_0047_2592_1258610641
  const pdfPathParts = params.pdfUrl
    .replace(/^https?:\/\/[^/]+/, "")
    .replace(/^\/var\//, "")
    .replace(/\.pdf$/, "")
    .replace(/\//g, "_");

  const externalId = `ureshino_${params.heldOn}_${pdfPathParts}`;

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
