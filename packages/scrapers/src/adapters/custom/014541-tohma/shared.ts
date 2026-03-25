/**
 * 当麻町議会 会議録 — 共通ユーティリティ
 *
 * サイト: https://www.town.tohma.hokkaido.jp/parliament
 */

export const BASE_URL = "https://www.town.tohma.hokkaido.jp";

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
    if (!res.ok) return null;
    return await res.text();
  } catch (e) {
    console.warn(`[tohma] fetchPage failed: ${url}`, e);
    return null;
  }
}

/** fetch してバイナリを返す */
export async function fetchBinary(url: string): Promise<ArrayBuffer | null> {
  try {
    const res = await fetch(url, {
      headers: { "User-Agent": USER_AGENT },
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    });
    if (!res.ok) return null;
    return await res.arrayBuffer();
  } catch (e) {
    console.warn(`[tohma] fetchBinary failed: ${url}`, e);
    return null;
  }
}

/**
 * 和暦年（例: 令和5 → 2023）を西暦に変換する
 * 令和（2019年〜）のみ対応（当麻町は令和5年以降のみ公開）
 */
export function warekiNenToSeireki(wareki: string, year: number): number {
  if (wareki === "令和") return 2018 + year;
  if (wareki === "平成") return 1988 + year;
  return year;
}

/**
 * リンクテキスト「令和X年第Y回定例会」から開催年月を推定し YYYY-MM-DD を返す。
 * 実際の召集日は PDF 本文から取るが、一覧フェーズでは年度情報のみ使用。
 * 解析できない場合は null を返す。
 */
export function parseMeetingTitle(title: string): {
  year: number;
  session: number;
} | null {
  // 全角数字を半角に変換
  const normalized = title
    .replace(/[０-９]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0xfee0))
    .replace(/[一二三四五六七八九十]/g, (c) => {
      const map: Record<string, string> = {
        一: "1",
        二: "2",
        三: "3",
        四: "4",
        五: "5",
        六: "6",
        七: "7",
        八: "8",
        九: "9",
        十: "10",
      };
      return map[c] ?? c;
    });

  const m = normalized.match(/(令和|平成)(\d+)年第(\d+)回定例会/);
  if (!m) return null;

  const wareki = m[1]!;
  const eraYear = parseInt(m[2]!, 10);
  const session = parseInt(m[3]!, 10);
  const year = warekiNenToSeireki(wareki, eraYear);

  return { year, session };
}

/**
 * PDF タイトル行「令和X年第Y回定例会（M月D日召集）」から開催日を抽出し YYYY-MM-DD を返す。
 * 解析できない場合は null を返す。
 */
export function parsePdfTitleDate(titleLine: string): string | null {
  // 全角数字を半角に変換
  const normalized = titleLine.replace(/[０-９]/g, (c) =>
    String.fromCharCode(c.charCodeAt(0) - 0xfee0),
  );

  const eraMatch = normalized.match(/(令和|平成)(\d+)年第\d+回定例会[（(](\d+)月(\d+)日召集[）)]/);
  if (!eraMatch) return null;

  const wareki = eraMatch[1]!;
  const eraYear = parseInt(eraMatch[2]!, 10);
  const month = parseInt(eraMatch[3]!, 10);
  const day = parseInt(eraMatch[4]!, 10);
  const year = warekiNenToSeireki(wareki, eraYear);

  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}
