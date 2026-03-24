/**
 * 河北町議会 DiscussVision Smart — list フェーズ
 *
 * 年度ごとの会議一覧 API から council → schedule → playlist を展開し、
 * 各 schedule を1レコードとして返す。
 *
 * playlist（発言者単位）は detail フェーズで statements に変換するため、
 * schedule 単位でまとめて detailParams に渡す。
 */

import { buildCouncilListUrl, fetchJsonp } from "./shared";

/** API レスポンスの playlist アイテム */
export interface PlaylistItem {
  playlist_id: string;
  speaker: string | null;
  speaker_id: string;
  content: string;
  movie_name1: string;
  movie_released: string;
}

/** API レスポンスの schedule */
export interface ScheduleItem {
  schedule_id: string;
  label: string;
  playlist: PlaylistItem[];
}

/** API レスポンスの council */
export interface CouncilItem {
  council_id: string;
  year: string; // "YYYY-MM-DD" 形式の開始日
  label: string;
  schedules: ScheduleItem[];
}

/** list フェーズで返すレコード */
export interface KahokuListRecord {
  councilId: string;
  councilLabel: string;
  councilYear: string;
  scheduleId: string;
  scheduleLabel: string;
  playlist: PlaylistItem[];
}

/**
 * API レスポンス（CouncilItem[]）から KahokuListRecord[] に展開する。
 * テスト可能な純粋関数。
 */
export function expandCouncils(councils: CouncilItem[]): KahokuListRecord[] {
  const records: KahokuListRecord[] = [];

  for (const council of councils) {
    for (const schedule of council.schedules) {
      // playlist が空の schedule はスキップ
      if (schedule.playlist.length === 0) continue;

      records.push({
        councilId: council.council_id,
        councilLabel: council.label,
        councilYear: council.year,
        scheduleId: schedule.schedule_id,
        scheduleLabel: schedule.label,
        playlist: schedule.playlist,
      });
    }
  }

  return records;
}

/**
 * 指定年の全会議データを API から取得し、schedule 単位のレコードに展開する。
 */
export async function fetchCouncilList(
  year: number,
): Promise<KahokuListRecord[]> {
  const url = buildCouncilListUrl(year);
  const data = await fetchJsonp(url);
  if (!data || !Array.isArray(data)) return [];
  return expandCouncils(data as CouncilItem[]);
}
