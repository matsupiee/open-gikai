/**
 * 上小阿仁村議会 — 共通ユーティリティ
 *
 * サイト: https://www.vill.kamikoani.akita.jp/menu/6
 * PDF ベースの議事録公開。4 つの一覧ページから PDF リンクを収集する。
 */

export const BASE_ORIGIN = "https://www.vill.kamikoani.akita.jp";

/** 会議録一覧ページの URL 一覧（新しい順） */
export const LIST_PAGE_URLS = [
  `${BASE_ORIGIN}/info/663`, // 令和6年〜
  `${BASE_ORIGIN}/info/302`, // 平成31年〜令和4年
  `${BASE_ORIGIN}/info/288`, // 平成26年〜平成30年
  `${BASE_ORIGIN}/info/301`, // 平成21年〜平成25年
] as const;

const USER_AGENT =
  "open-gikai-bot/1.0 (https://github.com/matsupiee/open-gikai; contact: please see github)";

const FETCH_TIMEOUT_MS = 30_000;

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
      `[053279-kamikoani] fetchPage 失敗: ${url}`,
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
      `[053279-kamikoani] fetchBinary 失敗: ${url}`,
      err instanceof Error ? err.message : err
    );
    return null;
  }
}

/**
 * 和暦年月日文字列から西暦の YYYY-MM-DD を生成する。
 * 複数日の場合（令和７年１２月９日～１１日）は最初の日付を使用する。
 *
 * 全角数字を半角に変換してからパースする。
 */
export function parseHeldOn(dateText: string): string | null {
  // 全角数字を半角に変換
  const normalized = dateText.replace(/[０-９]/g, (c) =>
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
 * 指定年度（西暦）に対応する和暦年の候補リストを返す。
 * 会議録は年度（4月〜3月）ではなく年（1月〜12月）で管理されているため
 * 西暦年のみを対象とする。
 */
export function getEraYears(year: number): string[] {
  const candidates: string[] = [];

  // 令和
  if (year >= 2019) {
    const reiwaYear = year - 2018;
    candidates.push(`令和${reiwaYear === 1 ? "元" : String(reiwaYear)}年`);
    candidates.push(`令和${String(reiwaYear)}年`);
  }
  // 平成
  if (year >= 1989 && year <= 2019) {
    const heiseiYear = year - 1988;
    candidates.push(`平成${heiseiYear === 1 ? "元" : String(heiseiYear)}年`);
    candidates.push(`平成${String(heiseiYear)}年`);
  }

  return candidates;
}
