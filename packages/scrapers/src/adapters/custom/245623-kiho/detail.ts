/**
 * 紀宝町議会 JFIT 映像配信システム — detail フェーズ
 *
 * 紀宝町はテキスト形式の会議録を提供していないため、
 * 詳細データは取得できない。
 */

import type { MeetingData } from "../../../utils/types";

/**
 * 会議詳細データを返す。
 * テキスト会議録が存在しないため、常に null を返す。
 */
export async function fetchMeetingData(
  _params: Record<string, unknown>,
  _municipalityCode: string,
): Promise<MeetingData | null> {
  return null;
}
