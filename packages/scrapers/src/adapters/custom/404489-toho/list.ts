/**
 * 東峰村議会（福岡県） — list フェーズ
 *
 * 2段階で PDF リンクを収集する:
 * 1. 年度別一覧ページから個別会議ページへのリンクを抽出
 * 2. 各個別ページから PDF ダウンロードリンクとメタ情報を抽出
 */

import {
  BASE_ORIGIN,
  buildYearIndexUrls,
  detectMeetingType,
  fetchPage,
  parseDateText,
} from "./shared";

export interface TohoMeeting {
  /** PDF ダウンロード URL */
  pdfUrl: string;
  /** 会議タイトル（例: 令和7年第7回東峰村議会定例会） */
  title: string;
  /** 開催日 YYYY-MM-DD */
  heldOn: string;
  /** 会議種別 plenary/extraordinary/committee */
  meetingType: string;
  /** 個別ページ URL（sourceUrl として利用） */
  pageUrl: string;
}

/**
 * 年度別一覧ページから個別会議ページへのリンクを抽出する（テスト可能な純粋関数）。
 *
 * HTML 構造:
 *   <a href="post-747.html">令和7年第7回東峰村議会定例会</a>
 *   <a href="4-3.html">令和7年第4回東峰村議会定例会</a>
 *   <a href="289281267.html">平成28年第9回定例会</a>
 */
export function parseListPage(
  html: string,
  yearIndexUrl: string,
): { title: string; pageUrl: string }[] {
  const results: { title: string; pageUrl: string }[] = [];

  // Base URL for resolving relative links (strip index.html)
  const baseUrlDir = yearIndexUrl.replace(/\/index\.html$/, "");

  // Match links that look like individual meeting pages (.html) with meeting titles
  // Titles contain 定例会、臨時会、委員会 etc.
  const linkRegex =
    /<a[^>]+href="([^"#]+\.html)"[^>]*>([^<]*(?:定例会|臨時会|委員会|議会)[^<]*)<\/a>/gi;

  for (const match of html.matchAll(linkRegex)) {
    const href = match[1]!;
    const title = match[2]!.replace(/\s+/g, " ").trim();

    // Skip navigation/menu links pointing to index pages
    if (href.includes("index.html")) continue;

    let pageUrl: string;
    if (href.startsWith("http")) {
      pageUrl = href;
    } else if (href.startsWith("//")) {
      pageUrl = `https:${href}`;
    } else if (href.startsWith("/")) {
      pageUrl = `${BASE_ORIGIN}${href}`;
    } else {
      // Relative link — resolve against year directory
      pageUrl = `${baseUrlDir}/${href}`;
    }

    results.push({ title, pageUrl });
  }

  return results;
}

/**
 * 相対パスの PDF URL をページ URL を基準に解決する。
 * 「../../../2025/12/24/abc.pdf」→ 「https://vill.toho-info.com/2025/12/24/abc.pdf」
 */
function resolvePdfUrl(href: string, pageUrl: string): string {
  if (href.startsWith("http")) return href;
  if (href.startsWith("//")) return `https:${href}`;
  if (href.startsWith("/")) return `${BASE_ORIGIN}${href}`;
  // 相対パス: URL の解決に URL クラスを使う
  try {
    return new URL(href, pageUrl).href;
  } catch {
    return href;
  }
}

/**
 * 個別会議ページから PDF リンクと開催日を抽出する（テスト可能な純粋関数）。
 *
 * HTML 構造 (WordPress):
 *   <title>令和７年第７回東峰村議会定例会（令和７年１２月９日～１１日） | 東峰村役場ホームぺージ</title>
 *   <a href="../../../2025/12/24/0d27345e4595e4ea81d4598673001794.pdf">
 *     令和７年第７回東峰村議会定例会会議録.pdf
 *   </a>
 *
 * 開催日は <title> タグ内の和暦（全角・半角数字対応）から抽出する。
 * 本文テキスト中にも和暦があれば同様に取得する。
 */
export function parseDetailPage(
  html: string,
  meetingTitle: string,
  pageUrl: string,
): TohoMeeting[] {
  const results: TohoMeeting[] = [];
  const meetingType = detectMeetingType(meetingTitle);

  // Extract PDF links (handle relative paths using pageUrl)
  const pdfLinkRegex = /<a[^>]+href="([^"]+\.pdf)"[^>]*>/gi;
  const pdfUrls: string[] = [];

  for (const match of html.matchAll(pdfLinkRegex)) {
    const href = match[1]!;
    pdfUrls.push(resolvePdfUrl(href, pageUrl));
  }

  if (pdfUrls.length === 0) return results;

  // Extract date: first try <title>, then stripped body text
  // <title> に全角数字で「令和７年１２月９日」形式が含まれることが多い
  const titleMatch = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  const titleText = titleMatch ? titleMatch[1]!.replace(/<[^>]+>/g, " ") : "";
  const strippedBody = html.replace(/<[^>]+>/g, " ");

  const heldOn = parseDateText(titleText) ?? parseDateText(strippedBody);
  if (!heldOn) return results;

  for (const pdfUrl of pdfUrls) {
    results.push({
      pdfUrl,
      title: meetingTitle,
      heldOn,
      meetingType,
      pageUrl,
    });
  }

  return results;
}

/**
 * 指定年度の全 PDF リンクを取得する。
 */
export async function fetchMeetingList(
  _baseUrl: string,
  year: number,
): Promise<TohoMeeting[]> {
  // Find the year index URL for the given fiscal year
  const yearUrls = buildYearIndexUrls();
  const yearEntry = yearUrls.find((e) => e.fiscalYear === year);
  if (!yearEntry) return [];

  const yearIndexUrl = yearEntry.url;

  // Step 1: 年度別一覧ページから個別ページリンクを取得
  const listHtml = await fetchPage(yearIndexUrl);
  if (!listHtml) return [];

  const pages = parseListPage(listHtml, yearIndexUrl);
  if (pages.length === 0) return [];

  // Step 2: 各個別ページから PDF リンクを抽出
  const allMeetings: TohoMeeting[] = [];

  for (let i = 0; i < pages.length; i++) {
    const page = pages[i]!;
    const detailHtml = await fetchPage(page.pageUrl);
    if (!detailHtml) continue;

    const meetings = parseDetailPage(detailHtml, page.title, page.pageUrl);
    allMeetings.push(...meetings);

    // レート制限: 最後のリクエスト後は待たない
    if (i < pages.length - 1) {
      await new Promise((r) => setTimeout(r, 1500));
    }
  }

  return allMeetings;
}
