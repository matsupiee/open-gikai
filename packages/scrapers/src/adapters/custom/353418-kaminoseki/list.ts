/**
 * 上関町議会 — list フェーズ
 *
 * 会議録ページ（https://www.town.kaminoseki.lg.jp/上関町議会　議事録.html）は
 * 2026年3月時点で HTTP 404 エラーのため、スクレイピング対象外。
 * fetchMeetingList は常に空配列を返す。
 */

export interface KaminosekiMeeting {
  /** 会議タイトル */
  title: string;
  /** 開催日 YYYY-MM-DD */
  heldOn: string;
  /** 会議録ページ URL */
  url: string;
}

/**
 * 指定年の会議録一覧を返す。
 *
 * 会議録ページが 404 エラーのため常に空配列を返す。
 * 会議録ページが復旧次第、スクレイピングロジックを実装すること。
 */
export async function fetchMeetingList(
  _year: number,
): Promise<KaminosekiMeeting[]> {
  // 会議録ページが 404 エラーのためスクレイピング不可
  // https://www.town.kaminoseki.lg.jp/上関町議会　議事録.html
  return [];
}
