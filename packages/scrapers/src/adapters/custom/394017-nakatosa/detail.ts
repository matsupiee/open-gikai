/**
 * 中土佐町議会 — detail フェーズ
 *
 * 中土佐町議会は DiscussVision 映像配信専用システムであり、
 * 全期間にわたってテキスト会議録が提供されていない。
 *
 * そのため、fetchDetail は常に null を返す。
 * メタ情報（会議タイトル・日付）のみ取得可能だが、statements が空のため
 * MeetingData として保存する価値がなく、スキップする。
 */

import type { MeetingData } from "../../../utils/types";
import type { NakatosaRecord } from "./list";

/**
 * 中土佐町議会はテキスト会議録を提供していないため、
 * 常に null を返す。
 */
export function fetchMeetingData(
  _record: NakatosaRecord,
  _municipalityId: string,
): Promise<MeetingData | null> {
  // テキスト会議録なし（映像配信専用）
  return Promise.resolve(null);
}
