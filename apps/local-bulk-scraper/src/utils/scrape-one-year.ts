import type { MeetingData, ScraperAdapter } from "@open-gikai/scrapers";
import { DEFAULT_DETAIL_CONCURRENCY } from "./concurrency";

/**
 * ScraperAdapter を使って単一年度の議事録を取得する。
 */
export async function scrapeOneYear(
  adapter: ScraperAdapter,
  municipalityCode: string,
  municipalityName: string,
  baseUrl: string,
  year: number,
  meetingLimit?: number,
  detailConcurrency = DEFAULT_DETAIL_CONCURRENCY,
): Promise<MeetingData[]> {
  const results: MeetingData[] = [];

  console.log(`  [${adapter.name}] ${municipalityName}: ${year}年の一覧を取得中...`);

  const records = await adapter.fetchList({ baseUrl, year });
  if (records.length === 0) {
    console.log(`  [${adapter.name}] ${municipalityName}: ${year}年 → データなし`);
    return results;
  }

  const limited = meetingLimit ? records.slice(0, meetingLimit) : records;
  const limitNote = meetingLimit ? ` (${limited.length}/${records.length} 件処理)` : "";

  console.log(
    `  [${adapter.name}] ${municipalityName}: ${year}年 → ${records.length} 件${limitNote}`,
  );

  const executing = new Set<Promise<void>>();
  for (const record of limited) {
    const p: Promise<void> = adapter
      .fetchDetail({
        detailParams: record.detailParams,
        municipalityCode,
      })
      .then((meeting) => {
        if (meeting) results.push(meeting);
      })
      .finally(() => executing.delete(p));
    executing.add(p);
    if (executing.size >= detailConcurrency) {
      await Promise.race(executing);
    }
  }
  await Promise.all(executing);

  return results;
}
