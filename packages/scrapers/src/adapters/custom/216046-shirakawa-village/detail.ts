/**
 * 白川村議会 — detail フェーズ
 *
 * 白川村議会は発言全文テキスト形式の会議録を公開していないため、
 * fetchMeetingData は常に null を返す。
 *
 * 公開されているのは以下の PDF のみ:
 *   - 議事運営日程 (nittei)
 *   - 上程議案一覧 (gian)
 *   - 一般質問通告 (ippan)
 *   - 議会だより (gikai)
 *
 * 発言全文データが取得できないため、スクレイピングによる会議録収録は不可。
 * 詳細は docs/custom-scraping/shirakawa-village.md を参照。
 */

import type { MeetingData } from "../../../utils/types";
import type { ShirakawaVillagePdfLink } from "./list";

/**
 * 白川村議会は発言全文の会議録を公開していないため、常に null を返す。
 */
export async function fetchMeetingData(
  _link: ShirakawaVillagePdfLink,
  _municipalityId: string
): Promise<MeetingData | null> {
  // 発言全文テキスト形式の会議録は公開されていない。
  // statements が空になるため null を返す。
  return null;
}
