/**
 * 基山町議会 — list フェーズ
 *
 * 1. トップページ（/gikai/list01207.html）から年度別ページへのリンクを収集
 * 2. 各年度ページから kiji番号/index.html 形式のリンクを収集
 * 3. 各詳細ページ（kiji番号/index.html）からPDFリンクと会議情報を収集
 *
 * 各 <li> のテキストに含まれる日付（XX月XX日）と、
 * 「最終更新日」テキストから開催年を組み合わせて heldOn を生成する。
 * 「目次」「会期日程」などは除外して会議録本文のみを収集する。
 */

import {
  BASE_ORIGIN,
  TOP_PAGE_PATH,
  detectMeetingType,
  fetchPage,
  parseJapaneseYear,
  parseUpdatedDate,
  parseMonthDay,
} from "./shared";

export interface KiyamaPdfRecord {
  /** 会議タイトル（例: "会議録（令和6年第4回定例会） 12月3日 会期日程・提案理由説明等"） */
  title: string;
  /** 開催日 YYYY-MM-DD */
  heldOn: string;
  /** PDF の絶対 URL */
  pdfUrl: string;
  /** 会議種別 */
  meetingType: "plenary" | "extraordinary" | "committee";
  /** 詳細ページの絶対 URL */
  detailPageUrl: string;
}

export interface YearPageLink {
  /** 西暦年 */
  year: number;
  /** 絶対 URL */
  url: string;
}

/**
 * トップページの HTML から年度別ページへのリンクを抽出する。
 * href="list[番号].html" 形式のリンクのうち、リンクテキストに年度が含まれるものを対象とする。
 */
export function parseTopPageLinks(html: string): YearPageLink[] {
  const links: YearPageLink[] = [];
  const seen = new Set<string>();

  // list[番号].html 形式のリンクを全て抽出
  const pattern = /<a\s[^>]*href=["'](list\d+\.html)["'][^>]*>([\s\S]*?)<\/a>/gi;

  for (const m of html.matchAll(pattern)) {
    const listPath = m[1]!;
    const linkText = m[2]!
      .replace(/<[^>]+>/g, "")
      .replace(/&nbsp;/g, " ")
      .replace(/&amp;/g, "&")
      .trim();

    const url = `${BASE_ORIGIN}/gikai/${listPath}`;
    if (seen.has(url)) continue;

    const year = parseJapaneseYear(linkText);
    if (year === null) continue;

    seen.add(url);
    links.push({ year, url });
  }

  return links;
}

/**
 * 年度ページの HTML から kiji番号/index.html 形式のリンクを抽出する。
 * 相対パス "kiji[番号]/index.html" を絶対 URL に変換して返す。
 */
export function parseYearPageKijiLinks(html: string): string[] {
  const links: string[] = [];
  const seen = new Set<string>();

  const pattern = /href=["'](kiji\d+\/index\.html)["']/gi;

  for (const m of html.matchAll(pattern)) {
    const path = m[1]!;
    const url = `${BASE_ORIGIN}/gikai/${path}`;
    if (seen.has(url)) continue;
    seen.add(url);
    links.push(url);
  }

  return links;
}

/**
 * 詳細ページの HTML から会議情報と PDF レコードを抽出する。
 *
 * 抽出ロジック:
 * - h1 から会議名を取得（例: "会議録（令和6年第4回定例会）"）
 * - 最終更新日テキストから開催年を推定
 * - 各 li のテキストから日付（XX月XX日）を抽出して heldOn を生成
 * - 日付（XX月XX日）を持たない li（目次・会期日程など）はスキップ
 * - PDF URL の相対パスを絶対 URL に変換（詳細ページのベース URL 基準）
 */
export function parseDetailPage(
  html: string,
  detailPageUrl: string
): KiyamaPdfRecord[] {
  const records: KiyamaPdfRecord[] = [];

  // h1 から会議名を取得
  const h1Match = html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i);
  const meetingTitle = h1Match?.[1]
    ? h1Match[1].replace(/<[^>]+>/g, "").replace(/&nbsp;/g, " ").trim()
    : "";

  if (!meetingTitle) return records;

  // 最終更新日から年を取得
  const updatedDate = parseUpdatedDate(html);
  if (!updatedDate) return records;

  const updatedYear = parseInt(updatedDate.slice(0, 4), 10);
  const updatedMonth = parseInt(updatedDate.slice(5, 7), 10);

  // 詳細ページのベース URL（PDF相対パス解決用）
  const baseUrl = detailPageUrl.replace(/\/[^/]+$/, "/");

  // li 要素を処理
  const liRegex = /<li[^>]*>([\s\S]*?)<\/li>/gi;

  for (const liMatch of html.matchAll(liRegex)) {
    const liHtml = liMatch[1]!;

    // PDF リンクを探す
    const pdfMatch = liHtml.match(/<a\s[^>]*href=["']([^"']*\.pdf)["'][^>]*>/i);
    if (!pdfMatch) continue;

    const pdfPath = pdfMatch[1]!;
    const pdfUrl = pdfPath.startsWith("http")
      ? pdfPath
      : `${baseUrl}${pdfPath}`;

    // li のプレーンテキストを取得
    const liText = liHtml
      .replace(/<[^>]+>/g, "")
      .replace(/&nbsp;/g, " ")
      .replace(/&amp;/g, "&")
      .replace(/\s+/g, " ")
      .trim();

    // 日付を抽出（例: "12月3日 会期日程・提案理由説明等"）
    // 日付なし（目次・会期日程のみの行）は parseMonthDay が null を返すのでスキップ
    const monthDay = parseMonthDay(liText);
    if (!monthDay) continue;

    // 開催年を決定: 更新月より日付の月が大きい場合は前年
    // 例: 更新日=2025年3月 → 12月は前年(2024年)
    let sessionYear = updatedYear;
    if (monthDay.month > updatedMonth + 1) {
      sessionYear = updatedYear - 1;
    }

    const heldOn = `${sessionYear}-${String(monthDay.month).padStart(2, "0")}-${String(monthDay.day).padStart(2, "0")}`;

    const sessionLabel = `${monthDay.month}月${monthDay.day}日`;
    // li テキストから余分な空白を除去してサフィックスを付与
    const suffix = liText.replace(/^\d+月\d+日\s*/, "").trim();
    const fullTitle = suffix
      ? `${meetingTitle} ${sessionLabel} ${suffix}`
      : `${meetingTitle} ${sessionLabel}`;

    records.push({
      title: fullTitle,
      heldOn,
      pdfUrl,
      meetingType: detectMeetingType(meetingTitle),
      detailPageUrl,
    });
  }

  return records;
}

/**
 * 対象年の全 PDF レコードを収集する。
 *
 * 戦略:
 * 1. トップページから年度別ページ URL を収集
 * 2. 対象年度ページから kiji番号/index.html リンクを収集
 * 3. 各詳細ページから PDF レコードを抽出
 */
export async function fetchPdfList(
  _baseUrl: string,
  year: number
): Promise<KiyamaPdfRecord[]> {
  // Step 1: トップページから年度別ページ URL を取得
  const topUrl = `${BASE_ORIGIN}${TOP_PAGE_PATH}`;
  const topHtml = await fetchPage(topUrl);
  if (!topHtml) return [];

  const yearLinks = parseTopPageLinks(topHtml);

  // 対象年のページを特定
  const targetLink = yearLinks.find((l) => l.year === year);
  if (!targetLink) return [];

  // Step 2: 年度ページから kiji 番号リンクを収集
  const yearHtml = await fetchPage(targetLink.url);
  if (!yearHtml) return [];

  const kijiLinks = parseYearPageKijiLinks(yearHtml);
  if (kijiLinks.length === 0) return [];

  // Step 3: 各詳細ページから PDF レコードを収集
  const allRecords: KiyamaPdfRecord[] = [];

  for (const kijiUrl of kijiLinks) {
    const detailHtml = await fetchPage(kijiUrl);
    if (!detailHtml) continue;

    const records = parseDetailPage(detailHtml, kijiUrl);
    allRecords.push(...records);
  }

  return allRecords;
}
