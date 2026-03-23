/**
 * 筑北村議会（実態: 筑西市議会） — list フェーズ
 *
 * DiscussVision Smart API の councilrd/all エンドポイントから
 * 会議一覧（council → schedule）を取得する。
 *
 * API レスポンス構造:
 *   [
 *     {
 *       council_id: "72",
 *       year: "2024-01-16",         // 会議の日付
 *       label: "令和６年１月臨時会",
 *       schedules: [
 *         {
 *           schedule_id: "1",
 *           label: "01月16日　開会",
 *           playlist: [...],         // 発言者・議題情報
 *           minute_text: [],         // 常に空
 *         }
 *       ]
 *     }
 *   ]
 */

import { TENANT_ID, fetchJson, normalizeFullWidth } from "./shared";

export interface PlaylistItem {
  playlist_id: string;
  speaker: string | null;
  speaker_id: string;
  content: string;
}

export interface ScheduleItem {
  schedule_id: string;
  label: string;
  playlist: PlaylistItem[];
}

export interface CouncilItem {
  council_id: string;
  year: string;
  label: string;
  schedules: ScheduleItem[];
}

export interface ChikuhokuDocument {
  councilId: string;
  councilLabel: string;
  councilYear: string;
  scheduleId: string;
  scheduleLabel: string;
  playlist: PlaylistItem[];
}

/**
 * API レスポンスからドキュメント一覧をパースする。
 */
export function parseCouncilResponse(
  councils: CouncilItem[],
): ChikuhokuDocument[] {
  const documents: ChikuhokuDocument[] = [];

  for (const council of councils) {
    for (const schedule of council.schedules) {
      // playlist が空のスケジュールはスキップ
      if (schedule.playlist.length === 0) continue;

      documents.push({
        councilId: council.council_id,
        councilLabel: normalizeFullWidth(council.label).trim(),
        councilYear: council.year,
        scheduleId: schedule.schedule_id,
        scheduleLabel: normalizeFullWidth(schedule.label).trim(),
        playlist: schedule.playlist,
      });
    }
  }

  return documents;
}

/**
 * 指定年の全会議ドキュメント一覧を取得する。
 */
export async function fetchDocumentList(
  year: number,
): Promise<ChikuhokuDocument[]> {
  const data = await fetchJson<CouncilItem[]>("councilrd/all", {
    tenant_id: TENANT_ID,
    year,
  });

  if (!data || !Array.isArray(data)) return [];

  return parseCouncilResponse(data);
}
