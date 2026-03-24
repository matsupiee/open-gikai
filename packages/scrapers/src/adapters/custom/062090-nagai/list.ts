/**
 * 長井市議会 会議録 — list フェーズ
 *
 * 3階層構造:
 *   トップ (index.html)
 *   ├── 年度別ページ (e.g., 15203.html)
 *   │   └── 会期別ページ (e.g., 15057.html)
 *   │       └── PDF リンク (material/files/group/19/*.pdf)
 */

import {
  BASE_ORIGIN,
  INDEX_PATH,
  fetchPage,
  parseDateFromFilename,
  parseEraYear,
} from "./shared";

export interface NagaiMeeting {
  pdfUrl: string;
  title: string;
  heldOn: string;
  sessionName: string;
}

/**
 * トップページ HTML から年度別ページの URL と対応する年を抽出する（純粋関数）。
 *
 * トップページには「令和7年」等のリンクが掲載されている。
 */
export function parseTopPage(
  html: string,
): { url: string; year: number }[] {
  const results: { url: string; year: number }[] = [];

  // 年度別ページへのリンクを抽出
  const linkPattern = /<a[^>]+href="([^"]+\.html)"[^>]*>([^<]*(?:令和|平成)[^<]*)<\/a>/gi;

  for (const match of html.matchAll(linkPattern)) {
    const href = match[1]!;
    const linkText = match[2]!.trim();

    const year = parseEraYear(linkText);
    if (!year) continue;

    const url = href.startsWith("http")
      ? href
      : `${BASE_ORIGIN}${href.startsWith("/") ? "" : "/"}${href}`;

    // 重複チェック
    if (results.some((r) => r.url === url)) continue;

    results.push({ url, year });
  }

  return results;
}

/**
 * 年度別ページ HTML から会期別ページの URL とセッション名を抽出する（純粋関数）。
 *
 * 会期別ページは `/soshiki/` 配下にある。
 */
export function parseYearPage(
  html: string,
): { url: string; sessionName: string }[] {
  const results: { url: string; sessionName: string }[] = [];

  const linkPattern = /<a[^>]+href="([^"]+\.html)"[^>]*>([^<]+)<\/a>/gi;

  for (const match of html.matchAll(linkPattern)) {
    const href = match[1]!;
    const linkText = match[2]!.trim();

    // 会期別ページのみ（会議録を含むテキスト）
    if (!linkText.includes("会議録") && !linkText.includes("定例会") && !linkText.includes("臨時会")) continue;

    const url = href.startsWith("http")
      ? href
      : `${BASE_ORIGIN}${href.startsWith("/") ? "" : "/"}${href}`;

    // 会期別ページは soshiki 配下にある（トップページへのリンクを除外）
    if (!url.includes("/soshiki/")) continue;

    // 重複チェック
    if (results.some((r) => r.url === url)) continue;

    results.push({ url, sessionName: linkText });
  }

  return results;
}

/**
 * 会期別ページ HTML から PDF URL を抽出する（純粋関数）。
 *
 * PDF は `material/files/group/19/` ディレクトリに集約されている。
 */
export function parseSessionPage(
  html: string,
  sessionName: string,
): NagaiMeeting[] {
  const results: NagaiMeeting[] = [];

  const pdfLinkPattern = /<a[^>]+href="([^"]*material\/files\/group\/19\/[^"]+\.pdf)"[^>]*>/gi;

  for (const match of html.matchAll(pdfLinkPattern)) {
    const href = match[1]!;

    const url = href.startsWith("http")
      ? href
      : `${BASE_ORIGIN}${href.startsWith("/") ? "" : "/"}${href}`;

    // 重複チェック
    if (results.some((r) => r.pdfUrl === url)) continue;

    const filename = url.split("/").pop() ?? "";
    const heldOn = parseDateFromFilename(filename);
    if (!heldOn) continue;

    results.push({
      pdfUrl: url,
      title: sessionName,
      heldOn,
      sessionName,
    });
  }

  return results;
}

/**
 * 指定年の全会議録 PDF 一覧を取得する。
 */
export async function fetchDocumentList(
  year: number,
): Promise<NagaiMeeting[]> {
  const indexUrl = `${BASE_ORIGIN}${INDEX_PATH}`;
  const indexHtml = await fetchPage(indexUrl);
  if (!indexHtml) return [];

  const yearPages = parseTopPage(indexHtml);
  const targetYearPage = yearPages.find((p) => p.year === year);
  if (!targetYearPage) return [];

  const yearHtml = await fetchPage(targetYearPage.url);
  if (!yearHtml) return [];

  const sessionPages = parseYearPage(yearHtml);
  const results: NagaiMeeting[] = [];

  for (const { url, sessionName } of sessionPages) {
    const sessionHtml = await fetchPage(url);
    if (!sessionHtml) continue;

    const meetings = parseSessionPage(sessionHtml, sessionName);
    for (const m of meetings) {
      if (!results.some((r) => r.pdfUrl === m.pdfUrl)) {
        results.push(m);
      }
    }
  }

  return results;
}
