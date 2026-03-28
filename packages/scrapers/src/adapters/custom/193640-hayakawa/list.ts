/**
 * 早川町議会 -- list フェーズ
 *
 * 2026-03-27 時点で公開されているのは議会トップページと模擬議会ページのみで、
 * 本会議・委員会の会議録本文は見当たらない。
 * 模擬議会 PDF は通常議会の会議録ではないため対象外とし、
 * fetchMeetingList は常に空配列を返す。
 */

export interface HayakawaMeeting extends Record<string, unknown> {
  sourceUrl: string;
}

/**
 * 指定年の会議一覧を返す。
 * 早川町は通常議会の会議録を公開していないため、常に空配列を返す。
 */
export async function fetchMeetingList(
  _baseUrl: string,
  _year: number,
): Promise<HayakawaMeeting[]> {
  return [];
}
