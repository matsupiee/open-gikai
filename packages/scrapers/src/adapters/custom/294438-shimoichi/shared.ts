/**
 * 下市町議会 -- 共通ユーティリティ
 *
 * サイト: https://www.town.shimoichi.lg.jp/
 * 独自 CMS による HTML 公開。会議録全文は非公開。
 * 年別カテゴリページから各会議概要ページへのリンクを収集する。
 */

export const BASE_ORIGIN = "https://www.town.shimoichi.lg.jp";

const USER_AGENT =
  "open-gikai-bot/1.0 (https://github.com/matsupiee/open-gikai; contact: please see github)";

const FETCH_TIMEOUT_MS = 30_000;

/**
 * 年コード対応表。
 * 平成28年（2016年）と平成27年（2015年）のコードが逆転していることに注意。
 */
export const YEAR_CODE_MAP: Record<number, number> = {
  2015: 2, // 平成27年
  2016: 1, // 平成28年
  2017: 3,
  2018: 4,
  2019: 5, // 令和元年
  2020: 6,
  2021: 7,
  2022: 8,
  2023: 9,
  2024: 10,
  2025: 11,
  2026: 12,
};

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

/**
 * 和暦テキストから西暦年を返す。
 * 「元」にも対応: "令和元年" → 2019, "平成元年" → 1989
 */
export function eraToWesternYear(eraText: string): number | null {
  const match = eraText.match(/(令和|平成)(元|\d+)年/);
  if (!match) return null;

  const era = match[1]!;
  const eraYear = match[2] === "元" ? 1 : Number(match[2]);

  if (era === "令和") return eraYear + 2018;
  if (era === "平成") return eraYear + 1988;
  return null;
}

/**
 * 会議種別を検出する。
 * 定例会 → plenary, 臨時会 → extraordinary
 */
export function detectMeetingType(title: string): string {
  if (title.includes("臨時")) return "extraordinary";
  return "plenary";
}

/** 適切な待機時間を設ける（レート制限） */
export function delay(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}
