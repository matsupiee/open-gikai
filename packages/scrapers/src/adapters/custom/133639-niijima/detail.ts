/**
 * 新島村議会 — detail フェーズ
 *
 * 新島村議会は DiscussVision 映像配信専用システムであり、
 * 全期間にわたってテキスト会議録が提供されていない。
 * minute_text は全データで空配列、vtt_name も全データ null、
 * minute/text API もエラーコード 2004 を返す。
 *
 * そのため、fetchMeetingData は常に null を返す。
 * メタ情報（会議タイトル・日付）のみ取得可能だが、statements が空のため
 * MeetingData として保存する価値がなく、スキップする。
 */

import type { MeetingData } from "../../../utils/types";
import type { NijimaRecord } from "./list";

/**
 * 新島村議会はテキスト会議録を提供していないため、
 * 常に null を返す。
 */
export function fetchMeetingData(
  _record: NijimaRecord,
  _municipalityId: string,
): Promise<MeetingData | null> {
  // テキスト会議録なし（映像配信専用）
  return Promise.resolve(null);
}
