/**
 * 早川町議会 -- detail フェーズ
 *
 * 早川町公式サイトでは通常議会の会議録本文が公開されていないため、
 * スクレイピング対象データは存在しない。
 * fetchDetail は常に null を返す。
 */

import type { MeetingData } from "../../../utils/types";

/**
 * 詳細データを返す。
 * 早川町は通常議会の会議録を公開していないため、常に null を返す。
 */
export async function fetchMeetingData(
  _detailParams: Record<string, unknown>,
  _municipalityCode: string,
): Promise<MeetingData | null> {
  return null;
}
