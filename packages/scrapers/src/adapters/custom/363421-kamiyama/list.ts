/**
 * 神山町議会 -- list フェーズ
 *
 * 神山町議会は会議録（本会議・委員会の議事録）を公開していないため、
 * スクレイピング対象データが存在しない。
 * fetchList は常に空配列を返す。
 */

/**
 * 指定年の会議一覧を返す。
 * 神山町は会議録を公開していないため、常に空配列を返す。
 */
export async function fetchMeetingList(
  _baseUrl: string,
  _year: number,
): Promise<[]> {
  return [];
}
