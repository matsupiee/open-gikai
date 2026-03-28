/**
 * 東吉野村議会 会議録 — list フェーズ
 *
 * 東吉野村は公式サイト上でテキスト形式の会議録を提供していないため、
 * 取得対象のレコードは存在しない。
 */

import type { ListRecord } from "../../adapter";

/**
 * 指定年の会議一覧を返す。
 * 会議録提供が確認できないため、常に空配列を返す。
 */
export async function fetchMeetingList(
  _baseUrl: string,
  _year: number,
): Promise<ListRecord[]> {
  return [];
}
