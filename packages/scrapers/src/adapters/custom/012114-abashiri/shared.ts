/**
 * 網走市議会 会議録 — 共通ユーティリティ
 *
 * サイト: https://www.city.abashiri.hokkaido.jp/site/gikai/1581.html
 * 自治体コード: 012114
 *
 * 全会議録は PDF ファイルで提供される。
 * 定例会・臨時会は dl/dd 構造、委員会は table 構造で PDF リンクを掲載。
 */

export const BASE_ORIGIN = "https://www.city.abashiri.hokkaido.jp";

const USER_AGENT =
  "open-gikai-bot/1.0 (https://github.com/matsupiee/open-gikai; contact: please see github)";

const FETCH_TIMEOUT_MS = 30_000;

/**
 * 一覧ページの定義。
 * category: 会議種別（"plenary" / "extraordinary" / "committee"）
 * label: 表示用の会議名
 */
export interface PageDef {
  url: string;
  category: string;
  label: string;
}

/** 全一覧ページの定義 */
export const LIST_PAGES: PageDef[] = [
  // 本会議
  { url: "/site/gikai/1568.html", category: "plenary", label: "定例会" },
  { url: "/soshiki/32/1569.html", category: "extraordinary", label: "臨時会" },
  // 常任委員会（H27.5〜）
  { url: "/soshiki/32/6990.html", category: "committee", label: "総務経済委員会" },
  { url: "/site/gikai/6996.html", category: "committee", label: "文教民生委員会" },
  // 常任委員会（H23.3〜H27.4）
  { url: "/soshiki/32/1592.html", category: "committee", label: "総務文教委員会" },
  { url: "/soshiki/32/1588.html", category: "committee", label: "生活福祉委員会" },
  { url: "/soshiki/32/1582.html", category: "committee", label: "経済建設委員会" },
  // 特別委員会
  { url: "/soshiki/32/1583.html", category: "committee", label: "各会計決算審査特別委員会" },
  { url: "/soshiki/32/1593.html", category: "committee", label: "予算等審査特別委員会" },
  { url: "/site/gikai/10916.html", category: "committee", label: "地方創生総合戦略検討特別委員会" },
  { url: "/soshiki/32/1591.html", category: "committee", label: "新庁舎建設特別委員会" },
  { url: "/soshiki/32/1590.html", category: "committee", label: "新型コロナウイルス感染症対策特別委員会" },
  { url: "/soshiki/32/1580.html", category: "committee", label: "重油漏れ事故対策検討特別委員会" },
];

/** 会議タイプを検出 */
export function detectMeetingType(category: string): string {
  if (category === "extraordinary") return "extraordinary";
  if (category === "committee") return "committee";
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
  } catch {
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
  } catch {
    return null;
  }
}

/**
 * 和暦テキストから西暦年を返す。
 * e.g., "令和7年" → 2025, "令和元年" → 2019, "平成31年" → 2019
 */
export function eraToWesternYear(eraText: string): number | null {
  const match = eraText.match(/(令和|平成)(元|\d+)年/);
  if (!match) return null;

  const [, era, yearPart] = match;
  const eraYear = yearPart === "元" ? 1 : parseInt(yearPart!, 10);

  if (era === "令和") return eraYear + 2018;
  if (era === "平成") return eraYear + 1988;
  return null;
}

/**
 * PDF URL パスから attachment ID を抽出する。
 * e.g., "/uploaded/attachment/13890.pdf" → "13890"
 */
export function extractAttachmentId(pdfPath: string): string | null {
  const match = pdfPath.match(/\/uploaded\/attachment\/(\d+)\.pdf/);
  return match ? match[1]! : null;
}
