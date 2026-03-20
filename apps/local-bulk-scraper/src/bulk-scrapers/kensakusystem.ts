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
  baseUrl: string
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
    schedules = await fetchFromSapphire(baseUrl);
  } else if (isCgiType(baseUrl)) {
    schedules = await fetchFromCgi(baseUrl);
  } else if (isIndexHtmlType(baseUrl)) {
    schedules = await fetchFromIndexHtml(baseUrl);
  } else {
    schedules = await fetchFromSapphire(baseUrl);
  }

  if (!schedules || schedules.length === 0) {
    console.warn(
      `  [kensakusystem] ${municipalityName}: スケジュール取得失敗`
    );
    return results;
  }

  console.log(
    `  [kensakusystem] ${municipalityName}: ${schedules.length} 件のスケジュール`
  );

  for (const schedule of schedules) {
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
