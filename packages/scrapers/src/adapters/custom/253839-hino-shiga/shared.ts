/**
 * 日野町議会（滋賀県）— 共通ユーティリティ
 *
 * サイト: https://www.town.shiga-hino.lg.jp/category/32-3-6-0-0-0-0-0-0-0.html
 * 自治体コード: 253839
 *
 * 会議録は日野町公式サイト上の記事ページに掲載され、
 * 各記事内で日別の PDF が公開されている。
 */

export const BASE_ORIGIN = "https://www.town.shiga-hino.lg.jp";
export const INDEX_URL = `${BASE_ORIGIN}/category/32-3-6-0-0-0-0-0-0-0.html`;

const USER_AGENT =
  "open-gikai-bot/1.0 (https://github.com/matsupiee/open-gikai; contact: please see github)";

const FETCH_TIMEOUT_MS = 30_000;
const PDF_FETCH_TIMEOUT_MS = 60_000;

/** 会議タイプを検出 */
export function detectMeetingType(title: string): string {
  if (title.includes("委員会")) return "committee";
  if (title.includes("臨時会")) return "extraordinary";
  return "plenary";
}

/**
 * 会議タイトルから年を抽出して西暦に変換する。
 *
 * 対応例:
 *   令和6年第2回（3月）定例会会議録
 *   令和元年第4回（9月）定例会会議録
 *   平成31年第1回（3月）定例会会議録
 */
export function extractYearFromTitle(title: string): number | null {
  const reiwaMatch = title.match(/令和(元|\d+)年/);
  if (reiwaMatch) {
    const eraYear = reiwaMatch[1] === "元" ? 1 : Number.parseInt(reiwaMatch[1]!, 10);
    return 2018 + eraYear;
  }

  const heiseiMatch = title.match(/平成(元|\d+)年/);
  if (heiseiMatch) {
    const eraYear = heiseiMatch[1] === "元" ? 1 : Number.parseInt(heiseiMatch[1]!, 10);
    return 1988 + eraYear;
  }

  return null;
}

/** 会議タイトルから月を抽出する */
export function extractMonthFromTitle(title: string): number | null {
  const match = title.match(/(\d+)月/);
  return match?.[1] ? Number.parseInt(match[1], 10) : null;
}

/** 年月から heldOn を組み立てる */
export function buildHeldOn(year: number, month: number | null): string | null {
  if (!month) return null;
  return `${year}-${String(month).padStart(2, "0")}-01`;
}

/**
 * PDF ファイル名またはリンクテキストから開催日を抽出する。
 *
 * 優先順位:
 * 1. PDF ファイル名の YYYYMMDD
 * 2. リンクテキストの X月Y日
 * 3. セッションタイトルの X月Y日
 * 4. セッションタイトルの年 + 月
 */
export function extractHeldOnFromPdf(
  pdfUrl: string,
  linkText: string,
  sessionTitle: string,
): string | null {
  const fileName = pdfUrl.split("/").pop() ?? "";
  const fileDateMatch = fileName.match(/^(\d{4})(\d{2})(\d{2})/);
  if (fileDateMatch) {
    return `${fileDateMatch[1]}-${fileDateMatch[2]}-${fileDateMatch[3]}`;
  }

  const linkDateMatch = linkText.match(/(\d+)月(\d+)日/);
  if (linkDateMatch) {
    const year = extractYearFromTitle(sessionTitle);
    if (year) {
      const month = String(Number.parseInt(linkDateMatch[1]!, 10)).padStart(2, "0");
      const day = String(Number.parseInt(linkDateMatch[2]!, 10)).padStart(2, "0");
      return `${year}-${month}-${day}`;
    }
  }

  const titleDateMatch = sessionTitle.match(/(\d+)月(\d+)日/);
  if (titleDateMatch) {
    const year = extractYearFromTitle(sessionTitle);
    if (year) {
      const month = String(Number.parseInt(titleDateMatch[1]!, 10)).padStart(2, "0");
      const day = String(Number.parseInt(titleDateMatch[2]!, 10)).padStart(2, "0");
      return `${year}-${month}-${day}`;
    }
  }

  const year = extractYearFromTitle(sessionTitle);
  const month = extractMonthFromTitle(sessionTitle);
  return year ? buildHeldOn(year, month) : null;
}

/** href を絶対 URL に変換する */
export function resolveUrl(href: string): string {
  if (href.startsWith("//")) return `https:${href}`;
  if (href.startsWith("http")) return href;
  if (href.startsWith("/")) return `${BASE_ORIGIN}${href}`;
  if (href.startsWith("./")) return `${BASE_ORIGIN}/${href.slice(2)}`;
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
