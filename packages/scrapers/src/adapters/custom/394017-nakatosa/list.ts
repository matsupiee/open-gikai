/**
 * 中土佐町議会 — list フェーズ
 *
 * DiscussVision JSONP API から会議一覧を取得する。
 *
 * API エンドポイント:
 *   GET /dvsapi/councilrd/all?tenant_id=182&year={year}&callback={fn}
 *
 * テキスト会議録は全レコードで空配列のため、メタ情報のみを収集する。
 */

import { BASE_ORIGIN, TENANT_ID, fetchJsonp, parseJapaneseDate, detectMeetingType } from "./shared";

/** DiscussVision API の playlist アイテム */
interface DvsPlaylistItem {
  playlist_id: string;
  speaker: string | null;
  speaker_id: string | null;
  content: string | null;
  movie_name1: string | null;
  vtt_name: string | null;
  movie_released: string;
  minute_text: unknown[];
}

/** DiscussVision API の schedule アイテム */
interface DvsSchedule {
  schedule_id: string;
  label: string;
  is_newest: boolean;
  playlist: DvsPlaylistItem[];
  minute_text: unknown[];
}

/** DiscussVision API の council アイテム */
interface DvsCouncil {
  council_id: string;
  year: string; // "YYYY-MM-DD" 形式（会議の開始日に相当）
  label: string; // 例: "令和7年3月定例会（通常会議）"
  schedules: DvsSchedule[];
}

export interface NakatosaRecord {
  /** 会議 ID */
  councilId: string;
  /** 日程 ID */
  scheduleId: string;
  /** 会議タイトル（例: "令和7年3月定例会（通常会議）"） */
  councilLabel: string;
  /** 日程ラベル（例: "3月13日　個別質問"） */
  scheduleLabel: string;
  /** 開催日 YYYY-MM-DD。API の year フィールドから取得 */
  heldOn: string | null;
  /** 会議タイプ */
  meetingType: string;
  /** ソース URL（映像ページ） */
  sourceUrl: string;
}

/**
 * DiscussVision API レスポンスから会議レコードの配列を生成する。
 * schedule ごとに 1 レコードを生成する。
 */
export function parseCouncilList(data: unknown): NakatosaRecord[] {
  if (!Array.isArray(data)) return [];

  const results: NakatosaRecord[] = [];

  for (const council of data as DvsCouncil[]) {
    if (!council.council_id || !council.label) continue;

    // API の year フィールドは "YYYY-MM-DD" 形式
    const heldOn = council.year && /^\d{4}-\d{2}-\d{2}$/.test(council.year)
      ? council.year
      : parseJapaneseDate(council.label);

    const meetingType = detectMeetingType(council.label);
    const sourceUrl = `${BASE_ORIGIN}/smart/tenant/nakatosa/WebView/rd/council_1.html`;

    if (!Array.isArray(council.schedules) || council.schedules.length === 0) {
      // schedule がない場合は council 単位でレコードを作成
      results.push({
        councilId: council.council_id,
        scheduleId: "0",
        councilLabel: council.label,
        scheduleLabel: "",
        heldOn,
        meetingType,
        sourceUrl,
      });
      continue;
    }

    for (const schedule of council.schedules) {
      if (!schedule.schedule_id) continue;
      results.push({
        councilId: council.council_id,
        scheduleId: schedule.schedule_id,
        councilLabel: council.label,
        scheduleLabel: schedule.label ?? "",
        heldOn,
        meetingType,
        sourceUrl,
      });
    }
  }

  return results;
}

/**
 * 指定年の会議一覧を DiscussVision API から取得する。
 */
export async function fetchDocumentList(year: number): Promise<NakatosaRecord[]> {
  const url = `${BASE_ORIGIN}/dvsapi/councilrd/all?tenant_id=${TENANT_ID}&year=${year}`;
  const data = await fetchJsonp(url);
  if (!data) {
    console.warn(`[394017-nakatosa] No data returned for year=${year}`);
    return [];
  }
  return parseCouncilList(data);
}
