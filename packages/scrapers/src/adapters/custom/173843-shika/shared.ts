/**
 * 志賀町議会 — 共通ユーティリティ
 *
 * サイト: https://www.town.shika.lg.jp/site/gikai/list23-19.html
 * 独自 CMS による HTML 公開 + PDF 直リンク。
 * 年度別ページに PDF が直リンクされている。
 */

export const BASE_ORIGIN = "https://www.town.shika.lg.jp";

const FETCH_TIMEOUT_MS = 30_000;
const PDF_FETCH_TIMEOUT_MS = 60_000;

/** 会議タイプを検出 */
export function detectMeetingType(session: string): string {
  if (session.includes("臨時")) return "extraordinary";
  return "plenary";
}

/** fetch して UTF-8 テキストを返す */
export async function fetchPage(url: string): Promise<string | null> {
  try {
    const res = await fetch(url, {
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    });
    if (!res.ok) {
      console.warn(`fetchPage failed: ${url} status=${res.status}`);
      return null;
    }
    return await res.text();
  } catch (e) {
    console.warn(
      `fetchPage error: ${url}`,
      e instanceof Error ? e.message : e
    );
    return null;
  }
}

/** fetch して ArrayBuffer を返す（PDF ダウンロード用） */
export async function fetchBinary(url: string): Promise<ArrayBuffer | null> {
  try {
    const res = await fetch(url, {
      signal: AbortSignal.timeout(PDF_FETCH_TIMEOUT_MS),
    });
    if (!res.ok) {
      console.warn(`fetchBinary failed: ${url} status=${res.status}`);
      return null;
    }
    return await res.arrayBuffer();
  } catch (e) {
    console.warn(
      `fetchBinary error: ${url}`,
      e instanceof Error ? e.message : e
    );
    return null;
  }
}

/**
 * 和暦テキストを西暦年に変換する。
 * 「令和X年」「平成X年」「令和元年」「平成元年」に対応。
 */
export function eraToYear(eraText: string): number | null {
  const match = eraText.match(/(令和|平成)(元|\d+)年/);
  if (!match) return null;
  const era = match[1]!;
  const eraYear = match[2] === "元" ? 1 : parseInt(match[2]!, 10);
  if (era === "令和") return 2018 + eraYear;
  if (era === "平成") return 1988 + eraYear;
  return null;
}
