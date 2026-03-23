/**
 * 上関町議会 — detail フェーズ
 *
 * 会議録ページが 404 エラーのため、detail フェーズは実装不要。
 * list フェーズが常に空配列を返すため、fetchMeetingData は呼ばれない。
 */

import type { MeetingData } from "../../../utils/types";
import type { KaminosekiMeeting } from "./list";

/**
 * 会議録の詳細データを構築する。
 *
 * 会議録ページが 404 エラーのため現時点では呼ばれないが、
 * ScraperAdapter インターフェースを満たすために定義する。
 */
export async function fetchMeetingData(
  _params: KaminosekiMeeting,
  _municipalityId: string,
): Promise<MeetingData | null> {
  // 会議録ページが 404 エラーのためスクレイピング不可
  return null;
}
