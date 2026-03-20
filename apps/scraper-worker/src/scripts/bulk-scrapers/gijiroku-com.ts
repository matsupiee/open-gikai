/**
 * gijiroku-com バルクスクレイパー
 *
 * fetchMeetingList() → 各レコードに fetchMeetingDetail() → MeetingData[]
 */

import { fetchMeetingList } from "../../system-types/gijiroku-com/list/scraper";
import { fetchMeetingDetail } from "../../system-types/gijiroku-com/detail/scraper";
import type { MeetingData } from "../../utils/types";

export async function scrapeAll(
  municipalityId: string,
  municipalityName: string,
  baseUrl: string
): Promise<MeetingData[]> {
  const results: MeetingData[] = [];

  // 過去5年分をスクレイピング
  const currentYear = new Date().getFullYear();
  for (let year = currentYear; year >= currentYear - 4; year--) {
    console.log(
      `  [gijiroku-com] ${municipalityName}: ${year}年の一覧を取得中...`
    );

    const records = await fetchMeetingList(baseUrl, year);
    if (!records) continue;

    console.log(
      `  [gijiroku-com] ${municipalityName}: ${year}年 → ${records.length} 件`
    );

    for (const record of records) {
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
