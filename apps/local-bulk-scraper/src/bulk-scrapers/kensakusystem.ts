/**
 * kensakusystem バルクスクレイパー
 *
 * URL タイプ判定 → fetchFromSapphire/Cgi/IndexHtml()
 * → 各 schedule で fetchMeetingDataFromSchedule() → MeetingData[]
 */

import {
  isSapphireType,
  isCgiType,
  isIndexHtmlType,
  fetchFromSapphire,
  fetchFromCgi,
  fetchFromIndexHtml,
  extractSlugFromUrl,
  fetchMeetingDataFromSchedule,
} from "@open-gikai/scrapers/kensakusystem";
import type { MeetingData } from "@open-gikai/scrapers";

export async function scrapeAll(
  municipalityId: string,
  municipalityName: string,
  baseUrl: string,
  targetYear?: number,
  meetingLimit?: number
): Promise<MeetingData[]> {
  const results: MeetingData[] = [];

  const slug = extractSlugFromUrl(baseUrl);
  if (!slug) {
    console.warn(
      `  [kensakusystem] ${municipalityName}: slug 抽出失敗`
    );
    return results;
  }

  console.log(
    `  [kensakusystem] ${municipalityName}: 一覧を取得中...`
  );

  let schedules;
  if (isSapphireType(baseUrl)) {
    schedules = await fetchFromSapphire(baseUrl, targetYear);
  } else if (isCgiType(baseUrl)) {
    schedules = await fetchFromCgi(baseUrl, targetYear);
  } else if (isIndexHtmlType(baseUrl)) {
    schedules = await fetchFromIndexHtml(baseUrl, targetYear);
  } else {
    schedules = await fetchFromSapphire(baseUrl, targetYear);
  }

  if (!schedules || schedules.length === 0) {
    console.warn(
      `  [kensakusystem] ${municipalityName}: スケジュール取得失敗`
    );
    return results;
  }

  // targetYear フィルタを meetingLimit の前に適用する
  // （meetingLimit 後にフィルタすると、対象年度以外の会議を取得して除外されてしまう）
  const yearFiltered = targetYear
    ? schedules.filter((s) => {
        const year = new Date(s.heldOn).getFullYear();
        return year === targetYear;
      })
    : schedules;

  const limited = meetingLimit
    ? yearFiltered.slice(0, meetingLimit)
    : yearFiltered;
  const limitNote = meetingLimit ? ` (上限 ${meetingLimit} 件に制限)` : "";

  console.log(
    `  [kensakusystem] ${municipalityName}: ${limited.length} 件のスケジュールを処理${limitNote} (${yearFiltered.length} 件中)`
  );

  for (const schedule of limited) {
    const meeting = await fetchMeetingDataFromSchedule(
      schedule,
      municipalityId,
      slug
    );
    if (meeting) {
      results.push(meeting);
    }
  }

  return results;
}
