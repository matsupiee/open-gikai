/**
 * 戸沢村議会 — list フェーズ
 *
 * DiscussVision API から会議一覧を取得する。
 *
 * API エンドポイント:
 *   GET /dvsapi/councilrd/all?tenant_id=486&year={year}
 *
 * テキスト会議録は全レコードで空配列のため、メタ情報のみを収集する。
 * 発言者情報も全件 null のため、schedule 単位でレコードを生成する。
 */

import { BASE_ORIGIN, TENANT_ID, fetchJson, detectMeetingType } from "./shared";

/** DiscussVision API の playlist アイテム */
interface DvsPlaylistItem {
  playlist_id: string;
  speaker: string | null;
  speaker_id: string | null;
  content: string | null;
  movie_name1: string | null;
  vtt_name: string | null;
  movie_released: string;
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
  label: string; // 例: "令和6年第1回定例会"
  schedules: DvsSchedule[];
}

export interface TozawaRecord {
  /** 会議 ID */
  councilId: string;
  /** 日程 ID */
  scheduleId: string;
  /** 会議タイトル（例: "令和6年第1回定例会"） */
  councilLabel: string;
  /** 日程ラベル（例: "01月23日　本会議"） */
  scheduleLabel: string;
  /** 開催日 YYYY-MM-DD。schedule.label の月日と council.year の年部分から構成 */
  heldOn: string | null;
  /** 会議タイプ */
  meetingType: string;
  /** ソース URL（映像ページ） */
  sourceUrl: string;
}

/**
 * schedule.label から開催日を抽出する。
 * ラベル形式: "01月23日　本会議" → "01", "23"
 * council.year の年部分と組み合わせて "YYYY-MM-DD" を返す。
 */
function extractDateFromSchedule(scheduleLabel: string, councilYear: string): string | null {
  const dateMatch = scheduleLabel.match(/^(\d{2})月(\d{2})日/);
  if (!dateMatch) return null;
  const yearPart = councilYear.substring(0, 4);
  if (!/^\d{4}$/.test(yearPart)) return null;
  return `${yearPart}-${dateMatch[1]}-${dateMatch[2]}`;
}

/**
 * DiscussVision API レスポンスから会議レコードの配列を生成する。
 * schedule ごとに 1 レコードを生成する。
 */
export function parseCouncilList(data: unknown): TozawaRecord[] {
  if (!Array.isArray(data)) return [];

  const results: TozawaRecord[] = [];

  for (const council of data as DvsCouncil[]) {
    if (!council.council_id || !council.label) continue;

    const meetingType = detectMeetingType(council.label);
    const sourceUrl = `${BASE_ORIGIN}/smart/tenant/tozawa/WebView/rd/council_1.html`;

    if (!Array.isArray(council.schedules) || council.schedules.length === 0) {
      // schedule がない場合は council 単位でレコードを作成
      const heldOn =
        council.year && /^\d{4}-\d{2}-\d{2}$/.test(council.year)
          ? council.year
          : null;
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

      // schedule.label から開催日を抽出し、council.year の年と組み合わせる
      const heldOn = council.year
        ? extractDateFromSchedule(schedule.label ?? "", council.year)
        : null;

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
export async function fetchDocumentList(year: number): Promise<TozawaRecord[]> {
  const url = `${BASE_ORIGIN}/dvsapi/councilrd/all?tenant_id=${TENANT_ID}&year=${year}`;
  const data = await fetchJson(url);
  if (!data) {
    console.warn(`[063673-tozawa] No data returned for year=${year}`);
    return [];
  }
  return parseCouncilList(data);
}
