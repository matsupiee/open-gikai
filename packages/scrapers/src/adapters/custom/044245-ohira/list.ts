/**
 * 大衡村議会 — list フェーズ
 *
 * 会議録一覧ページ（/6/4/3/1/index.html）から年度別ページURLを収集し、
 * 各年度ページから会議録 PDF リンクを収集する。
 *
 * HTML 構造:
 * - 会議録一覧ページに年度別リンク: /6/4/3/1/{ページID}.html
 * - 各年度ページに h3 見出しで定例会・臨時会ごとにセクション分け
 * - p.file-link-item > a.pdf でPDFリンクを取得
 *
 * リンクテキストのパターン:
 *   "本会議(令和6年12月23日) (PDFファイル: 413.7KB)" → 臨時会（日次なし）
 *   "本会議1日目(令和6年12月3日) (PDFファイル: 810.6KB)" → 定例会1日目
 *   "本会議2日目（令和6年12月5日） (PDFファイル: 593.3KB)" → 定例会2日目
 */

import { BASE_ORIGIN, LIST_PATH, detectMeetingType, fetchPage, parseWarekiDate } from "./shared";

export interface OhiraMeeting {
  /** PDF の絶対 URL */
  pdfUrl: string;
  /** 会議タイトル（例: "第4回定例会 本会議1日目(令和6年12月3日)"） */
  title: string;
  /** 開催日 YYYY-MM-DD（解析できない場合は null） */
  heldOn: string | null;
  /** 会議種別 */
  meetingType: "plenary" | "extraordinary" | "committee";
}

/**
 * 年度別ページの HTML から PDF 情報を抽出する（テスト可能な純粋関数）。
 *
 * アルゴリズム:
 * 1. h3 見出しから会議セクション（定例会・臨時会）を抽出
 * 2. 各セクション内の p.file-link-item > a.pdf からPDFリンクを収集
 * 3. リンクテキストから開催日を解析
 */
export function parseYearPage(html: string, targetYear: number): OhiraMeeting[] {
  const results: OhiraMeeting[] = [];

  // h3 見出しとそれに続くコンテンツをセクションとして処理
  // h3 タグの中身は <span class="bg"><span class="bg2"><span class="bg3">...</span></span></span> 形式
  const sectionRegex =
    /<h3[^>]*>([\s\S]*?)<\/h3>([\s\S]*?)(?=<h3|$)/gi;

  for (const sectionMatch of html.matchAll(sectionRegex)) {
    const h3Raw = sectionMatch[1]!;
    const sectionContent = sectionMatch[2]!;

    // h3 内部のテキストを取得（spanタグを除去）
    const sectionTitle = h3Raw.replace(/<[^>]+>/g, "").trim();
    if (!sectionTitle) continue;

    // 第X回(定例会|臨時会) パターンの確認
    const sessionMatch = sectionTitle.match(/第(\d+)回(定例会|臨時会)/);
    if (!sessionMatch) continue;

    const sessionNum = sessionMatch[1]!;
    const sessionType = sessionMatch[2]!;

    // p.file-link-item > a.pdf からPDFリンクを収集
    const linkRegex =
      /<p[^>]*class="[^"]*file-link-item[^"]*"[^>]*>[\s\S]*?<a[^>]*class="[^"]*pdf[^"]*"[^>]*href="([^"]*)"[^>]*>([\s\S]*?)<\/a>/gi;

    for (const linkMatch of sectionContent.matchAll(linkRegex)) {
      const rawHref = linkMatch[1]!.trim();
      const linkText = linkMatch[2]!
        .replace(/<[^>]+>/g, "")
        .trim();

      // リンクテキストから日次と開催日を抽出
      // パターン: "本会議(\d+日目)?[（(]((?:令和|平成)\d+年\d+月\d+日)[）)]"
      const linkPattern = /本会議(\d+日目)?[（(]((?:令和|平成)(?:元|\d+)年\d+月\d+日)[）)]/;
      const linkPatternMatch = linkText.match(linkPattern);

      let heldOn: string | null = null;
      let dayLabel = "";

      if (linkPatternMatch) {
        dayLabel = linkPatternMatch[1] ?? "";
        const dateStr = linkPatternMatch[2]!;
        heldOn = parseWarekiDate(dateStr);
      }

      // 年のフィルタリング: heldOn が取れている場合はその年で判定
      if (heldOn) {
        const heldYear = parseInt(heldOn.substring(0, 4), 10);
        if (heldYear !== targetYear) continue;
      } else {
        // heldOn が取れていない場合はスキップ
        continue;
      }

      // 絶対 URL に変換（// で始まる場合は https: を付ける）
      let pdfUrl: string;
      if (rawHref.startsWith("//")) {
        pdfUrl = `https:${rawHref}`;
      } else if (rawHref.startsWith("http")) {
        pdfUrl = rawHref;
      } else {
        pdfUrl = `${BASE_ORIGIN}${rawHref}`;
      }

      // タイトルを組み立てる
      const dayPart = dayLabel ? ` ${dayLabel}` : "";
      const title = `第${sessionNum}回${sessionType} 本会議${dayPart}(${heldOn})`;

      results.push({
        pdfUrl,
        title,
        heldOn,
        meetingType: detectMeetingType(sessionType),
      });
    }
  }

  return results;
}

/**
 * 会議録一覧ページの HTML から年度別ページの URL を抽出する（テスト可能な純粋関数）。
 *
 * 年度別ページURL パターン: /6/4/3/1/{ページID}.html
 * 一覧ページの <a href="/6/4/3/1/{ID}.html"> テキストから年度を判定する。
 */
export function parseIndexPage(html: string, targetYear: number): string[] {
  const results: string[] = [];

  // /6/4/3/1/{ID}.html パターンのリンクを収集
  const linkRegex =
    /<a[^>]*href="(\/6\/4\/3\/1\/\d+\.html)"[^>]*>([\s\S]*?)<\/a>/gi;

  for (const match of html.matchAll(linkRegex)) {
    const href = match[1]!;
    const linkText = match[2]!.replace(/<[^>]+>/g, "").trim();

    // リンクテキストから年度を判定
    // パターン例: "令和6年本会議" → 令和6年 → 2024年
    const yearMatch = linkText.match(/(令和|平成)(元|\d+)年/);
    if (!yearMatch) continue;

    const era = yearMatch[1]!;
    const eraYear = yearMatch[2] === "元" ? 1 : parseInt(yearMatch[2]!, 10);
    const year = era === "令和" ? 2018 + eraYear : 1988 + eraYear;

    if (year === targetYear) {
      results.push(`${BASE_ORIGIN}${href}`);
    }
  }

  return results;
}

/**
 * 指定年の全会議録 PDF 情報を取得する。
 */
export async function fetchMeetingList(year: number): Promise<OhiraMeeting[]> {
  const indexUrl = `${BASE_ORIGIN}${LIST_PATH}`;
  const indexHtml = await fetchPage(indexUrl);
  if (!indexHtml) return [];

  const yearPageUrls = parseIndexPage(indexHtml, year);
  if (yearPageUrls.length === 0) return [];

  const results: OhiraMeeting[] = [];

  for (const pageUrl of yearPageUrls) {
    const pageHtml = await fetchPage(pageUrl);
    if (!pageHtml) continue;

    const meetings = parseYearPage(pageHtml, year);
    results.push(...meetings);
  }

  return results;
}
