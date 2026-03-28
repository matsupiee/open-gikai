/**
 * 東吉野村議会 会議録 — detail フェーズ
 *
 * 東吉野村は公式サイト上でテキスト形式の会議録を提供していないため、
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
