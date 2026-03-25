/**
 * 能登町議会 — list フェーズ
 *
 * 2段階で PDF リンクを収集する:
 * 1. 年度一覧ページから対象年度のページ URL を取得
 * 2. 年度別ページから PDF リンクとメタ情報を抽出
 *
 * 年度別ページ URL は固定マッピング（ページ ID が不規則のため）。
 * 同一年度に複数ページが存在する場合（令和2〜4年）は全て処理する。
 */

import { BASE_ORIGIN, fetchPage } from "./shared";

export interface NotoMeeting {
  pdfUrl: string;
  title: string;
  heldOn: string | null;
  session: string;
}

/**
 * 年度別ページ URL のマッピング（西暦年 -> ページ ID リスト）。
 * URL パターンが不規則なため、固定マッピングで対応する。
 * 令和2〜4年は年度途中でページが分割されているため複数エントリ。
 */
const YEAR_PAGE_MAP: Record<number, string[]> = {
  2026: ["5117"],
  2025: ["3430"],
  2024: ["1401"],
  2023: ["1358"],
  2022: ["1357", "1443"],
  2021: ["1442", "1439"],
  2020: ["1438", "1325"],
  2019: ["1773"],
  2018: ["1355", "1322"],
  2017: ["1353"],
  2016: ["1348"],
  2015: ["1347"],
  2014: ["1320"],
  2013: ["1318"],
  2012: ["1317"],
  2011: ["1315"],
  2010: ["1312"],
  2009: ["1394"],
  2008: ["1393"],
  2007: ["1392"],
  2006: ["1396"],
  2005: ["1397"],
};

function buildYearPageUrls(year: number): string[] {
  const pageIds = YEAR_PAGE_MAP[year];
  if (!pageIds) return [];
  return pageIds.map(
    (id) => `${BASE_ORIGIN}/kakuka/1013/gyomu/1/1/${id}.html`
  );
}

/**
 * リンクテキストから開催月を取得して YYYY-MM-DD で返す。
 *
 * 対応パターン:
 *   "第1回能登町議会1月会議録" -> 1月
 *   "第2回能登町議会3月定例会議録" -> 3月
 *   "平成17年第1回能登町議会臨時会" -> 年・回のみ（月不明）
 */
export function parseDateFromTitle(
  title: string,
  year: number
): string | null {
  // 令和期パターン: 「第N回能登町議会M月[定例]会議録」
  const recentMatch = title.match(/第\d+回能登町議会(\d+)月/);
  if (recentMatch) {
    const month = Number(recentMatch[1]);
    return `${year}-${String(month).padStart(2, "0")}-01`;
  }

  // 平成期パターン: 「平成N年第M回能登町議会(定例会|臨時会)」
  // 月情報がないので年のみ使用 -> null を返して呼び出し元で判断
  return null;
}

/**
 * リンクテキストから会議種別を抽出する。
 */
export function parseSessionFromTitle(title: string): string {
  // 令和期: 「第N回能登町議会M月定例会議録」 or 「第N回能登町議会M月会議録」
  const recentMatch = title.match(/第(\d+)回能登町議会(\d+)月(定例)?会議録/);
  if (recentMatch) {
    const num = recentMatch[1]!;
    const month = recentMatch[2]!;
    const kind = recentMatch[3] ? "定例会" : "会議";
    return `第${num}回${month}月${kind}`;
  }

  // 平成期: 「第N回能登町議会定例会」「第N回能登町議会臨時会」
  const historicMatch = title.match(/第(\d+)回能登町議会(定例会|臨時会)/);
  if (historicMatch) {
    return `第${historicMatch[1]}回${historicMatch[2]}`;
  }

  if (title.includes("臨時")) return "臨時会";
  if (title.includes("定例")) return "定例会";

  return "";
}

/**
 * 年度別ページの HTML から PDF リンクを抽出する（テスト可能な純粋関数）。
 */
export function parseYearPage(
  html: string,
  year: number
): NotoMeeting[] {
  const results: NotoMeeting[] = [];

  // /material/files/group/14/ を含む PDF リンクを抽出
  const linkPattern = /<a[^>]+href="([^"]*\/material\/files\/group\/14\/[^"]*\.pdf)"[^>]*>([\s\S]*?)<\/a>/gi;

  for (const match of html.matchAll(linkPattern)) {
    let href = match[1]!;
    const linkText = match[2]!.replace(/<[^>]+>/g, "").trim();

    // ファイルサイズ情報を除去してタイトルを生成
    const title = linkText.replace(/\s*\(PDFファイル:.*?\)$/, "").trim();
    if (!title) continue;

    // PDF の完全 URL を構築（プロトコル相対 URL に対応）
    if (href.startsWith("//")) {
      href = `https:${href}`;
    } else if (href.startsWith("/")) {
      href = `${BASE_ORIGIN}${href}`;
    }

    const heldOn = parseDateFromTitle(title, year);
    const session = parseSessionFromTitle(title);

    results.push({
      pdfUrl: href,
      title,
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
): Promise<NotoMeeting[]> {
  const yearPageUrls = buildYearPageUrls(year);

  if (yearPageUrls.length === 0) {
    // マッピングにない場合は一覧ページから探す
    const topHtml = await fetchPage(baseUrl);
    if (!topHtml) return [];

    // 年度一覧ページから和暦テキストが含まれるリンクを探す
    const found = findYearPageFromTop(topHtml, year);
    if (!found) return [];
    yearPageUrls.push(found);
  }

  const allMeetings: NotoMeeting[] = [];
  const seenUrls = new Set<string>();

  for (const pageUrl of yearPageUrls) {
    const html = await fetchPage(pageUrl);
    if (!html) continue;

    const meetings = parseYearPage(html, year);
    for (const m of meetings) {
      if (!seenUrls.has(m.pdfUrl)) {
        seenUrls.add(m.pdfUrl);
        allMeetings.push(m);
      }
    }
  }

  return allMeetings;
}

/**
 * 年度一覧トップページから指定年度に対応するページ URL を探す。
 */
function findYearPageFromTop(html: string, year: number): string | null {
  // 和暦テキストを計算
  const eraTexts: string[] = [];
  if (year >= 2020) {
    eraTexts.push(`令和${year - 2018}年`);
  } else if (year === 2019) {
    eraTexts.push("令和元年");
    eraTexts.push("平成31年");
  } else if (year >= 1989) {
    const eraYear = year - 1988;
    eraTexts.push(eraYear === 1 ? "平成元年" : `平成${eraYear}年`);
  }

  // kakuka/1013/gyomu/1/1/{id}.html パターンのリンクを抽出
  const linkPattern =
    /<a[^>]+href="([^"]*\/kakuka\/1013\/gyomu\/1\/1\/(?!index)[^"]+\.html)"[^>]*>([^<]+)<\/a>/g;

  for (const match of html.matchAll(linkPattern)) {
    const href = match[1]!;
    const label = match[2]!.trim();
    if (eraTexts.some((era) => label.includes(era))) {
      if (href.startsWith("/")) {
        return `${BASE_ORIGIN}${href}`;
      }
      return href;
    }
  }

  return null;
}
