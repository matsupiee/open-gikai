/**
 * 下呂市議会 — 共通ユーティリティ
 *
 * サイト: https://www.city.gero.lg.jp/site/gikai/list69.html
 * PDF ベースの議事録公開。年度別ページに会議リンクを掲載し、
 * 各会議ページから PDF をダウンロードする。
 */

export const BASE_ORIGIN = "https://www.city.gero.lg.jp";

const FETCH_TIMEOUT_MS = 30_000;
const PDF_FETCH_TIMEOUT_MS = 60_000;

/**
 * 会議タイプを検出する。
 * タイトルとセクション名を総合的に判断して meetingType を返す。
 * section が "定例会・臨時会" のような複合ラベルの場合は title で判定する。
 */
export function detectMeetingType(title: string, section: string): string {
  if (section.includes("委員会") || title.includes("委員会"))
    return "committee";
  if (title.includes("臨時")) return "extraordinary";
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
      e instanceof Error ? e.message : e,
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
      e instanceof Error ? e.message : e,
    );
    return null;
  }
}

/**
 * 西暦年から和暦テキスト候補を返す。
 * 2019 年は「令和元年」と「平成31年」の両方を返す。
 */
export function toJapaneseEra(year: number): string[] {
  const results: string[] = [];

  if (year >= 2020) {
    results.push(`令和${year - 2018}年`);
  } else if (year === 2019) {
    results.push("令和元年");
    results.push("平成31年");
  } else if (year >= 1989) {
    const eraYear = year - 1988;
    results.push(eraYear === 1 ? "平成元年" : `平成${eraYear}年`);
  }

  return results;
}
