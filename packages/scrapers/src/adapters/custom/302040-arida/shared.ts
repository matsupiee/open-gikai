/**
 * 有田市議会 — 共通ユーティリティ
 *
 * サイト: https://www.city.arida.lg.jp/shigikai/honkaigiroku/index.html
 * 自治体コード: 302040
 */

export const BASE_ORIGIN = "https://www.city.arida.lg.jp";

const USER_AGENT =
  "open-gikai-bot/1.0 (https://github.com/matsupiee/open-gikai; contact: please see github)";

const FETCH_TIMEOUT_MS = 30_000;

/** 会議タイプを検出（有田市は本会議のみ公開） */
export function detectMeetingType(title: string): string {
  if (title.includes("委員会")) return "committee";
  if (title.includes("臨時会") || title.includes("臨時")) return "extraordinary";
  return "plenary";
}

/** fetch して UTF-8 テキストを返す */
export async function fetchPage(url: string): Promise<string | null> {
  try {
    const res = await fetch(url, {
      headers: { "User-Agent": USER_AGENT },
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    });
    if (!res.ok) return null;
    return await res.text();
  } catch {
    return null;
  }
}

/**
 * 和暦の年表記から西暦を返す。
 * 例: "令和7年12月定例会" → 2025
 */
export function parseWarekiYear(text: string): number | null {
  const reiwa = text.match(/令和(\d+|元)年/);
  if (reiwa?.[1]) {
    const n = reiwa[1] === "元" ? 1 : parseInt(reiwa[1], 10);
    return 2018 + n;
  }

  const heisei = text.match(/平成(\d+|元)年/);
  if (heisei?.[1]) {
    const n = heisei[1] === "元" ? 1 : parseInt(heisei[1], 10);
    return 1988 + n;
  }

  return null;
}

/**
 * 西暦から和暦（令和）に変換する。
 * 例: 2025 → "令和7"
 */
export function toWareki(year: number): string | null {
  if (year >= 2019) {
    const n = year - 2018;
    return `令和${n}`;
  }
  return null;
}

/** トップページの URL */
export function buildTopUrl(): string {
  return `${BASE_ORIGIN}/shigikai/honkaigiroku/index.html`;
}

/** 年度別一覧ページの URL */
export function buildYearPageUrl(nendoId: string): string {
  return `${BASE_ORIGIN}/shigikai/honkaigiroku/${nendoId}/index.html`;
}

/** 会議詳細ページの URL */
export function buildMeetingPageUrl(nendoId: string, meetingId: string): string {
  return `${BASE_ORIGIN}/shigikai/honkaigiroku/${nendoId}/${meetingId}.html`;
}

/** リクエスト間の待機 */
export function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
