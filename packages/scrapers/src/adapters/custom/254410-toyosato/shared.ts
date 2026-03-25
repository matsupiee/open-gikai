/**
 * 豊郷町議会 — 共通ユーティリティ
 *
 * サイト: https://www.town.toyosato.shiga.jp/category/32-5-0-0-0-0-0-0-0-0.html
 * 自治体コード: 254410
 *
 * 会議録は PDF 形式で年度別に公開。独自 CMS。検索機能なし。
 * トップページから会議詳細ページ URL を収集し、
 * 各詳細ページから会議録 PDF リンクを収集する。
 */

export const BASE_ORIGIN = "https://www.town.toyosato.shiga.jp";
export const INDEX_URL = `${BASE_ORIGIN}/category/32-5-0-0-0-0-0-0-0-0.html`;

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
 * 会議タイトルから年を抽出して西暦に変換する。
 *
 * 対応パターン:
 *   令和X年（X月）豊郷町議会定例会
 *   令和元年（X月）豊郷町議会臨時会
 *   平成XX年（X月）豊郷町議会定例会
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
 * 会議タイトルから月を抽出する。
 * 「3月定例会」「令和6年6月」のような形式に対応。
 * 月が不明な場合は null を返す。
 */
export function extractMonthFromTitle(title: string): number | null {
  const monthMatch = title.match(/(\d+)月/);
  if (monthMatch?.[1]) {
    return parseInt(monthMatch[1], 10);
  }
  return null;
}

/**
 * 会議名から heldOn (YYYY-MM-DD) を推定する。
 * 月が不明な場合は null を返す。
 */
export function buildHeldOn(year: number, month: number | null): string | null {
  if (!month) return null;
  return `${year}-${String(month).padStart(2, "0")}-01`;
}

/**
 * リンクテキスト（例: 「12月8日　会議録」）から日付文字列（MMDD）を抽出する。
 * 抽出できない場合は null を返す。
 */
export function extractDateFromLinkText(linkText: string): string | null {
  const match = linkText.match(/(\d+)月(\d+)日/);
  if (!match) return null;
  const month = String(parseInt(match[1]!, 10)).padStart(2, "0");
  const day = String(parseInt(match[2]!, 10)).padStart(2, "0");
  return `${month}${day}`;
}

/**
 * リンクテキストまたは PDF ファイル名から開催日（YYYY-MM-DD）を抽出する。
 *
 * 優先順位:
 * 1. PDF ファイル名が YYYYMMDD.pdf の形式の場合はそこから取得
 * 2. リンクテキストから月日を取得し、sessionTitle から年を補完
 */
export function extractHeldOnFromPdf(
  pdfUrl: string,
  linkText: string,
  sessionTitle: string,
): string | null {
  // PDF ファイル名から YYYYMMDD を抽出
  const fileName = pdfUrl.split("/").pop() ?? "";
  const dateMatch = fileName.match(/^(\d{4})(\d{2})(\d{2})\.pdf$/);
  if (dateMatch) {
    return `${dateMatch[1]}-${dateMatch[2]}-${dateMatch[3]}`;
  }

  // リンクテキストから月日を抽出し、sessionTitle から年を補完
  const linkDateMatch = linkText.match(/(\d+)月(\d+)日/);
  if (linkDateMatch) {
    const year = extractYearFromTitle(sessionTitle);
    if (year) {
      const month = String(parseInt(linkDateMatch[1]!, 10)).padStart(2, "0");
      const day = String(parseInt(linkDateMatch[2]!, 10)).padStart(2, "0");
      return `${year}-${month}-${day}`;
    }
  }

  // 月のみ抽出
  const year = extractYearFromTitle(sessionTitle);
  const month = extractMonthFromTitle(sessionTitle);
  return year ? buildHeldOn(year, month) : null;
}

/**
 * href を絶対 URL に変換する。
 * "//" 始まりや相対パスを正規化する。
 */
export function resolveUrl(href: string): string {
  if (href.startsWith("//")) return `https:${href}`;
  if (href.startsWith("http")) return href;
  if (href.startsWith("/")) return `${BASE_ORIGIN}${href}`;
  return `${BASE_ORIGIN}/${href}`;
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
