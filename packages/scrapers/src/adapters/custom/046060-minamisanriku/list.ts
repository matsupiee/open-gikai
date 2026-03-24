/**
 * 南三陸町議会 — list フェーズ
 *
 * 会議録一覧ページから年度別ページの URL を収集し、
 * 各年度別ページから PDF リンクを収集する。
 *
 * HTML 構造:
 * - 一覧ページ: <ul><li><a href="..."> で年度別ページへのリンク
 * - 年度別ページ: <h2> で会議種別ごとにグループ化、<a href="*.pdf"> で PDF リンク
 * - PDF リンクのアンカーテキストに開催日が含まれる
 *   例: "令和6年度12月会議会議録（1日目 12月3日開催） (PDFファイル: 633.8KB)"
 */

import {
  BASE_ORIGIN,
  LIST_PATH,
  detectMeetingType,
  fetchPage,
  toHankaku,
} from "./shared";

export interface MinamisanrikuMeeting {
  /** PDF の絶対 URL */
  pdfUrl: string;
  /** 会議タイトル（例: "令和6年度12月会議会議録（1日目 12月3日開催）"） */
  title: string;
  /** 開催日 YYYY-MM-DD（解析できない場合は null） */
  heldOn: string | null;
  /** 会議種別 */
  meetingType: "plenary" | "extraordinary" | "committee";
}

/**
 * 会議録一覧ページ HTML から、指定年に対応する年度別ページの URL を抽出する（純粋関数）。
 *
 * 年度ページのリンクアンカーテキストから年を判定する:
 * - "令和6年度" → 2024年度（会計年度なので year=2024）
 * - "令和2年" → 2020年
 * - "令和元年" → 2019年
 *
 * 対象 year の会議録が含まれる可能性のある年度ページを返す。
 * 年度は当年4月〜翌年3月のため、year=2024 なら令和6年度ページを対象とする。
 */
export function parseIndexPage(
  html: string,
  targetYear: number
): string[] {
  const urls: string[] = [];

  // <a href="..."> リンクを全て抽出
  const linkRegex = /<a\s[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/gi;

  for (const match of html.matchAll(linkRegex)) {
    const href = match[1]!.trim();
    const text = match[2]!.replace(/<[^>]+>/g, "").trim();

    // /gikai/minutes/ 配下へのリンクのみ対象
    if (!href.includes("/gikai/minutes/")) continue;
    // 一覧ページ自体を除外
    if (href.endsWith("/gikai/minutes/index.html") || href.endsWith("/gikai/minutes/")) continue;

    // アンカーテキストから年を抽出
    const year = extractYearFromLinkText(text);
    if (year === null) continue;

    // 年度制（4月〜翌3月）で対象年を含むページを収集する
    // 例: year=2024 → 令和6年度（2024/4〜2025/3）を含む年度ページが対象
    // また year=2025 → 令和7年度（2025/4〜2026/3）も対象
    // 簡易的に: ページの年 == targetYear or ページの年 == targetYear - 1 を許容
    if (year === targetYear || year === targetYear - 1) {
      const absoluteUrl = href.startsWith("http")
        ? href
        : href.startsWith("//")
        ? `https:${href}`
        : `${BASE_ORIGIN}${href}`;
      if (!urls.includes(absoluteUrl)) {
        urls.push(absoluteUrl);
      }
    }
  }

  return urls;
}

/**
 * リンクテキストから西暦年を抽出する。
 * "令和6年度" → 2024
 * "令和2年" → 2020
 * "令和元年" → 2019
 * "平成30年以前" → 2018 (最大値)
 */
function extractYearFromLinkText(text: string): number | null {
  const normalized = toHankaku(text);

  const reiwa = normalized.match(/令和(元|\d+)年/);
  if (reiwa?.[1]) {
    const n = reiwa[1] === "元" ? 1 : parseInt(reiwa[1], 10);
    return 2018 + n;
  }

  const heisei = normalized.match(/平成(元|\d+)年/);
  if (heisei?.[1]) {
    const n = heisei[1] === "元" ? 1 : parseInt(heisei[1], 10);
    return 1988 + n;
  }

  return null;
}

/**
 * 年度別ページ HTML から PDF リンク情報を抽出する（純粋関数）。
 *
 * アルゴリズム:
 * 1. <h2> タグでブロックを区切り、会議種別を把握する
 * 2. 各ブロック内の <a href="*.pdf"> を収集する
 * 3. アンカーテキストから開催日を抽出する
 */
export function parseYearPage(
  html: string,
  targetYear: number
): MinamisanrikuMeeting[] {
  const results: MinamisanrikuMeeting[] = [];

  // <h2> でブロック分割
  const blockRegex = /<h2[^>]*>([\s\S]*?)<\/h2>([\s\S]*?)(?=<h2|$)/gi;

  for (const blockMatch of html.matchAll(blockRegex)) {
    const h2Text = blockMatch[1]!.replace(/<[^>]+>/g, "").trim();
    const blockContent = blockMatch[2]!;

    // PDF リンクを抽出
    const pdfLinkRegex =
      /<a\s[^>]*href="([^"]*\.pdf)"[^>]*>([\s\S]*?)<\/a>/gi;

    for (const linkMatch of blockContent.matchAll(pdfLinkRegex)) {
      const href = linkMatch[1]!.trim();
      const rawText = linkMatch[2]!.replace(/<[^>]+>/g, "").trim();

      // タイトルをクリーンアップ（ファイルサイズ情報を除去）
      const title = rawText.replace(/\s*\(PDFファイル[^)]*\)/g, "").trim();

      // 開催日を抽出
      const heldOn = extractDateFromTitle(title, targetYear);

      // 対象年に含まれない可能性があれば heldOn チェックで絞り込む
      // heldOn が null の場合も含める（PDF 本文から後で抽出）
      const absoluteUrl = href.startsWith("http")
        ? href
        : href.startsWith("//")
        ? `https:${href}`
        : `${BASE_ORIGIN}${href}`;

      results.push({
        pdfUrl: absoluteUrl,
        title: title || h2Text,
        heldOn,
        meetingType: detectMeetingType(h2Text || title),
      });
    }
  }

  return results;
}

/**
 * PDF リンクのタイトルテキストから開催日を抽出する。
 *
 * パターン例:
 * "令和6年度12月会議会議録（1日目 12月3日開催）" → 2024-12-03
 * "令和6年度1月会議会議録（1月30日開催）" → 2025-01-30
 * "令和5年度決算審査特別委員会会議の記録（1日目 9月9日）" → 2023-09-09
 *
 * 年度は4月〜翌3月のため、1〜3月は翌年扱いにする。
 */
export function extractDateFromTitle(
  title: string,
  fiscalYear: number
): string | null {
  const normalized = toHankaku(title);

  // まず完全な日付パターン（令和X年X月X日）を試みる
  const fullDateMatch = normalized.match(/(令和|平成)(元|\d+)年(\d{1,2})月(\d{1,2})日/);
  if (fullDateMatch) {
    const era = fullDateMatch[1]!;
    const n = fullDateMatch[2] === "元" ? 1 : parseInt(fullDateMatch[2]!, 10);
    const year = era === "令和" ? 2018 + n : 1988 + n;
    const month = parseInt(fullDateMatch[3]!, 10);
    const day = parseInt(fullDateMatch[4]!, 10);
    return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
  }

  // 月日のみパターン（例: "12月3日開催", "9月9日"）
  const monthDayMatch = normalized.match(/(\d{1,2})月(\d{1,2})日/);
  if (monthDayMatch?.[1] && monthDayMatch[2]) {
    const month = parseInt(monthDayMatch[1], 10);
    const day = parseInt(monthDayMatch[2], 10);

    // 年度の概念: 4月〜3月
    // fiscalYear は年度の開始年（例: 2024年度 = 2024）
    // 1〜3月は年度+1の暦年
    const calYear = month >= 4 ? fiscalYear : fiscalYear + 1;

    return `${calYear}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
  }

  return null;
}

/**
 * 会議録一覧ページから対象年度の全 PDF 情報を取得する。
 */
export async function fetchDocumentList(
  year: number
): Promise<MinamisanrikuMeeting[]> {
  const indexUrl = `${BASE_ORIGIN}${LIST_PATH}`;
  const indexHtml = await fetchPage(indexUrl);
  if (!indexHtml) return [];

  const yearPageUrls = parseIndexPage(indexHtml, year);
  if (yearPageUrls.length === 0) return [];

  const allMeetings: MinamisanrikuMeeting[] = [];

  for (const pageUrl of yearPageUrls) {
    const pageHtml = await fetchPage(pageUrl);
    if (!pageHtml) continue;

    // ページ URL から年度を推測する（より正確な年度計算のため）
    // 例: /gikai/minutes/810.html → 令和6年度 → fiscalYear=2024
    // リンクテキストから取得できないため、targetYear を使う
    const meetings = parseYearPage(pageHtml, year);

    // 対象年の会議録のみフィルタリング
    for (const meeting of meetings) {
      if (!meeting.heldOn) {
        // heldOn が取れない場合はとりあえず含める（detail で判定）
        allMeetings.push(meeting);
        continue;
      }
      const meetingYear = parseInt(meeting.heldOn.slice(0, 4), 10);
      if (meetingYear === year) {
        allMeetings.push(meeting);
      }
    }
  }

  return allMeetings;
}
