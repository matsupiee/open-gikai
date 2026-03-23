/**
 * 鏡石町議会 DiscussVision Smart — 共通ユーティリティ
 *
 * サイト: https://smart.discussvision.net/smart/tenant/kagamiishi/WebView/rd/council_1.html
 * API ベース: https://smart.discussvision.net/dvsapi/
 */

export const TENANT_ID = "685";
export const API_BASE = "https://smart.discussvision.net/dvsapi";
export const VIEW_BASE =
  "https://smart.discussvision.net/smart/tenant/kagamiishi/WebView/rd";

const USER_AGENT =
  "open-gikai-bot/1.0 (https://github.com/matsupiee/open-gikai; contact: please see github)";

const FETCH_TIMEOUT_MS = 30_000;

/** fetch して JSON を返す。失敗時は null */
export async function fetchJson<T>(url: string): Promise<T | null> {
  try {
    const res = await fetch(url, {
      headers: { "User-Agent": USER_AGENT },
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    });
    if (!res.ok) {
      console.warn(`[kagamiishi] fetch failed: ${res.status} ${url}`);
      return null;
    }
    return (await res.json()) as T;
  } catch (err) {
    console.warn(`[kagamiishi] fetch error: ${url}`, err);
    return null;
  }
}

/** 年一覧 API の URL */
export function buildYearListUrl(): string {
  return `${API_BASE}/yearlist?tenant_id=${TENANT_ID}`;
}

/** 会議一覧 API の URL */
export function buildCouncilAllUrl(year: number): string {
  return `${API_BASE}/councilrd/all?tenant_id=${TENANT_ID}&year=${year}`;
}

/** 発言詳細ページの URL */
export function buildSpeechUrl(
  councilId: string,
  scheduleId: string,
  playlistId: string,
): string {
  return `${VIEW_BASE}/speech.html?council_id=${councilId}&schedule_id=${scheduleId}&playlist_id=${playlistId}`;
}

/**
 * 会議ラベルから会議種別を分類する。
 */
export function classifyMeetingType(
  label: string,
): "plenary" | "extraordinary" | "committee" | "other" {
  if (label.includes("委員会")) return "committee";
  if (label.includes("臨時会")) return "extraordinary";
  if (label.includes("定例会")) return "plenary";
  return "other";
}

/** yearlist API のレスポンス要素 */
export interface YearListItem {
  label: string;
  value: number;
}

/** councilrd/all API のレスポンス要素 */
export interface CouncilItem {
  council_id: string;
  year: string; // ISO date 形式 e.g. "2025-06-13"
  label: string;
  schedules: ScheduleItem[];
}

export interface ScheduleItem {
  schedule_id: string;
  label: string;
  is_newest: boolean;
  playlist: PlaylistItem[];
  minute_text: unknown[];
}

export interface PlaylistItem {
  playlist_id: string;
  speaker_img: string | null;
  speaker: string | null;
  speaker_id: string;
  content: string | null;
  movie_name1: string | null;
  movie_released: string;
}
