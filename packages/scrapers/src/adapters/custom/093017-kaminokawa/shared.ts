/**
 * 上三川町議会 — 共通ユーティリティ
 *
 * サイト: https://www.town.kaminokawa.lg.jp/0192/genre2-0-001.html
 * PDF ベースの議事録公開。CMS による年度別・会議別 PDF 公開形式。
 * PDF ファイル名はランダムハッシュ値のため、テーブルの行情報と紐づけて管理する。
 */

export const BASE_ORIGIN = "https://www.town.kaminokawa.lg.jp";

/** 会議録トップページの URL */
export const TOP_PAGE_URL = `${BASE_ORIGIN}/0192/genre2-0-001.html`;

const USER_AGENT =
  "open-gikai-bot/1.0 (https://github.com/matsupiee/open-gikai; contact: please see github)";

const FETCH_TIMEOUT_MS = 30_000;

/**
 * 年度（西暦）から年度別ジャンル ID への対応表。
 * トップページから動的に取得するが、フォールバック用に固定値も保持する。
 */
export const YEAR_TO_GENRE_ID: Record<number, string> = {
  2024: "0361",
  2023: "0341",
  2022: "0328",
  2021: "0313",
  2020: "0295",
  2019: "0262",
  2018: "0240",
  2017: "0239",
  2016: "0238",
};

/** 会議タイプを検出 */
export function detectMeetingType(title: string): string {
  if (title.includes("臨時")) return "extraordinary";
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
  } catch (err) {
    console.warn(
      `[093017-kaminokawa] fetchPage 失敗: ${url}`,
      err instanceof Error ? err.message : err
    );
    return null;
  }
}

/** fetch して ArrayBuffer を返す（PDF ダウンロード用） */
export async function fetchBinary(url: string): Promise<ArrayBuffer | null> {
  try {
    const res = await fetch(url, {
      headers: { "User-Agent": USER_AGENT },
      signal: AbortSignal.timeout(60_000),
    });
    if (!res.ok) return null;
    return await res.arrayBuffer();
  } catch (err) {
    console.warn(
      `[093017-kaminokawa] fetchBinary 失敗: ${url}`,
      err instanceof Error ? err.message : err
    );
    return null;
  }
}

/**
 * 和暦の年月日を YYYY-MM-DD に変換する。
 * e.g., "令和6年12月3日" → "2024-12-03"
 *       "令和元年5月1日" → "2019-05-01"
 *       "平成31年4月1日" → "2019-04-01"
 */
export function parseJapaneseDate(text: string): string | null {
  // 全角数字を半角に変換
  const normalized = text.replace(/[０-９]/g, (c) =>
    String.fromCharCode(c.charCodeAt(0) - 0xfee0)
  );

  const match = normalized.match(/(令和|平成)(元|\d+)年(\d+)月(\d+)日/);
  if (!match) return null;

  const [, era, eraYearStr, monthStr, dayStr] = match;
  const eraYear = eraYearStr === "元" ? 1 : parseInt(eraYearStr!, 10);
  const month = parseInt(monthStr!, 10);
  const day = parseInt(dayStr!, 10);

  let westernYear: number;
  if (era === "令和") westernYear = eraYear + 2018;
  else if (era === "平成") westernYear = eraYear + 1988;
  else return null;

  return `${westernYear}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

/**
 * 月日のみのテキストと西暦年を組み合わせて YYYY-MM-DD に変換する。
 * e.g., "12月3日(pdf 448 KB)" + 2024 → "2024-12-03"
 *       "1月22日" + 2024 → "2024-01-22"
 */
export function parseMonthDay(text: string, year: number): string | null {
  // 全角数字を半角に変換
  const normalized = text.replace(/[０-９]/g, (c) =>
    String.fromCharCode(c.charCodeAt(0) - 0xfee0)
  );

  const match = normalized.match(/(\d+)月(\d+)日/);
  if (!match) return null;

  const month = parseInt(match[1]!, 10);
  const day = parseInt(match[2]!, 10);

  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

/**
 * 和暦の年から西暦を取得する。
 * e.g., "令和6(2024)" or "令和6年" → 2024
 */
export function parseWesternYear(text: string): number | null {
  // "令和6(2024)" 形式
  const withWestern = text.match(/令和\d+\((\d{4})\)/);
  if (withWestern) return parseInt(withWestern[1]!, 10);

  // 全角数字を半角に変換
  const normalized = text.replace(/[０-９]/g, (c) =>
    String.fromCharCode(c.charCodeAt(0) - 0xfee0)
  );

  const match = normalized.match(/(令和|平成)(元|\d+)/);
  if (!match) return null;

  const [, era, eraYearStr] = match;
  const eraYear = eraYearStr === "元" ? 1 : parseInt(eraYearStr!, 10);

  if (era === "令和") return eraYear + 2018;
  if (era === "平成") return eraYear + 1988;
  return null;
}
