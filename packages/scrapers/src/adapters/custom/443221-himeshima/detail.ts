/**
 * 姫島村議会 — detail フェーズ
 *
 * 2026-03-28 時点では発言全文の会議録 PDF を確認できず、
 * 取得可能な議会関連資料も案内資料・通告資料に限られるため null を返す。
 */

import type { MeetingData } from "../../../utils/types";
import type { HimeshimaDocumentLink } from "./list";

export async function fetchMeetingData(
  _link: HimeshimaDocumentLink,
  _municipalityCode: string
): Promise<MeetingData | null> {
  return null;
}
