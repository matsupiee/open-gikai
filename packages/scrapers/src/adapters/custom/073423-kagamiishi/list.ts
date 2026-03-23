/**
 * 鏡石町議会 DiscussVision Smart — list フェーズ
 *
 * yearlist API で年一覧を取得し、councilrd/all API で各年の会議データを取得する。
 * 各 playlist エントリを1レコードとして返す。
 */

import type { ListRecord } from "../../adapter";
import {
  buildCouncilAllUrl,
  buildYearListUrl,
  fetchJson,
  type CouncilItem,
  type YearListItem,
} from "./shared";

export interface KagamiishiListRecord {
  councilId: string;
  councilLabel: string;
  councilYear: string; // "2025-06-13" 形式
  scheduleId: string;
  scheduleLabel: string;
  playlistId: string;
  speaker: string | null;
  speakerId: string;
  content: string | null;
}

/**
 * councilrd/all API のレスポンスから ListRecord の配列に変換する。
 */
export function parseCouncilList(councils: CouncilItem[]): KagamiishiListRecord[] {
  const records: KagamiishiListRecord[] = [];

  for (const council of councils) {
    for (const schedule of council.schedules) {
      for (const playlist of schedule.playlist) {
        records.push({
          councilId: council.council_id,
          councilLabel: council.label,
          councilYear: council.year,
          scheduleId: schedule.schedule_id,
          scheduleLabel: schedule.label,
          playlistId: playlist.playlist_id,
          speaker: playlist.speaker,
          speakerId: playlist.speaker_id,
          content: playlist.content,
        });
      }
    }
  }

  return records;
}

/**
 * 指定年の会議一覧を API から取得し、ListRecord の配列を返す。
 */
export async function fetchKagamiishiList(year: number): Promise<ListRecord[]> {
  const url = buildCouncilAllUrl(year);
  const councils = await fetchJson<CouncilItem[]>(url);
  if (!councils || councils.length === 0) return [];

  const records = parseCouncilList(councils);

  return records.map((r) => ({
    detailParams: r as unknown as Record<string, unknown>,
  }));
}

/**
 * yearlist API から利用可能な年リストを取得する。
 * 失敗時は空配列を返す。
 */
export async function fetchAvailableYears(): Promise<number[]> {
  const url = buildYearListUrl();
  const items = await fetchJson<YearListItem[]>(url);
  if (!items) return [];
  return items.map((item) => item.value);
}
