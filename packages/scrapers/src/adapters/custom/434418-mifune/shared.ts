/**
 * 御船町議会（熊本県） — 共通ユーティリティ
 *
 * サイト: https://www.town.mifune.kumamoto.jp/gikai/
 * 自治体コード: 434418
 *
 * hpkiji CMS で PDF 形式の会議録を公開。
 * 一覧ページは autopager による動的読み込み（pg パラメータ）方式。
 */

export const BASE_ORIGIN = "https://www.town.mifune.kumamoto.jp";

/** 会議録一覧ページ URL */
export const LIST_URL =
  `${BASE_ORIGIN}/gikai/hpkiji/pub/List.aspx?c_id=3&class_set_id=6&class_id=6006`;

const USER_AGENT =
  "open-gikai-bot/1.0 (https://github.com/matsupiee/open-gikai; contact: please see github)";

const FETCH_TIMEOUT_MS = 30_000;
const PDF_FETCH_TIMEOUT_MS = 60_000;

/** fetch して UTF-8 テキストを返す */
export async function fetchPage(url: string): Promise<string | null> {
  try {
    const res = await fetch(url, {
      headers: { "User-Agent": USER_AGENT },
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    });
    if (!res.ok) {
      console.warn(`[434418-mifune] fetchPage failed: ${url} status=${res.status}`);
      return null;
    }
    return await res.text();
  } catch (e) {
    console.warn(
      `[434418-mifune] fetchPage error: ${url}`,
      e instanceof Error ? e.message : e
    );
    return null;
  }
}

/** fetch して ArrayBuffer を返す（PDF ダウンロード用） */
export async function fetchBinary(url: string): Promise<ArrayBuffer | null> {
  try {
    const res = await fetch(url, {
      headers: { "User-Agent": USER_AGENT },
      signal: AbortSignal.timeout(PDF_FETCH_TIMEOUT_MS),
    });
    if (!res.ok) {
      console.warn(`[434418-mifune] fetchBinary failed: ${url} status=${res.status}`);
      return null;
    }
    return await res.arrayBuffer();
  } catch (e) {
    console.warn(
      `[434418-mifune] fetchBinary error: ${url}`,
      e instanceof Error ? e.message : e
    );
    return null;
  }
}

/** リクエスト間の待機 */
export function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** 会議タイプを検出 */
export function detectMeetingType(title: string): string {
  if (title.includes("委員会")) return "committee";
  if (title.includes("臨時会")) return "extraordinary";
  return "plenary";
}

/**
 * 和暦テキストから西暦年を返す。
 * 例: "令和6年度" → 2024, "平成30年度" → 2018, "令和元年度" → 2019
 *
 * 年度単位（4月始まり）なので、年度 → 西暦は令和N年度 = N+2018 年
 */
export function parseWarekiNendo(text: string): number | null {
  const reiwa = text.match(/令和(元|\d+)年度/);
  if (reiwa?.[1]) {
    const n = reiwa[1] === "元" ? 1 : parseInt(reiwa[1], 10);
    return 2018 + n;
  }

  const heisei = text.match(/平成(元|\d+)年度/);
  if (heisei?.[1]) {
    const n = heisei[1] === "元" ? 1 : parseInt(heisei[1], 10);
    return 1988 + n;
  }

  return null;
}

/**
 * 会議タイトルから開催月を推定し、西暦年と組み合わせて開催日（YYYY-MM-DD）を返す。
 *
 * 御船町は会議名に「（XX月会議）」と月が記載される。
 * 年度開始月（4月）より前の月（1〜3月）は翌年に属する。
 *
 * 例:
 *   令和6年度 第1回（6月会議）→ nendo=2024 → 2024-06-01
 *   令和6年度 第5回（9月会議）→ nendo=2024 → 2024-09-01
 *   令和5年度 第7回（12月会議）→ nendo=2023 → 2023-12-01
 *   令和5年度 第1回（6月会議）→ nendo=2023 → 2023-06-01
 *   令和5年度 第3回（12月会議）→ nendo=2023 → 2023-12-01
 *   令和5年度 第X回（3月会議）→ nendo=2023 → 2024-03-01（年度の翌年）
 */
export function inferHeldOn(
  nendo: number,
  title: string
): string | null {
  const monthMatch = title.match(/（(\d+)月会議）/);
  if (!monthMatch?.[1]) return null;

  const month = parseInt(monthMatch[1], 10);
  if (month < 1 || month > 12) return null;

  // 年度は4月始まり。1〜3月は年度開始年の翌年
  const year = month <= 3 ? nendo + 1 : nendo;

  return `${year}-${String(month).padStart(2, "0")}-01`;
}
