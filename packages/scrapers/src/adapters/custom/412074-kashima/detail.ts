/**
 * 鹿島市議会 — detail フェーズ
 *
 * list フェーズで収集済みの detailParams から MeetingData を組み立てる。
 * PDF テキスト抽出は将来の PDF 抽出サービス対応時に追加するため、
 * 現時点では statements は空配列とする。
 */

import type { MeetingData } from "../../../utils/types";

export interface KashimaDetailParams {
  title: string;
  heldOn: string;
  pdfUrl: string;
  meetingType: "plenary" | "extraordinary" | "committee";
  yearPagePath: string;
}

/**
 * detailParams から MeetingData を組み立てる。
 * statements が空なら null を返す（PDFはまだ処理しない）。
 */
export function buildMeetingData(
  params: KashimaDetailParams,
  municipalityCode: string
): MeetingData | null {
  // PDF URL の末尾ファイル名をIDのキーとして使用
  const fileName = decodeURIComponent(params.pdfUrl.split("/").pop() ?? "");
  const externalId = `kashima_${params.heldOn}_${fileName.replace(/[^a-zA-Z0-9_\-]/g, "_")}`;

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
