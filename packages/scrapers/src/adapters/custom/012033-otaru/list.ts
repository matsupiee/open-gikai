/**
 * 小樽市議会 会議録 — list フェーズ
 *
 * API から全発言レコードを取得し、(title, ym) でグルーピングして会議一覧を返す。
 * 1レコード = 1発言なので、同じ (title, ym) の発言群が1つの会議に対応する。
 */

import {
  authenticate,
  fetchAllRecords,
  ymToCalendarYear,
  type HatsugenRecord,
} from "./shared";

/** グルーピングされた会議 */
export interface OtaruMeeting {
  title: string;
  ym: string;
  records: HatsugenRecord[];
}

/**
 * 発言レコードを (title, ym) でグルーピングする。
 * 順序はレコードの出現順を維持する。
 */
export function groupByMeeting(records: HatsugenRecord[]): OtaruMeeting[] {
  const map = new Map<string, OtaruMeeting>();

  for (const record of records) {
    const key = `${record.title}|${record.ym}`;
    let meeting = map.get(key);
    if (!meeting) {
      meeting = { title: record.title, ym: record.ym, records: [] };
      map.set(key, meeting);
    }
    meeting.records.push(record);
  }

  return [...map.values()];
}

/**
 * 指定カレンダー年の全会議を取得する。
 *
 * nendo（年度）はカレンダー年と異なるため、
 * year-1 と year の両方の nendo を取得し、ym でカレンダー年にフィルタする。
 */
export async function fetchMeetingList(
  year: number,
): Promise<OtaruMeeting[]> {
  const token = await authenticate();

  // nendo = year-1 (1月〜3月分) と nendo = year (4月〜12月分)
  const [prevRecords, currRecords] = await Promise.all([
    fetchAllRecords(year - 1, token),
    fetchAllRecords(year, token),
  ]);

  const allRecords = [...prevRecords, ...currRecords].filter(
    (r) => ymToCalendarYear(r.ym) === year,
  );

  return groupByMeeting(allRecords);
}
