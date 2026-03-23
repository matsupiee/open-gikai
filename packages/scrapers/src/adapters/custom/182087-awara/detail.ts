/**
 * あわら市議会 — detail フェーズ
 *
 * list フェーズで収集済みの detailParams から MeetingData を組み立てる。
 * PDF テキスト抽出は将来の PDF 抽出サービス対応時に追加するため、
 * 現時点では statements は空配列とする。
 */

import type { MeetingData } from "../../../utils/types";

export interface AwaraDetailParams {
  title: string;
  pdfUrl: string;
  meetingType: string;
  pagePath: string;
}

/**
 * detailParams から MeetingData を組み立てる。
 *
 * heldOn は PDF からのテキスト抽出が未対応のため、
 * pdfUrl のファイル名から推定できない場合は年度情報を使用する。
 */
export function buildMeetingData(
  params: AwaraDetailParams,
  municipalityId: string,
): MeetingData {
  // externalId: pagePath のファイル名部分 + PDF ファイル名で一意性を確保
  const pageFile = params.pagePath.split("/").pop()?.replace(/\.html$/, "") ?? "";
  const pdfFile = params.pdfUrl.split("/").pop()?.replace(/\.pdf$/i, "") ?? "";
  const externalId = `awara_${pageFile}_${pdfFile}`;

  return {
    municipalityId,
    title: params.title,
    meetingType: params.meetingType,
    heldOn: "",
    sourceUrl: params.pdfUrl,
    externalId,
    statements: [],
  };
}
