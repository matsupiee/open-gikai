/**
 * 美瑛町議会 — 共通ユーティリティ
 *
 * サイト: https://town.biei.hokkaido.jp/administration/parliament/proceedings/
 * PDF ベースの議事録公開。年度別ページに PDF リンクを掲載。
 */

export const BASE_ORIGIN = "https://town.biei.hokkaido.jp";

const USER_AGENT =
  "open-gikai-bot/1.0 (https://github.com/matsupiee/open-gikai; contact: please see github)";

const FETCH_TIMEOUT_MS = 30_000;

/** 会議タイプを検出 */
export function detectMeetingType(section: string): string {
  if (section.includes("臨時")) return "extraordinary";
  if (section.includes("委員会")) return "committee";
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
      `[014591-biei] fetchPage 失敗: ${url}`,
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
      `[014591-biei] fetchBinary 失敗: ${url}`,
      err instanceof Error ? err.message : err
    );
    return null;
  }
}

/**
 * 西暦年を和暦テキスト候補の配列に変換する。
 * e.g., 2025 → ["令和７年"], 2019 → ["令和元年", "平成31年"]
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

/**
 * 全角数字を半角に変換する。
 */
export function normalizeDigits(text: string): string {
  return text.replace(/[０-９]/g, (ch) =>
    String.fromCharCode(ch.charCodeAt(0) - 0xfee0)
  );
}

/**
 * PDF URL パスから externalId 用のキーを抽出する。
 * e.g., "/files/00006100/00006131/20260225162616.pdf" → "00006131_20260225162616"
 */
export function extractExternalIdKey(pdfPath: string): string | null {
  const match = pdfPath.match(/\/(\d+)\/([^/]+)\.pdf$/i);
  if (!match) return null;
  return `${match[1]}_${match[2]}`;
}
