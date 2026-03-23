/**
 * 芦北町議会 — 共通ユーティリティ
 *
 * サイト: https://www.town.ashikita.lg.jp/
 * 自治体コード: 434825
 */

export const BASE_ORIGIN = "https://www.town.ashikita.lg.jp";

const USER_AGENT =
  "open-gikai-bot/1.0 (https://github.com/matsupiee/open-gikai; contact: please see github)";

const FETCH_TIMEOUT_MS = 30_000;

/** 会議タイプを検出 */
export function detectMeetingType(title: string): string {
  if (title.includes("臨時会")) return "extraordinary";
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
 * 西暦年度から URL 用の年号スラッグを生成する。
 * 例: 2025 → "r7", 2019 → "r1", 2018 → "h30", 2010 → "h22"
 */
export function toWarekiSlug(nendo: number): string {
  if (nendo >= 2019) {
    return `r${nendo - 2018}`;
  }
  return `h${nendo - 1988}`;
}

/**
 * 年号スラッグから西暦年度を返す。
 * 例: "r7" → 2025, "r1" → 2019, "h30" → 2018, "h22" → 2010
 */
export function fromWarekiSlug(slug: string): number | null {
  const reiwa = slug.match(/^r(\d+)$/);
  if (reiwa?.[1]) return 2018 + parseInt(reiwa[1], 10);

  const heisei = slug.match(/^h(\d+)$/);
  if (heisei?.[1]) return 1988 + parseInt(heisei[1], 10);

  return null;
}

/**
 * 和暦テキストから西暦年を抽出する。
 * 例: "令和6年第2回定例会" → 2024, "平成22年第1回定例会" → 2010
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

/** リクエスト間の待機 */
export function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
