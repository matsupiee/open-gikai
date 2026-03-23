/**
 * 神山町議会 -- detail フェーズ
 *
 * 神山町議会は会議録（本会議・委員会の議事録）を公開していないため、
 * スクレイピング対象データが存在しない。
 * fetchDetail は常に null を返す。
 */

import type { MeetingData } from "../../../utils/types";

/**
 * 詳細データを返す。
 * 神山町は会議録を公開していないため、常に null を返す。
 */
export async function fetchMeetingData(
  _detailParams: Record<string, unknown>,
  _municipalityId: string,
): Promise<MeetingData | null> {
  return null;
}
