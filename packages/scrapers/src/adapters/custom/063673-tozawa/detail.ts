/**
 * 戸沢村議会 — detail フェーズ
 *
 * 戸沢村議会は DiscussVision 映像配信専用システムであり、
 * 全期間にわたってテキスト会議録が提供されていない。
 *
 * そのため、fetchMeetingData は常に null を返す。
 * メタ情報（会議タイトル・日付）のみ取得可能だが、statements が空のため
 * MeetingData として保存する価値がなく、スキップする。
 */

import type { MeetingData } from "../../../utils/types";
import type { TozawaRecord } from "./list";

/**
 * 戸沢村議会はテキスト会議録を提供していないため、
 * 常に null を返す。
 */
export function fetchMeetingData(
  _record: TozawaRecord,
  _municipalityCode: string,
): Promise<MeetingData | null> {
  // テキスト会議録なし（映像配信専用）
  return Promise.resolve(null);
}
