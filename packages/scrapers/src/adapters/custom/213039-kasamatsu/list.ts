/**
 * 笠松町議会 会議録 — list フェーズ
 *
 * 会議録トップページから年度別ページ URL を取得し、
 * 各年度ページから PDF リンクとメタ情報を収集する。
 *
 * トップページ構造:
 *   <a href="/docs/{ページID}/">○○年議会会議録</a>
 *
 * 年度別ページ構造:
 *   <a href="/file_contents/{ファイル名}.pdf">第4回定例会(第1号)　令和5年12月5日(PDF形式406KB)</a>
 *   または href が .pdf で終わるリンク
 */

import {
  BASE_ORIGIN,
  TOP_PAGE_URL,
  fetchPage,
  parseDateFromLinkText,
} from "./shared";

export interface KasamatsuMeeting {
  /** PDF の完全 URL */
  pdfUrl: string;
  /** 会議タイトル（例: "第4回定例会(第1号)"） */
  title: string;
  /** 開催日 YYYY-MM-DD */
  heldOn: string;
}

/**
 * 年度別ページへのリンク一覧を抽出する。
 * href が /docs/{ページID}/ 形式のリンクを抽出する。
 */
export function parseYearPageLinks(html: string): string[] {
  const urls: string[] = [];
  const linkPattern = /<a[^>]+href="(\/docs\/\d+\/)"[^>]*>[^<]*(?:議会会議録|会議録)[^<]*<\/a>/gi;

  for (const match of html.matchAll(linkPattern)) {
    const path = match[1]!;
    const fullUrl = `${BASE_ORIGIN}${path}`;
    if (!urls.includes(fullUrl)) {
      urls.push(fullUrl);
    }
  }

  return urls;
}

/**
 * 年度別ページの HTML から PDF リンクを抽出する。
 *
 * href は年度ページからの相対パス（例: "file_contents/R06_4teireikai-1gou-R061206.pdf"）。
 * 実際の PDF URL は年度ページ URL を基準に解決する。
 *
 * リンクテキストのパターン:
 *   "第4回定例会(第1号)　令和5年12月5日(PDF形式406KB)"
 *   "第4回臨時会（第1号）　令和7年12月22日(PDF形式304KBytes)"
 *
 * @param html 年度別ページの HTML
 * @param pageUrl 年度別ページの URL（相対パスの解決に使用）
 */
export function parseYearPage(html: string, pageUrl: string): KasamatsuMeeting[] {
  const results: KasamatsuMeeting[] = [];

  // href が file_contents/ を含むか .pdf で終わるリンクを抽出
  const linkPattern =
    /<a[^>]+href="([^"]*(?:file_contents\/[^"]+\.pdf|[^"]+\.pdf))"[^>]*>([\s\S]*?)<\/a>/gi;

  for (const match of html.matchAll(linkPattern)) {
    const href = match[1]!;
    const rawText = match[2]!
      .replace(/<[^>]+>/g, "")
      .replace(/&nbsp;/g, " ")
      .replace(/&amp;/g, "&")
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">")
      .replace(/&quot;/g, '"')
      .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(Number(code)))
      .trim();

    if (!rawText) continue;

    // 開催日を解析
    const heldOn = parseDateFromLinkText(rawText);
    if (!heldOn) continue;

    // 会議タイトルを抽出: "第N回定例会(第M号)" または "第N回臨時会（第M号）"
    const titleMatch = rawText.match(/第\d+回(?:定例会|臨時会)[（(]第\d+号[)）]/);
    const title = titleMatch ? titleMatch[0] : rawText.split(/[\s　]/)[0] ?? rawText;

    // PDF の完全 URL を組み立て
    // href は年度ページ URL 相対のパスのため、pageUrl を基準に解決する
    let pdfUrl: string;
    if (href.startsWith("http")) {
      pdfUrl = href;
    } else if (href.startsWith("/")) {
      pdfUrl = `${BASE_ORIGIN}${href}`;
    } else {
      // 相対パス: 年度ページ URL のディレクトリを基準に解決
      const base = pageUrl.endsWith("/") ? pageUrl : pageUrl + "/";
      pdfUrl = `${base}${href}`;
    }

    results.push({
      pdfUrl,
      title,
      heldOn,
    });
  }

  return results;
}

/**
 * 指定年の全 PDF リンクを取得する。
 * トップページから年度別ページ URL を収集し、各ページを巡回する。
 */
export async function fetchMeetingList(
  year: number,
): Promise<KasamatsuMeeting[]> {
  const topHtml = await fetchPage(TOP_PAGE_URL);
  if (!topHtml) return [];

  const yearPageUrls = parseYearPageLinks(topHtml);

  const allMeetings: KasamatsuMeeting[] = [];

  for (const pageUrl of yearPageUrls) {
    const html = await fetchPage(pageUrl);
    if (!html) continue;

    const meetings = parseYearPage(html, pageUrl);
    allMeetings.push(...meetings);
  }

  // 対象年でフィルタ
  return allMeetings.filter((m) => {
    const meetingYear = parseInt(m.heldOn.slice(0, 4), 10);
    return meetingYear === year;
  });
}
