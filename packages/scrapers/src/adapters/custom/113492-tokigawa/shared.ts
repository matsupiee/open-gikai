/**
 * ときがわ町議会 — 共通ユーティリティ
 *
 * サイト: https://www.town.tokigawa.lg.jp/div/203010/htm/gijiroku/index.html
 * 独自静的 HTML 公開。文字コード: Shift_JIS（CP932）。
 * 会議録形式: HTML テキスト形式（PDF なし）。
 */

export const BASE_URL =
  "https://www.town.tokigawa.lg.jp/div/203010/htm/gijiroku/";

const USER_AGENT =
  "open-gikai-bot/1.0 (https://github.com/matsupiee/open-gikai; contact: please see github)";

const FETCH_TIMEOUT_MS = 30_000;

/** fetch して Shift_JIS -> UTF-8 テキストを返す */
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
    const buf = await res.arrayBuffer();
    const decoder = new TextDecoder("shift_jis");
    return decoder.decode(buf);
  } catch (e) {
    console.warn(
      `fetchPage error: ${url}`,
      e instanceof Error ? e.message : e,
    );
    return null;
  }
}

/** 会議タイプを検出 */
export function detectMeetingType(
  title: string,
): "plenary" | "committee" | "extraordinary" {
  if (title.includes("委員会")) return "committee";
  if (title.includes("臨時")) return "extraordinary";
  return "plenary";
}

/**
 * 現在の令和年（スクレイパーが対応する最新年度の令和年号）。
 * 令和7年 = 2025年。index.html がこの年度のインデックスページとなる。
 */
export const CURRENT_REIWA_YEAR = 7;

/**
 * インデックスページのファイル名一覧を生成する。
 *
 * 平成18年（h18.html）〜平成31年（h31.html）
 * 令和2年（r02.html）〜令和6年（r06.html）
 * 令和7年（最新年）は r07.html ではなく index.html を使用する。
 */
export function buildIndexFileNames(): string[] {
  const names: string[] = [];

  // 平成18〜31年 (h18.html〜h31.html)
  for (let i = 18; i <= 31; i++) {
    names.push(`h${String(i).padStart(2, "0")}.html`);
  }

  // 令和2年〜令和6年 (r02.html〜r06.html)
  for (let i = 2; i < CURRENT_REIWA_YEAR; i++) {
    names.push(`r${String(i).padStart(2, "0")}.html`);
  }

  // 令和7年（最新年）は index.html
  names.push("index.html");

  return names;
}

/**
 * インデックスファイル名から西暦年を返す。
 *
 * h18.html -> 2006 (平成18年)
 * h31.html -> 2019 (平成31年)
 * r02.html -> 2020 (令和2年)
 * index.html -> 2025 (令和7年、最新年)
 */
export function indexFileNameToYear(fileName: string): number | null {
  // 最新年は index.html
  if (fileName === "index.html") {
    return CURRENT_REIWA_YEAR + 2018;
  }

  const heiseiMatch = fileName.match(/^h(\d{2})\.html$/i);
  if (heiseiMatch) {
    const eraYear = parseInt(heiseiMatch[1]!, 10);
    return eraYear + 1988;
  }

  const reiwaMatch = fileName.match(/^r(\d{2})\.html$/i);
  if (reiwaMatch) {
    const eraYear = parseInt(reiwaMatch[1]!, 10);
    return eraYear + 2018;
  }

  return null;
}
