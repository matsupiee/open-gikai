/**
 * gijiroku-com バルクスクレイパー
 *
 * fetchMeetingList() → 各レコードに fetchMeetingDetail() → MeetingData[]
 */

import { fetchMeetingList, fetchMeetingDetail } from "@open-gikai/scrapers/gijiroku-com";
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
      `  [gijiroku-com] ${municipalityName}: ${year}年の一覧を取得中...`
    );

    const records = await fetchMeetingList(baseUrl, year);
    if (!records) {
      console.log(`  [gijiroku-com] ${municipalityName}: ${year}年 → 一覧取得失敗またはデータなし`);
      continue;
    }

    const remaining = meetingLimit ? meetingLimit - results.length : records.length;
    const limited = records.slice(0, remaining);
    const limitNote = meetingLimit ? ` (${limited.length}/${records.length} 件処理)` : "";

    console.log(
      `  [gijiroku-com] ${municipalityName}: ${year}年 → ${records.length} 件${limitNote}`
    );

    for (const record of limited) {
      const meeting = await fetchMeetingDetail(
        baseUrl,
        record.fino,
        municipalityId,
        record.unid,
        record.title,
        record.dateLabel
      );
      if (meeting) {
        results.push(meeting);
      }
    }
  }

  return results;
}
