/**
 * 邑楽町議会（群馬県） — list フェーズ
 *
 * 会議録トップページから年別一覧ページの URL を取得し、
 * 各年別一覧ページから PDF リンクとメタ情報を収集する。
 *
 * トップページ構造:
 *   <div class="txtbox"> 内の <a href="./XXX/YYY.html"> 形式のリンク
 *
 * 年別一覧ページ構造:
 *   <h2>令和7年第2回定例会（6月）</h2>
 *   <ul><li><a href="../XXX.pdf">6月10日 日程第2号（PDF：XXXkB）</a></li></ul>
 */

import {
  BASE_ORIGIN,
  TOP_PAGE_URL,
  fetchPage,
  eraToWesternYear,
  parseDateText,
  detectMeetingType,
  delay,
} from "./shared";

export interface OraMeeting {
  /** PDF の完全 URL */
  pdfUrl: string;
  /** 会議タイトル（例: "令和7年第2回定例会（6月）日程第2号"） */
  title: string;
  /** 開催日 YYYY-MM-DD（解析できない場合は null） */
  heldOn: string | null;
  /** 会議種別 */
  meetingType: "plenary" | "extraordinary";
}

const INTER_PAGE_DELAY_MS = 1500;

/**
 * トップページ HTML から年別一覧ページへのリンクを抽出する。
 * <div class="txtbox"> 内の .html リンクを抽出する。
 */
export function parseTopPageLinks(html: string): string[] {
  const urls: string[] = [];

  // .html リンクを抽出（./XXX/YYY.html 形式）
  const linkPattern = /<a[^>]+href="(\.\/[^"]+\.html)"[^>]*>/gi;

  for (const match of html.matchAll(linkPattern)) {
    const href = match[1]!;
    // 相対パスを絶対URLに変換
    const baseDir = TOP_PAGE_URL.substring(0, TOP_PAGE_URL.lastIndexOf("/") + 1);
    const fullUrl = href.startsWith("./")
      ? `${baseDir}${href.slice(2)}`
      : `${BASE_ORIGIN}${href}`;

    if (!urls.includes(fullUrl)) {
      urls.push(fullUrl);
    }
  }

  return urls;
}

/**
 * 年別一覧ページ HTML から、対象年の PDF リンクとメタ情報を抽出する。
 *
 * ページ構造:
 *   <h1>議会会議録（令和7年分）</h1>
 *   <div class="txtbox">
 *     <h2>令和7年第2回定例会（6月）</h2>
 *     <ul>
 *       <li><a href="../XXX.pdf">6月10日 日程第2号（PDF：XXXkB）</a></li>
 *     </ul>
 *   </div>
 */
export function parseYearPage(
  html: string,
  pageUrl: string,
  targetYear: number,
): OraMeeting[] {
  const results: OraMeeting[] = [];

  // ページの年度を取得（<h1> タグから）
  const h1Match = html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i);
  if (h1Match) {
    const h1Text = h1Match[1]!.replace(/<[^>]+>/g, "").trim();
    const pageYear = eraToWesternYear(h1Text);
    if (pageYear && pageYear !== targetYear) {
      return [];
    }
  }

  // <h2> タグと後続の <ul> を順に処理する
  // h2 セクションのテキストを抽出するために HTML を分割
  const sectionPattern = /<h2[^>]*>([\s\S]*?)<\/h2>([\s\S]*?)(?=<h2|<\/div>|$)/gi;

  for (const sectionMatch of html.matchAll(sectionPattern)) {
    const h2Text = sectionMatch[1]!.replace(/<[^>]+>/g, "").trim();
    const sectionHtml = sectionMatch[2]!;

    // h2 から年度・会議名を抽出
    const sectionYear = eraToWesternYear(h2Text);
    if (sectionYear && sectionYear !== targetYear) continue;

    const meetingType = detectMeetingType(h2Text);

    // セクション内の PDF リンクを抽出
    const pdfPattern = /<a[^>]+href="([^"]*\.pdf)"[^>]*>([\s\S]*?)<\/a>/gi;

    for (const pdfMatch of sectionHtml.matchAll(pdfPattern)) {
      const href = pdfMatch[1]!.trim();
      const rawLinkText = pdfMatch[2]!.replace(/<[^>]+>/g, "").trim();

      // PDF のサイズ表記を除去
      const linkText = rawLinkText
        .replace(/（PDF[：:][^）]*）/g, "")
        .replace(/\(PDF[：:][^)]*\)/g, "")
        .trim();

      if (!linkText) continue;

      // 開催日をリンクテキストから抽出（例: "6月10日 日程第2号"）
      // h2 から年を補完してフル日付を作成
      const heldOn = parseDateFromLinkText(linkText, h2Text, sectionYear);

      // タイトルを組み立て（会議名 + 日程番号）
      const scheduleMatch = linkText.match(/日程第\d+号/);
      const schedulePart = scheduleMatch ? ` ${scheduleMatch[0]}` : "";
      const title = `${h2Text}${schedulePart}`;

      // PDF の絶対 URL を組み立て
      const pdfUrl = resolvePdfUrl(href, pageUrl);

      results.push({
        pdfUrl,
        title,
        heldOn,
        meetingType,
      });
    }
  }

  return results;
}

/**
 * リンクテキストと h2 見出しから開催日 YYYY-MM-DD を解析する。
 * リンクテキスト例: "6月10日 日程第2号"
 * h2 テキスト例: "令和7年第2回定例会（6月）"
 */
function parseDateFromLinkText(
  linkText: string,
  h2Text: string,
  sectionYear: number | null,
): string | null {
  // リンクテキストに完全な日付がある場合（例: "令和7年6月10日"）
  const fullDate = parseDateText(linkText);
  if (fullDate) return fullDate;

  // リンクテキストに月日のみの場合（例: "6月10日"）
  // 全角数字を半角に変換
  const normalized = linkText.replace(/[０-９]/g, (c) =>
    String.fromCharCode(c.charCodeAt(0) - 0xfee0),
  );
  const mdMatch = normalized.match(/(\d+)月(\d+)日/);
  if (!mdMatch) return null;

  // 年を h2 テキストまたは sectionYear から取得
  const year = sectionYear ?? eraToWesternYear(h2Text);
  if (!year) return null;

  const month = parseInt(mdMatch[1]!, 10);
  const day = parseInt(mdMatch[2]!, 10);
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

/**
 * href と pageUrl から PDF の絶対 URL を組み立てる。
 */
function resolvePdfUrl(href: string, pageUrl: string): string {
  if (href.startsWith("http")) return href;
  if (href.startsWith("/")) return `${BASE_ORIGIN}${href}`;

  // 相対パス（例: "../XXX.pdf" や "XXX.pdf"）
  const pageDir = pageUrl.substring(0, pageUrl.lastIndexOf("/") + 1);
  const url = new URL(href, pageDir);
  return url.toString();
}

/**
 * 指定年の全 PDF リンクを取得する。
 * トップページから年別一覧ページ URL を収集し、各ページを巡回する。
 */
export async function fetchMeetingList(year: number): Promise<OraMeeting[]> {
  const topHtml = await fetchPage(TOP_PAGE_URL);
  if (!topHtml) return [];

  await delay(INTER_PAGE_DELAY_MS);

  const yearPageUrls = parseTopPageLinks(topHtml);
  const allMeetings: OraMeeting[] = [];

  for (const pageUrl of yearPageUrls) {
    const html = await fetchPage(pageUrl);
    if (!html) continue;

    await delay(INTER_PAGE_DELAY_MS);

    const meetings = parseYearPage(html, pageUrl, year);
    allMeetings.push(...meetings);
  }

  return allMeetings;
}
