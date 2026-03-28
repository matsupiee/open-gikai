/**
 * 檜枝岐村議会 -- list フェーズ
 *
 * 2026-03-28 時点で、檜枝岐村公式サイトには通常議会の会議録本文や PDF が公開されていない。
 * そのため fetchMeetingList は常に空配列を返す。
 */

export interface HinoemataMeeting extends Record<string, unknown> {
  sourceUrl: string;
}

export async function fetchMeetingList(
  _baseUrl: string,
  _year: number,
): Promise<HinoemataMeeting[]> {
  return [];
}
