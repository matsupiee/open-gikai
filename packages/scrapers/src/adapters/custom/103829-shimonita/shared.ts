/**
 * 下仁田町議会（群馬県） — 共通ユーティリティ
 *
 * サイト: https://www.town.shimonita.lg.jp/m08/m02/index.html
 * 自治体コード: 103829
 */

export const BASE_ORIGIN = "https://www.town.shimonita.lg.jp";

/** 会議録一覧ページ（年別リンク集）URL */
export const TOP_URL = `${BASE_ORIGIN}/m08/m02/index.html`;

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
    console.warn(`[103829-shimonita] fetchPage failed: ${url}`, e);
    return null;
  }
}

/** fetch してバイナリ（ArrayBuffer）を返す */
export async function fetchBinary(url: string): Promise<ArrayBuffer | null> {
  try {
    const res = await fetch(url, {
      headers: { "User-Agent": USER_AGENT },
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    });
    if (!res.ok) return null;
    return await res.arrayBuffer();
  } catch (e) {
    console.warn(`[103829-shimonita] fetchBinary failed: ${url}`, e);
    return null;
  }
}

/** 会議タイプを検出 */
export function detectMeetingType(
  title: string
): "plenary" | "extraordinary" | "committee" {
  if (title.includes("臨時会")) return "extraordinary";
  return "plenary";
}

/**
 * 和暦の年表記から西暦を返す。
 * 例: "令和6年" → 2024, "令和元年" → 2019, "平成30年" → 2018
 */
export function parseWarekiYear(text: string): number | null {
  const reiwa = text.match(/令和(元|\d+)年/);
  if (reiwa?.[1]) {
    const n = reiwa[1] === "元" ? 1 : parseInt(reiwa[1], 10);
    return 2018 + n;
  }

  const heisei = text.match(/平成(元|\d+)年/);
  if (heisei?.[1]) {
    const n = heisei[1] === "元" ? 1 : parseInt(heisei[1], 10);
    return 1988 + n;
  }

  return null;
}

/**
 * PDF URL のファイル名から開催日 YYYY-MM-DD を取得する。
 * 新形式: 20241209_teirei.pdf → 2024-12-09
 * 古い形式: 20141205teirei.pdf → 2014-12-05
 * 解析できない場合は null を返す。
 */
export function parseDateFromPdfUrl(pdfUrl: string): string | null {
  const filename = pdfUrl.split("/").pop() ?? "";

  // YYYYMMDD で始まるパターン（新旧両形式）
  const m = filename.match(/^(\d{4})(\d{2})(\d{2})[_a-z]/i);
  if (m) {
    const year = parseInt(m[1]!, 10);
    const month = parseInt(m[2]!, 10);
    const day = parseInt(m[3]!, 10);
    if (
      year >= 2000 &&
      month >= 1 &&
      month <= 12 &&
      day >= 1 &&
      day <= 31
    ) {
      return `${m[1]}-${m[2]}-${m[3]}`;
    }
  }

  return null;
}

/** リクエスト間の待機 */
export function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
