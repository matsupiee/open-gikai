/**
 * 滑川町議会 会議録 — 共通ユーティリティ
 *
 * サイト: https://smart.discussvision.net/smart/tenant/namegawa/WebView/rd/council_1.html
 *
 * DiscussVision Smart システム（REST JSON API 経由でデータ取得）
 * テナント ID: 570
 */

export const TENANT_ID = "570";
export const API_BASE = "https://smart.discussvision.net/dvsapi";
export const SITE_BASE = "https://smart.discussvision.net/smart/tenant/namegawa";

const USER_AGENT =
  "open-gikai-bot/1.0 (https://github.com/matsupiee/open-gikai; contact: please see github)";

const FETCH_TIMEOUT_MS = 30_000;

/** fetch して UTF-8 テキストを返す */
export async function fetchPage(url: string): Promise<string | null> {
  try {
    const res = await fetch(url, {
      headers: { "User-Agent": USER_AGENT },
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    });
    if (!res.ok) {
      console.warn(`fetchPage failed: ${url} status=${res.status}`);
      return null;
    }
    return await res.text();
  } catch (e) {
    console.warn(`fetchPage error: ${url}`, e instanceof Error ? e.message : e);
    return null;
  }
}

/** fetch して ArrayBuffer を返す（PDF 用） */
export async function fetchBinary(url: string): Promise<ArrayBuffer | null> {
  try {
    const res = await fetch(url, {
      headers: { "User-Agent": USER_AGENT },
      signal: AbortSignal.timeout(60_000),
    });
    if (!res.ok) {
      console.warn(`fetchBinary failed: ${url} status=${res.status}`);
      return null;
    }
    return await res.arrayBuffer();
  } catch (e) {
    console.warn(`fetchBinary error: ${url}`, e instanceof Error ? e.message : e);
    return null;
  }
}

/**
 * 会議タイプを検出する
 * council.label または schedule.label から判別
 */
export function detectMeetingType(label: string): "plenary" | "committee" | "extraordinary" {
  if (label.includes("委員会")) return "committee";
  if (label.includes("臨時")) return "extraordinary";
  return "plenary";
}

/**
 * スケジュールラベルから開催日 (YYYY-MM-DD) を抽出する。
 * schedule.label 例: "03月05日　本会議"
 * council.year 例: "2024-03-13"（会議の年を提供する）
 */
export function extractDateFromScheduleLabel(
  scheduleLabel: string,
  councilYear: string
): string | null {
  const dateMatch = scheduleLabel.match(/^(\d{2})月(\d{2})日/);
  if (!dateMatch) return null;

  const year = councilYear.substring(0, 4);
  const month = dateMatch[1]!;
  const day = dateMatch[2]!;

  return `${year}-${month}-${day}`;
}

/**
 * 発言者名から "議員" などのサフィックスを除去して正規化する。
 * 例: "赤沼正副議員" → "赤沼正副"
 * 例: "阿部弘明議員" → "阿部弘明"
 */
export function normalizeSpeakerName(speaker: string): {
  speakerName: string;
  speakerRole: string | null;
} {
  const roleSuffixes = [
    "副委員長",
    "委員長",
    "副議長",
    "議長",
    "副町長",
    "町長",
    "副教育長",
    "教育長",
    "事務局長",
    "副部長",
    "部長",
    "副課長",
    "課長",
    "室長",
    "局長",
    "係長",
    "参事",
    "主幹",
    "代表監査委員",
    "監査委員",
    "会計管理者",
    "議員",
    "委員",
  ];

  for (const suffix of roleSuffixes) {
    if (speaker.endsWith(suffix)) {
      const name = speaker.slice(0, -suffix.length) || null;
      return { speakerName: name ?? speaker, speakerRole: suffix };
    }
  }

  return { speakerName: speaker, speakerRole: null };
}
