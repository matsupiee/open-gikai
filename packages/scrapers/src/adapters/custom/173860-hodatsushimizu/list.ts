/**
 * 宝達志水町議会 — list フェーズ
 *
 * 2段階で PDF リンクを収集する:
 * 1. 年度一覧ページから対象年度のページ URL を取得
 * 2. 年度別ページから PDF リンクとメタ情報を抽出
 *
 * 年度別ページ URL は固定マッピング（ページ ID が不規則のため）。
 */

import { BASE_ORIGIN, fetchPage, toJapaneseEra } from "./shared";

export interface HodatsushimizuMeeting {
  pdfUrl: string;
  title: string;
  heldOn: string;
  session: string;
}

/**
 * 年度別ページ URL のマッピング（和暦年 -> ページ ID）。
 * URL パターンが不規則なため、固定マッピングで対応する。
 */
const YEAR_PAGE_MAP: Record<number, string> = {
  2025: "7462",
  2024: "6614",
  2023: "5550",
  2022: "4845",
  2021: "4333",
  2020: "1256",
  2019: "1268",
  2018: "1093",
  2017: "1070",
  2016: "1047",
  2015: "1027",
  2014: "1009",
  2013: "995",
  2012: "986",
  2011: "977",
  2010: "971",
  2009: "969",
  2008: "964",
  2007: "962",
  2006: "958",
  2005: "955",
};

function buildYearPageUrl(year: number): string | null {
  const pageId = YEAR_PAGE_MAP[year];
  if (!pageId) return null;
  return `${BASE_ORIGIN}/soshiki/gikaijimukyoku/2/${pageId}.html`;
}

/**
 * 一覧ページ HTML から年度別ページのリンクを抽出する。
 */
export function parseTopPage(
  html: string
): { label: string; url: string }[] {
  const results: { label: string; url: string }[] = [];

  const linkRegex =
    /<a[^>]+href="([^"]*\/soshiki\/gikaijimukyoku\/2\/\d+\.html)"[^>]*>([^<]+)<\/a>/g;

  for (const match of html.matchAll(linkRegex)) {
    const href = match[1]!;
    const label = match[2]!.trim();

    if (!label.includes("会議録")) continue;

    let url: string;
    if (href.startsWith("http")) {
      url = href;
    } else if (href.startsWith("//")) {
      url = `https:${href}`;
    } else if (href.startsWith("/")) {
      url = `${BASE_ORIGIN}${href}`;
    } else {
      url = `${BASE_ORIGIN}/${href}`;
    }

    results.push({ label, url });
  }

  return results;
}

/**
 * リンクテキストから開催日を抽出し YYYY-MM-DD で返す。
 *
 * 対応パターン:
 *   "令和5年第1回定例会会議録（3月2日〜3月10日）" -> 最初の日付を使用
 *   "令和5年第1回臨時会会議録（1月6日）"
 *   "宝達志水町R6年3月定例会" -> R6年3月 -> 2024-03-01
 */
export function parseDateFromLinkText(
  text: string,
  fallbackYear?: number
): string | null {
  // パターン1: 和暦年＋日付（令和X年...M月D日）
  {
    const eraMatch = text.match(/(令和|平成)(元|\d+)年/);
    const dateMatch = text.match(/[（(](\d+)月(\d+)日/);
    if (eraMatch && dateMatch) {
      const eraYear =
        eraMatch[2] === "元" ? 1 : Number(eraMatch[2]);
      const baseYear =
        eraMatch[1] === "令和" ? eraYear + 2018 : eraYear + 1988;
      const month = Number(dateMatch[1]);
      const day = Number(dateMatch[2]);
      return `${baseYear}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    }
  }

  // パターン2: RX年M月 形式（旧形式 e.g., "宝達志水町R6年3月定例会"）
  {
    const rMatch = text.match(/R(\d+)年(\d+)月/);
    if (rMatch) {
      const westernYear = Number(rMatch[1]) + 2018;
      const month = Number(rMatch[2]);
      return `${westernYear}-${String(month).padStart(2, "0")}-01`;
    }
  }

  // パターン3: 和暦年のみ（月日は括弧外にある場合）
  {
    const eraMatch = text.match(/(令和|平成)(元|\d+)年/);
    if (eraMatch && fallbackYear) {
      // 括弧なしで月日がある場合
      const monthDayMatch = text.match(/(\d+)月(\d+)日/);
      if (monthDayMatch) {
        const eraYear =
          eraMatch[2] === "元" ? 1 : Number(eraMatch[2]);
        const baseYear =
          eraMatch[1] === "令和" ? eraYear + 2018 : eraYear + 1988;
        const month = Number(monthDayMatch[1]);
        const day = Number(monthDayMatch[2]);
        return `${baseYear}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
      }
    }
  }

  return null;
}

/**
 * リンクテキストから会議種別を抽出する。
 */
export function parseSessionFromLinkText(text: string): string {
  const match = text.match(/第\d+回(定例会|臨時会)/);
  if (match) return match[0]!;

  // 旧形式: "R6年3月定例会" — 月付きパターンを先にチェック
  const monthMatch = text.match(/(\d+)月(定例会|臨時会)/);
  if (monthMatch) return `${monthMatch[1]}月${monthMatch[2]}`;

  if (text.includes("臨時会")) return "臨時会";
  if (text.includes("定例会")) return "定例会";

  return "";
}

/**
 * 年度別ページの HTML から PDF リンクを抽出する（テスト可能な純粋関数）。
 */
export function parseYearPage(
  html: string,
  pageUrl: string,
  year: number
): HodatsushimizuMeeting[] {
  const results: HodatsushimizuMeeting[] = [];

  // PDF リンクを抽出
  const linkPattern = /<a[^>]+href="([^"]*\.pdf)"[^>]*>([\s\S]*?)<\/a>/gi;

  for (const match of html.matchAll(linkPattern)) {
    let href = match[1]!;
    const linkText = match[2]!.replace(/<[^>]+>/g, "").trim();

    // ファイルサイズ情報を除去してタイトルを生成
    const cleanText = linkText
      .replace(/\(PDFファイル[^)]*\)/g, "")
      .replace(/\(PDF[^)]*\)/g, "")
      .trim();

    // 開催日を抽出
    const heldOn = parseDateFromLinkText(linkText, year);
    if (!heldOn) continue;

    // 会議種別を抽出
    const session = parseSessionFromLinkText(linkText);

    // PDF の完全 URL を構築
    if (href.startsWith("//")) {
      href = `https:${href}`;
    } else if (href.startsWith("/")) {
      href = `${BASE_ORIGIN}${href}`;
    } else if (!href.startsWith("http")) {
      const baseUrl = pageUrl.replace(/\/[^/]+$/, "/");
      href = baseUrl + href;
    }

    results.push({
      pdfUrl: href,
      title: cleanText,
      heldOn,
      session,
    });
  }

  return results;
}

/**
 * 指定年の全 PDF リンクを取得する。
 */
export async function fetchMeetingList(
  baseUrl: string,
  year: number
): Promise<HodatsushimizuMeeting[]> {
  // 固定マッピングから年度別ページ URL を取得
  let yearPageUrl = buildYearPageUrl(year);

  if (!yearPageUrl) {
    // マッピングにない場合は一覧ページから探す
    const topHtml = await fetchPage(baseUrl);
    if (!topHtml) return [];

    const yearPages = parseTopPage(topHtml);
    const eraTexts = toJapaneseEra(year);

    const targetPage = yearPages.find((p) =>
      eraTexts.some((era) => p.label.includes(era))
    );
    if (!targetPage) return [];
    yearPageUrl = targetPage.url;
  }

  // 年度別ページから PDF リンクを抽出
  const yearHtml = await fetchPage(yearPageUrl);
  if (!yearHtml) return [];

  return parseYearPage(yearHtml, yearPageUrl, year);
}
