/**
 * 藤里町議会 -- 共通ユーティリティ
 *
 * サイト: https://www.town.fujisato.akita.jp/town/c613/
 * 自治体 CMS + PDF 公開。会議録本文ではなく議案・会議結果 PDF を掲載している。
 */

export const BASE_ORIGIN = "https://www.town.fujisato.akita.jp";
export const ARCHIVE_PAGE_URL = `${BASE_ORIGIN}/town/c613/teireirinji/2267`;

const USER_AGENT =
  "open-gikai-bot/1.0 (https://github.com/matsupiee/open-gikai; contact: please see github)";

const FETCH_TIMEOUT_MS = 30_000;
const PDF_FETCH_TIMEOUT_MS = 60_000;

/** 会議タイプを検出 */
export function detectMeetingType(title: string): string {
  if (title.includes("臨時会")) return "extraordinary";
  if (title.includes("委員会")) return "committee";
  return "plenary";
}

/** 全角数字を半角数字に変換する */
export function toHalfWidth(text: string): string {
  return text.replace(/[０-９]/g, (char) =>
    String.fromCharCode(char.charCodeAt(0) - 0xfee0),
  );
}

/** 和暦文字列から西暦年を抽出する */
export function parseWarekiYear(text: string): number | null {
  const normalized = toHalfWidth(text);
  const match = normalized.match(/(令和|平成)(元|\d+)年/);
  if (!match) return null;

  const eraYear = match[2] === "元" ? 1 : Number(match[2]);
  if (match[1] === "令和") return eraYear + 2018;
  if (match[1] === "平成") return eraYear + 1988;
  return null;
}

/** UTF-8 テキストを取得する */
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

/** PDF ダウンロード用にバイナリを取得する */
export async function fetchBinary(url: string): Promise<ArrayBuffer | null> {
  try {
    const res = await fetch(url, {
      headers: { "User-Agent": USER_AGENT },
      signal: AbortSignal.timeout(PDF_FETCH_TIMEOUT_MS),
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

/** PDF パスから externalId 用のキーを作る */
export function extractExternalId(pdfPath: string): string | null {
  const decoded = decodeURIComponent(pdfPath);
  const fileName = decoded.split("/").pop()?.replace(/\.pdf$/i, "");
  return fileName ? `fujisato_${fileName}` : null;
}
