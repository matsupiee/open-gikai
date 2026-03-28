/**
 * 檜枝岐村議会 -- detail フェーズ
 *
 * 2026-03-28 時点で通常議会の会議録本文が公開されていないため、
 * スクレイピング対象データは存在しない。
 */

import type { MeetingData } from "../../../utils/types";

export async function fetchMeetingData(
  _detailParams: Record<string, unknown>,
  _municipalityCode: string,
): Promise<MeetingData | null> {
  return null;
}
