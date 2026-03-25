/**
 * 滑川町議会 会議録 — list フェーズ
 *
 * DiscussVision Smart REST API から会議一覧を取得する。
 *
 * API エンドポイント:
 *   GET https://smart.discussvision.net/dvsapi/councilrd/all?tenant_id=570&year={year}
 *
 * レスポンス構造:
 *   council[] → schedules[] → playlist[]
 *   各 playlist エントリが発言単位
 */

import { API_BASE, TENANT_ID, SITE_BASE, fetchPage, detectMeetingType, extractDateFromScheduleLabel } from "./shared";

export interface PlaylistEntry {
  playlist_id: string;
  speaker: string | null;
  speaker_id: string;
  content: string;
  movie_name1?: string;
  movie_released?: string;
}

export interface Schedule {
  schedule_id: string;
  label: string;
  playlist: PlaylistEntry[];
}

export interface CouncilEntry {
  council_id: string;
  year: string;
  label: string;
  schedules: Schedule[];
}

export interface NamegawaListRecord {
  councilId: string;
  scheduleId: string;
  councilLabel: string;
  scheduleLabel: string;
  heldOn: string;
  councilYear: string;
  playlist: PlaylistEntry[];
}

/**
 * API レスポンスの JSON をパースして CouncilEntry[] に変換する。
 */
export function parseCouncilResponse(json: unknown): CouncilEntry[] {
  if (!Array.isArray(json)) return [];

  return json
    .filter(
      (item) =>
        item &&
        typeof item === "object" &&
        typeof item.council_id === "string" &&
        typeof item.year === "string" &&
        typeof item.label === "string" &&
        Array.isArray(item.schedules)
    )
    .map((item) => ({
      council_id: item.council_id,
      year: item.year,
      label: item.label,
      schedules: Array.isArray(item.schedules)
        ? item.schedules.map((s: unknown) => {
            if (!s || typeof s !== "object") return null;
            const sched = s as Record<string, unknown>;
            return {
              schedule_id: String(sched.schedule_id ?? ""),
              label: String(sched.label ?? ""),
              playlist: Array.isArray(sched.playlist)
                ? sched.playlist.map((p: unknown) => {
                    if (!p || typeof p !== "object") return null;
                    const pl = p as Record<string, unknown>;
                    return {
                      playlist_id: String(pl.playlist_id ?? ""),
                      speaker: pl.speaker != null ? String(pl.speaker) : null,
                      speaker_id: String(pl.speaker_id ?? "0"),
                      content: String(pl.content ?? ""),
                      movie_name1:
                        pl.movie_name1 != null ? String(pl.movie_name1) : undefined,
                      movie_released:
                        pl.movie_released != null ? String(pl.movie_released) : undefined,
                    } as PlaylistEntry;
                  }).filter(Boolean) as PlaylistEntry[]
                : [],
            } as Schedule;
          }).filter(Boolean) as Schedule[]
        : [],
    }));
}

/**
 * 指定年の会議一覧を API から取得する。
 * 各 schedule を1レコードとして返す。
 */
export async function fetchMeetingList(year: number): Promise<NamegawaListRecord[]> {
  const url = `${API_BASE}/councilrd/all?tenant_id=${TENANT_ID}&year=${year}`;
  const text = await fetchPage(url);
  if (!text) return [];

  let json: unknown;
  try {
    json = JSON.parse(text);
  } catch {
    console.warn(`[113417-namegawa] JSON パース失敗: ${url}`);
    return [];
  }

  const councils = parseCouncilResponse(json);
  const records: NamegawaListRecord[] = [];

  for (const council of councils) {
    for (const schedule of council.schedules) {
      const heldOn = extractDateFromScheduleLabel(schedule.label, council.year);
      if (!heldOn) continue;

      // speaker が設定されている playlist エントリのみ対象
      const validPlaylist = schedule.playlist.filter(
        (p) => p.speaker != null && p.speaker_id !== "0" && p.content.trim().length > 0
      );
      if (validPlaylist.length === 0) continue;

      records.push({
        councilId: council.council_id,
        scheduleId: schedule.schedule_id,
        councilLabel: council.label,
        scheduleLabel: schedule.label,
        heldOn,
        councilYear: council.year,
        playlist: validPlaylist,
      });
    }
  }

  return records;
}

/**
 * DiscussVision Smart の詳細 URL を生成する。
 */
export function buildSourceUrl(councilId: string, scheduleId: string): string {
  return `${SITE_BASE}/WebView/rd/schedule.html?council_id=${councilId}&schedule_id=${scheduleId}&year=`;
}

/**
 * 外部 ID を生成する。
 * e.g., councilId="19", scheduleId="1" → "namegawa_19_1"
 */
export function buildExternalId(councilId: string, scheduleId: string): string {
  return `namegawa_${councilId}_${scheduleId}`;
}

export { detectMeetingType };
