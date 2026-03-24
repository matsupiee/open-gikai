/**
 * 紀宝町議会 JFIT 映像配信システム — list フェーズ
 *
 * 紀宝町はテキスト形式の会議録を提供していないため、
 * 取得対象のレコードは存在しない。
 */

import type { ListRecord } from "../../adapter";

/**
 * 指定年の会議一覧を返す。
 * テキスト会議録が存在しないため、常に空配列を返す。
 */
export async function fetchMeetingList(
  _baseUrl: string,
  _year: number,
): Promise<ListRecord[]> {
  return [];
}
