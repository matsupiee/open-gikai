/**
 * 芸西村議会 — list フェーズ
 *
 * 年度別ページから PDF リンクとメタ情報を抽出する。
 *
 * ページ構造:
 * - h6.cs_komidasi: 会議区分（例: 【第１回　定例会】）
 * - p.cs_dantext: 開催期間（例: 令和４年３月４日（金）～３月10日（木））
 * - div.cs_file > a: PDF リンク
 */

import { BASE_ORIGIN, buildYearPageUrl, fetchPage } from "./shared";

export interface GeiseiMeeting {
  pdfUrl: string;
  title: string;
  heldOn: string;
  section: string;
}

/**
 * 和暦の日付テキストから YYYY-MM-DD を返す。
 * e.g., "令和4年3月4日" → "2022-03-04"
 *
 * PDF リンクテキストのパターンにも対応:
 * e.g., "R4.3.4会議録" → "2022-03-04"
 * e.g., "Ｒ4.3.4会議録" → "2022-03-04"
 */
export function parseDateText(text: string): string | null {
  // 和暦パターン: 令和X年X月X日 or 平成X年X月X日
  const eraMatch = text.match(/(令和|平成)(元|\d+)年(\d+)月(\d+)日/);
  if (eraMatch) {
    const [, era, eraYearStr, monthStr, dayStr] = eraMatch;
    const eraYear = eraYearStr === "元" ? 1 : parseInt(eraYearStr!, 10);
    const month = parseInt(monthStr!, 10);
    const day = parseInt(dayStr!, 10);

    let westernYear: number;
    if (era === "令和") westernYear = eraYear + 2018;
    else if (era === "平成") westernYear = eraYear + 1988;
    else return null;

    return `${westernYear}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
  }

  // PDF リンクテキストパターン: R4.3.4 or Ｒ4.3.4
  const pdfMatch = text.match(/[RＲ](\d+)[.．](\d+)[.．](\d+)/);
  if (pdfMatch) {
    const eraYear = parseInt(pdfMatch[1]!, 10);
    const month = parseInt(pdfMatch[2]!, 10);
    const day = parseInt(pdfMatch[3]!, 10);
    const westernYear = eraYear + 2018; // 令和ベース

    return `${westernYear}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
  }

  return null;
}

/**
 * 年度別ページの HTML から PDF リンクとメタ情報を抽出する（テスト可能な純粋関数）。
 *
 * 構造:
 * - h6 class="cs_komidasi": 会議区分ヘッダー（例: 【第１回　定例会】）
 * - div class="cs_file" 内の a[href$=".pdf"]: PDF リンク
 *
 * フィルタリング:
 * - 「表紙」「目次」「通告」を含むリンクを除外
 * - 日付が取れないリンクを除外
 */
export function parseYearPage(
  html: string,
  pageUrl: string
): GeiseiMeeting[] {
  const results: GeiseiMeeting[] = [];

  // セクション見出しの位置を収集
  const sections: { index: number; name: string }[] = [];
  const sectionPattern =
    /<h6[^>]*class="cs_komidasi"[^>]*>([\s\S]*?)<\/h6>/gi;
  for (const match of html.matchAll(sectionPattern)) {
    const text = match[1]!.replace(/<[^>]+>/g, "").trim();
    const nameMatch = text.match(/【(.+?)】/);
    if (nameMatch) {
      sections.push({
        index: match.index!,
        name: nameMatch[1]!.replace(/[\s　]+/g, " ").trim(),
      });
    }
  }

  // PDF リンクを抽出
  // div.cs_file 内の a タグで href が .pdf で終わるもの
  const linkPattern =
    /<div[^>]*class="cs_file"[^>]*>[\s\S]*?<a[^>]+href="([^"]+\.[pP][dD][fF])"[^>]*>([\s\S]*?)<\/a>/gi;

  for (const match of html.matchAll(linkPattern)) {
    const linkIndex = match.index!;
    const href = match[1]!;
    const linkText = match[2]!.replace(/<[^>]+>/g, "").trim();

    // 表紙・目次・通告を除外
    if (
      linkText.includes("表紙") ||
      linkText.includes("目次") ||
      linkText.includes("通告")
    ) {
      continue;
    }

    // 「会議録」を含むこと
    if (!linkText.includes("会議録") && !linkText.includes("会 議 録")) {
      continue;
    }

    // 日付を抽出（リンクテキストから）
    const heldOn = parseDateText(linkText);
    if (!heldOn) continue;

    // PDF URL を構築
    let pdfUrl: string;
    if (href.startsWith("http")) {
      pdfUrl = href;
    } else if (href.startsWith("/")) {
      pdfUrl = `${BASE_ORIGIN}${href}`;
    } else if (href.startsWith("../")) {
      pdfUrl = `${BASE_ORIGIN}/${href.replace(/^(\.\.\/)+/, "")}`;
    } else {
      const base = pageUrl.replace(/\/[^/]+$/, "/");
      pdfUrl = base + href;
    }

    // 所属セクションを特定
    let currentSection = "";
    for (const section of sections) {
      if (section.index < linkIndex) {
        currentSection = section.name;
      }
    }

    // 一般質問かどうかを判定
    const isIppanShitsumon =
      linkText.includes("一般質問") || linkText.includes("一 般 質 問");

    // タイトルを構築
    const cleanLabel = linkText.replace(/\s+/g, " ").trim();
    const title = currentSection
      ? isIppanShitsumon
        ? `${currentSection} 一般質問`
        : `${currentSection} ${cleanLabel}`
      : cleanLabel;

    results.push({ pdfUrl, title, heldOn, section: currentSection });
  }

  return results;
}

/**
 * 指定年の全 PDF リンクを取得する。
 */
export async function fetchMeetingList(
  year: number
): Promise<GeiseiMeeting[]> {
  const yearPageUrl = buildYearPageUrl(year);
  if (!yearPageUrl) return [];

  const html = await fetchPage(yearPageUrl);
  if (!html) return [];

  return parseYearPage(html, yearPageUrl);
}
