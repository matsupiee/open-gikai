/**
 * 多賀町議会 — 共通ユーティリティ
 *
 * サイト: https://www.town.taga.lg.jp/
 * 自治体コード: 254436
 *
 * 会議録は PDF 形式で年度別ページに直接公開。検索機能なし。
 * 年度一覧ページから年度別ページ URL を動的に取得し、
 * 各年度ページに掲載された会議録 PDF リンクを収集する。
 */

export const BASE_ORIGIN = "https://www.town.taga.lg.jp";
export const CATEGORY_LIST_URL = `${BASE_ORIGIN}/category_list.php?frmCd=4-5-0-0-0`;

const USER_AGENT =
  "open-gikai-bot/1.0 (https://github.com/matsupiee/open-gikai; contact: please see github)";

const FETCH_TIMEOUT_MS = 30_000;

/** 会議タイプを検出 */
export function detectMeetingType(title: string): string {
  if (title.includes("委員会")) return "committee";
  if (title.includes("臨時会") || title.includes("臨時")) return "extraordinary";
  return "plenary";
}

/**
 * タイトルから年を抽出して西暦に変換する。
 *
 * 対応パターン:
 *   令和X年
 *   令和元年
 *   平成XX年
 */
export function extractYearFromTitle(title: string): number | null {
  // 令和
  const reiwaMatch = title.match(/令和(元|\d+)年/);
  if (reiwaMatch) {
    const nengo = reiwaMatch[1] === "元" ? 1 : parseInt(reiwaMatch[1]!, 10);
    return 2018 + nengo;
  }

  // 平成
  const heiseiMatch = title.match(/平成(\d+)年/);
  if (heiseiMatch) {
    return 1988 + parseInt(heiseiMatch[1]!, 10);
  }

  return null;
}

/**
 * タイトルから月を抽出する。
 * 「3月定例会」「令和6年6月」のような形式に対応。
 */
export function extractMonthFromTitle(title: string): number | null {
  const monthMatch = title.match(/(\d+)月/);
  if (monthMatch?.[1]) {
    return parseInt(monthMatch[1], 10);
  }
  return null;
}

/**
 * 年月から heldOn (YYYY-MM-DD) を生成する。
 */
export function buildHeldOn(year: number, month: number | null): string | null {
  if (!month) return null;
  return `${year}-${String(month).padStart(2, "0")}-01`;
}

/**
 * PDF ファイル名から日付を抽出する。
 *
 * 対応パターン:
 *   R{YY}{MM}{DD}.pdf（例: R030305.pdf → 2021-03-05）
 *   {YYYYMMDD}.pdf（例: 20250304.pdf → 2025-03-04）
 */
export function extractDateFromFilename(filename: string): string | null {
  // 西暦形式: 20250304.pdf
  const seirekiMatch = filename.match(/^(\d{4})(\d{2})(\d{2})\.pdf$/i);
  if (seirekiMatch) {
    const year = parseInt(seirekiMatch[1]!, 10);
    const month = seirekiMatch[2]!;
    const day = seirekiMatch[3]!;
    // 妥当な年かチェック (2000 〜 2099)
    if (year >= 2000 && year <= 2099) {
      return `${year}-${month}-${day}`;
    }
  }

  // 和暦形式: R030305.pdf
  const warekiMatch = filename.match(/^R(\d{2})(\d{2})(\d{2})\.pdf$/i);
  if (warekiMatch) {
    const reiwaYear = parseInt(warekiMatch[1]!, 10);
    const month = warekiMatch[2]!;
    const day = warekiMatch[3]!;
    const seireki = 2018 + reiwaYear;
    return `${seireki}-${month}-${day}`;
  }

  return null;
}

/**
 * HTML エンティティをデコードする（&amp; → & など）。
 */
export function decodeHtmlEntities(text: string): string {
  return text
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
}

/**
 * href を絶対 URL に変換する。
 * HTML エンティティ（&amp; 等）をデコードしてから変換する。
 */
export function resolveUrl(href: string, baseUrl?: string): string {
  const decoded = decodeHtmlEntities(href);
  if (decoded.startsWith("http")) return decoded;
  if (decoded.startsWith("//")) return `https:${decoded}`;
  if (decoded.startsWith("/")) return `${BASE_ORIGIN}${decoded}`;
  if (decoded.startsWith("./")) {
    const base = baseUrl ?? BASE_ORIGIN;
    const basePath = base.replace(/\/[^/]*$/, "");
    return `${basePath}/${decoded.slice(2)}`;
  }
  return `${BASE_ORIGIN}/${decoded}`;
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

/** バイナリデータを取得する */
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

/** リクエスト間の待機 */
export function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
