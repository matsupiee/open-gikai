/**
 * 玉村町議会（群馬県） — 共通ユーティリティ
 *
 * サイト: https://www.town.tamamura.lg.jp/docs/2019052900044/
 * 自治体コード: 104647
 */

export const BASE_ORIGIN = "https://www.town.tamamura.lg.jp";

/** 会議録トップページのパス */
export const TOP_PAGE_PATH = "/docs/2019052900044/";

/**
 * 年度別ページのドキュメント ID マッピング。
 * トップページから動的に取得することもできるが、
 * 固定リストとしてハードコードしておく。
 */
export const YEAR_DOC_IDS: Record<number, string> = {
  2025: "2025052200015",
  2024: "2024060500025",
  2023: "2023061600017",
  2022: "2022052700088",
  2021: "2021061500016",
  2020: "2020052600032",
  2019: "2019112600068",
  2018: "2019022500038",
  2017: "2018030200091",
  2016: "2017030100059",
  2015: "2016022600058",
  2014: "2015041600032",
  2013: "2015111900055",
  2012: "2014091807187",
  2011: "2014091807170",
  2010: "2014091807163",
  2009: "2014091807156",
};

const USER_AGENT =
  "open-gikai-bot/1.0 (https://github.com/matsupiee/open-gikai; contact: please see github)";

const FETCH_TIMEOUT_MS = 30_000;
const PDF_FETCH_TIMEOUT_MS = 60_000;

/** fetch して UTF-8 テキストを返す */
export async function fetchPage(url: string): Promise<string | null> {
  try {
    const res = await fetch(url, {
      headers: { "User-Agent": USER_AGENT },
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    });
    if (!res.ok) {
      console.warn(
        `[104647-tamamura] fetchPage failed: ${url} status=${res.status}`,
      );
      return null;
    }
    return await res.text();
  } catch (e) {
    console.warn(
      `[104647-tamamura] fetchPage error: ${url}`,
      e instanceof Error ? e.message : e,
    );
    return null;
  }
}

/** fetch してバイナリ（ArrayBuffer）を返す（PDF ダウンロード用） */
export async function fetchBinary(url: string): Promise<ArrayBuffer | null> {
  try {
    const res = await fetch(url, {
      headers: { "User-Agent": USER_AGENT },
      signal: AbortSignal.timeout(PDF_FETCH_TIMEOUT_MS),
    });
    if (!res.ok) {
      console.warn(
        `[104647-tamamura] fetchBinary failed: ${url} status=${res.status}`,
      );
      return null;
    }
    return await res.arrayBuffer();
  } catch (e) {
    console.warn(
      `[104647-tamamura] fetchBinary error: ${url}`,
      e instanceof Error ? e.message : e,
    );
    return null;
  }
}

/** 会議タイプを検出 */
export function detectMeetingType(
  title: string,
): "plenary" | "extraordinary" | "committee" {
  if (title.includes("臨時会")) return "extraordinary";
  return "plenary";
}

/**
 * 和暦テキストから西暦年を取得する。
 * 「元」年に対応。
 */
export function eraToWestern(era: string, eraYearStr: string): number {
  const eraYear = eraYearStr === "元" ? 1 : parseInt(eraYearStr, 10);
  if (era === "令和") return eraYear + 2018;
  if (era === "平成") return eraYear + 1988;
  if (era === "昭和") return eraYear + 1925;
  return eraYear;
}

/**
 * 全角数字・全角スペースを半角に変換する。
 */
export function normalizeFullWidth(text: string): string {
  return text
    .replace(/[０-９]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0xfee0))
    .replace(/　/g, " ");
}

/**
 * PDF テキスト抽出で発生する文字間スペースを除去する。
 *
 * unpdf で抽出されたテキストは日本語文字間に半角スペースが入ることがある。
 * CJK 文字間の単一スペースを繰り返し除去する。
 */
export function deSpacePdfText(text: string): string {
  const cjkPattern =
    /([\u3041-\u3096\u30A1-\u30FA\u4E00-\u9FFF\uFF01-\uFF60\u3001-\u303F]) ([\u3041-\u3096\u30A1-\u30FA\u4E00-\u9FFF\uFF01-\uFF60\u3001-\u303F])/g;

  let prev = "";
  let result = text;
  while (result !== prev) {
    prev = result;
    result = result.replace(cjkPattern, "$1$2");
  }
  return result;
}

/** リクエスト間の待機 */
export function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
