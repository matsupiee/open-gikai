/**
 * 有田川町議会 会議録 -- 共通ユーティリティ
 *
 * サイト: https://www.town.aridagawa.lg.jp/top/kakuka/gikai/index.html
 * 自治体コード: 303666
 *
 * 有田川町は PDF ベースで議事録を公開している。
 * 会議録一覧トップ（kaigiroku/index.html）から年度別ページへのリンクを取得し、
 * 各年度ページから PDF リンクを直接収集する。
 */

export const BASE_ORIGIN = "https://www.town.aridagawa.lg.jp";
export const INDEX_PATH = "/top/kakuka/gikai/kaigiroku/index.html";

const USER_AGENT =
  "open-gikai-bot/1.0 (https://github.com/matsupiee/open-gikai; contact: please see github)";

const FETCH_TIMEOUT_MS = 30_000;

/** 会議タイプを検出 */
export function detectMeetingType(title: string): string {
  if (title.includes("委員会")) return "committee";
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
 * 西暦年を和暦（令和/平成）に変換する。
 * e.g., 2025 → { era: "令和", eraYear: 7 }
 */
export function toWareki(year: number): { era: string; eraYear: number } | null {
  if (year >= 2019) {
    return { era: "令和", eraYear: year - 2018 };
  }
  if (year >= 1989) {
    return { era: "平成", eraYear: year - 1988 };
  }
  return null;
}

/**
 * PDF ファイル名からメタ情報を抽出する。
 *
 * 形式: R{年度}-{回数}-{日数}{会議種別}R{年月日}.pdf
 * 例: R7-2-1teireiR070603.pdf, R07-3-1rinjiR070624.pdf
 */
export function parsePdfFilename(filename: string): {
  eraYear: number;
  session: number;
  dayNumber: number;
  meetingKind: "teirei" | "rinji";
  heldOn: string;
} | null {
  const match = filename.match(
    /^R0?(\d+)-(\d+)-(\d+)(teirei|rinji)R(\d{2})(\d{2})(\d{2})\.pdf$/i
  );
  if (!match) return null;

  const eraYear = parseInt(match[1]!, 10);
  const session = parseInt(match[2]!, 10);
  const dayNumber = parseInt(match[3]!, 10);
  const meetingKind = match[4]!.toLowerCase() as "teirei" | "rinji";
  const yearPart = parseInt(match[5]!, 10);
  const month = parseInt(match[6]!, 10);
  const day = parseInt(match[7]!, 10);

  // 和暦年から西暦年を算出
  const westernYear = yearPart <= 30 ? yearPart + 2018 : yearPart + 1988;

  const heldOn = `${westernYear}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;

  return { eraYear, session, dayNumber, meetingKind, heldOn };
}
