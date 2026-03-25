/**
 * 山形村議会（長野県） -- list フェーズ
 *
 * 会議録一覧ページから年度別ページ URL を収集し、
 * 各年度ページから本文 PDF リンクを収集する。
 *
 * URL 構造:
 *   一覧: https://www.vill.yamagata.nagano.jp/government/diet/minutes/
 *   年度別: https://www.vill.yamagata.nagano.jp/docs/{ID}.html
 *   PDF（近年）: /fs/{数字スラッシュ区切り}/_/{日本語ファイル名}.pdf
 *   PDF（過去）: /fs/{数字スラッシュ区切り}/_/{ローマ字ファイル名}.pdf
 *
 * 除外対象:
 *   - 目次 PDF: ファイル名に "目次" / "mokuji" を含む
 *   - 一般質問総括表 PDF: ファイル名に "一般質問総括表" / "ippansitumon" / "soukatuhyo" を含む
 */

import { BASE_ORIGIN, LIST_URL, detectMeetingType, fetchPage, parseWarekiYear } from "./shared";

export interface YamagataNaganoPdfRecord {
  /** 会議タイトル（例: "令和6年山形村議会第1回定例会（第1号）"） */
  title: string;
  /** PDF の絶対 URL */
  pdfUrl: string;
  /** 会議種別 */
  meetingType: string;
  /** 西暦年 */
  year: number;
}

/**
 * 一覧ページ HTML から年度別ページへのリンクを抽出する。
 *
 * 例: <a href="/docs/289719.html">議会議事録（令和6年）</a>
 */
export function parseYearPageLinks(html: string): Array<{ url: string; yearText: string }> {
  const results: Array<{ url: string; yearText: string }> = [];

  const linkRegex = /<a\s[^>]*href="(\/docs\/\d+\.html)"[^>]*>([\s\S]*?)<\/a>/gi;
  for (const match of html.matchAll(linkRegex)) {
    const href = match[1]!;
    const rawText = match[2]!.replace(/<[^>]+>/g, "").trim();
    results.push({
      url: `${BASE_ORIGIN}${href}`,
      yearText: rawText,
    });
  }

  return results;
}

/**
 * PDF の URL が除外対象（目次・一般質問総括表）かどうか判定する。
 */
function isExcludedPdf(url: string): boolean {
  return (
    url.includes("mokuji") ||
    url.includes("目次") ||
    url.includes("ippansitumon") ||
    url.includes("一般質問総括表") ||
    url.includes("soukatuhyo")
  );
}

/**
 * 年度別ページ HTML から本文 PDF リンクを抽出する。
 *
 * .pdf で終わるリンクを収集し、目次・一般質問総括表を除外する。
 * リンクテキスト（ファイル名に相当）を title として使用する。
 */
export function parseYearPagePdfs(
  html: string,
  year: number,
): YamagataNaganoPdfRecord[] {
  const records: YamagataNaganoPdfRecord[] = [];
  const seen = new Set<string>();

  const pdfLinkRegex = /<a\s[^>]*href="([^"]*\.pdf)"[^>]*>([\s\S]*?)<\/a>/gi;
  for (const match of html.matchAll(pdfLinkRegex)) {
    const href = match[1]!;
    const rawText = match[2]!
      .replace(/<[^>]+>/g, "")
      .replace(/\s+/g, " ")
      .trim()
      // ファイルサイズ表記を除去（例: " (PDF 232KB)"）
      .replace(/\s*\(PDF[^)]*\)\s*$/, "")
      .trim();

    const pdfUrl = href.startsWith("http")
      ? href
      : `${BASE_ORIGIN}${href}`;

    if (isExcludedPdf(pdfUrl) || isExcludedPdf(rawText)) continue;
    if (seen.has(pdfUrl)) continue;
    seen.add(pdfUrl);

    const title = rawText || `${year}年会議録`;
    records.push({
      title,
      pdfUrl,
      meetingType: detectMeetingType(title),
      year,
    });
  }

  return records;
}

/**
 * 年度別ページリンクのテキストから西暦年を取得する。
 *
 * 例: "議会議事録（令和6年）" → 2024
 * 例: "議会議事録（平成31年,令和元年）" → 2019 (令和元年)
 */
function extractYearFromLinkText(text: string): number | null {
  // 「平成31年,令和元年」のような複合表記は令和元年を優先
  const reiwa = text.match(/令和(元|\d+)年/);
  if (reiwa?.[1]) {
    const n = reiwa[1] === "元" ? 1 : parseInt(reiwa[1], 10);
    return 2018 + n;
  }

  return parseWarekiYear(text);
}

/**
 * 一覧ページを取得し、指定年の PDF レコード一覧を返す。
 */
export async function fetchPdfList(year: number): Promise<YamagataNaganoPdfRecord[]> {
  const listHtml = await fetchPage(LIST_URL);
  if (!listHtml) return [];

  const yearPageLinks = parseYearPageLinks(listHtml);

  const matchingLinks = yearPageLinks.filter((link) => {
    const y = extractYearFromLinkText(link.yearText);
    return y === year;
  });

  const allRecords: YamagataNaganoPdfRecord[] = [];
  for (const link of matchingLinks) {
    const yearHtml = await fetchPage(link.url);
    if (!yearHtml) continue;
    const records = parseYearPagePdfs(yearHtml, year);
    allRecords.push(...records);
  }

  return allRecords;
}
