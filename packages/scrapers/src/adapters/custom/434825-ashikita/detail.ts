/**
 * 芦北町議会 — detail フェーズ
 *
 * list フェーズで収集済みの detailParams から MeetingData を組み立てる。
 * PDF テキスト抽出は将来の PDF 抽出サービス対応時に追加するため、
 * 現時点では statements は空配列とする。
 */

import type { MeetingData } from "../../../utils/types";

export interface AshikitaDetailParams {
  title: string;
  pdfUrl: string;
  meetingType: string;
  year: number;
  yearSlug: string;
}

/**
 * リンクテキストから開催日を推定する。
 * 芦北町の PDF は1会議ごとに1ファイルで、具体的な開催日はリンクテキストに含まれないため、
 * 年度と回次から推定する。
 * 具体的な日付が不明な場合は年の1月1日をデフォルトとする。
 */
export function estimateHeldOn(title: string, year: number): string {
  // タイトルに「第N回定例会」を含む場合、四半期の中心月を推定
  const sessionMatch = title.match(/第(\d+)回/);
  if (sessionMatch?.[1]) {
    const session = parseInt(sessionMatch[1], 10);
    // 日本の地方議会の一般的なスケジュール
    // 第1回: 3月, 第2回: 6月, 第3回: 9月, 第4回: 12月
    const monthMap: Record<number, string> = {
      1: "03-01",
      2: "06-01",
      3: "09-01",
      4: "12-01",
    };
    const monthDay = monthMap[session];
    if (monthDay) {
      return `${year}-${monthDay}`;
    }
  }
  return `${year}-01-01`;
}

/**
 * detailParams から MeetingData を組み立てる。
 */
export function buildMeetingData(
  params: AshikitaDetailParams,
  municipalityId: string,
): MeetingData {
  const heldOn = estimateHeldOn(params.title, params.year);

  return {
    municipalityId,
    title: params.title,
    meetingType: params.meetingType,
    heldOn,
    sourceUrl: params.pdfUrl,
    externalId: `ashikita_${params.yearSlug}_${params.title}`,
    statements: [],
  };
}
