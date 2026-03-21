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
  targetYear?: number
): Promise<MeetingData[]> {
  const results: MeetingData[] = [];

  const currentYear = new Date().getFullYear();
  const years = targetYear
    ? [targetYear]
    : Array.from({ length: 5 }, (_, i) => currentYear - i);

  for (const year of years) {
    console.log(
      `  [dbsearch] ${municipalityName}: ${year}年の一覧を取得中...`
    );

    const records = await fetchMeetingList(baseUrl, year);
    if (!records) continue;

    console.log(
      `  [dbsearch] ${municipalityName}: ${year}年 → ${records.length} 件`
    );

    for (const record of records) {
      const meeting = await fetchMeetingDetail(
        record.url,
        municipalityId,
        record.id,
        record.title
      );
      if (meeting) {
        results.push(meeting);
      }
    }
  }

  return results;
}
