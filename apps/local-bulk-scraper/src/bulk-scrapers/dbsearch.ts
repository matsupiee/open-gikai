/**
 * dbsearch バルクスクレイパー
 *
 * fetchMeetingList() → 各 URL に fetchMeetingDetail() → MeetingData[]
 */

import { fetchMeetingList, fetchMeetingDetail } from "@open-gikai/scrapers/dbsearch";
import type { MeetingData } from "@open-gikai/scrapers";

export async function scrapeAll(
  municipalityId: string,
  municipalityName: string,
  baseUrl: string,
  targetYear?: number,
  meetingLimit?: number
): Promise<MeetingData[]> {
  const results: MeetingData[] = [];

  const currentYear = new Date().getFullYear();
  const years = targetYear
    ? [targetYear]
    : Array.from({ length: 5 }, (_, i) => currentYear - i);

  for (const year of years) {
    if (meetingLimit && results.length >= meetingLimit) break;

    console.log(
      `  [dbsearch] ${municipalityName}: ${year}年の一覧を取得中...`
    );

    const records = await fetchMeetingList(baseUrl, year);
    if (!records) {
      console.log(`  [dbsearch] ${municipalityName}: ${year}年 → 一覧取得失敗またはデータなし`);
      continue;
    }

    const remaining = meetingLimit ? meetingLimit - results.length : records.length;
    const limited = records.slice(0, remaining);
    const limitNote = meetingLimit ? ` (${limited.length}/${records.length} 件処理)` : "";

    console.log(
      `  [dbsearch] ${municipalityName}: ${year}年 → ${records.length} 件${limitNote}`
    );

    for (const record of limited) {
      const meeting = await fetchMeetingDetail(
        record.url,
        municipalityId,
        record.id,
        record.title,
        record.date ?? undefined
      );
      if (meeting) {
        results.push(meeting);
      }
    }
  }

  return results;
}
