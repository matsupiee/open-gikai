/**
 * 北広島町議会 — list フェーズ
 *
 * トップページ・バックナンバーページから全年度の会議録詳細ページ URL を収集し、
 * 各詳細ページに含まれる PDF リンクのメタ情報を返す。
 */

import {
  BASE_ORIGIN,
  TOP_PAGE_URL,
  BACKNUM_PAGE_URL,
  fetchPage,
  parseJapaneseDate,
  detectMeetingType,
  extractSessionLabel,
} from "./shared";

export interface KitahiroshimaPdfItem {
  /** PDF の URL（絶対） */
  pdfUrl: string;
  /** 開催日 YYYY-MM-DD */
  heldOn: string;
  /** 会議種別: "plenary" | "extraordinary" */
  meetingType: string;
  /** セクション見出しからの会議ラベル（例: "第1回定例会"） */
  sessionLabel: string;
  /** 会議録詳細ページの URL */
  detailPageUrl: string;
  /** 年度（西暦） */
  year: number;
}

/**
 * トップページ HTML から年度別一覧ページへのリンク（list98-{ID}.html）を抽出する。
 * バックナンバーページへのリンク（list98-325.html）も含む。
 */
export function parseTopPage(html: string): string[] {
  const urls: string[] = [];
  // list98-{数字}.html パターン
  const re = /\/site\/gikai\/(list98-\d+\.html)/g;
  for (const match of html.matchAll(re)) {
    const path = `/site/gikai/${match[1]}`;
    const url = `${BASE_ORIGIN}${path}`;
    if (!urls.includes(url)) {
      urls.push(url);
    }
  }
  return urls;
}

/**
 * 年度別一覧ページ HTML から会議録詳細ページへのリンク（数字.html）を抽出する。
 * list98-{ID}.html ではなく、{数字}.html 形式のリンクを対象とする。
 */
export function parseYearIndexPage(html: string): string[] {
  const urls: string[] = [];
  // /site/gikai/{数字}.html パターン（list98 を除く）
  const re = /href=["']\/site\/gikai\/(\d+\.html)["']/g;
  for (const match of html.matchAll(re)) {
    const url = `${BASE_ORIGIN}/site/gikai/${match[1]}`;
    if (!urls.includes(url)) {
      urls.push(url);
    }
  }
  return urls;
}

/**
 * 会議録詳細ページ HTML から PDF リンクのメタ情報を抽出する。
 *
 * ページ構造:
 *   <h2>令和6年第1回臨時会</h2>
 *   <ul>
 *     <li><a href="/uploaded/attachment/22457.pdf">令和6年1月30日　会議録 [PDFファイル／179KB]</a></li>
 *   </ul>
 */
export function parseDetailPage(
  html: string,
  detailPageUrl: string,
): KitahiroshimaPdfItem[] {
  const items: KitahiroshimaPdfItem[] = [];

  // h2 見出しと PDF リンクを順番に処理するため、HTML を走査する
  // h2 タグと PDF リンクタグを抽出
  const tokenRe =
    /<h2[^>]*>([\s\S]*?)<\/h2>|<a\s+[^>]*href=["']([^"']*\.pdf)["'][^>]*>([\s\S]*?)<\/a>/gi;

  let currentSectionTitle = "";
  let currentMeetingType = "plenary";
  let currentSessionLabel = "";
  let currentYear = 0;

  for (const match of html.matchAll(tokenRe)) {
    if (match[1] !== undefined) {
      // h2 見出し
      const rawTitle = match[1]
        .replace(/<[^>]+>/g, "")
        .replace(/&nbsp;/g, " ")
        .trim();
      currentSectionTitle = rawTitle;
      currentMeetingType = detectMeetingType(rawTitle);
      currentSessionLabel = extractSessionLabel(rawTitle);

      // 年度を抽出（例: "令和6年第1回定例会" → 2024）
      const yearMatch = rawTitle.match(/(令和|平成)(\d+)年/);
      if (yearMatch) {
        const era = yearMatch[1]!;
        const n = parseInt(yearMatch[2]!, 10);
        currentYear =
          era === "令和" ? 2018 + n : era === "平成" ? 1988 + n : 0;
      }
    } else if (match[2] !== undefined) {
      // PDF リンク
      const rawHref = match[2];
      const rawLinkText = (match[3] ?? "").replace(/<[^>]+>/g, "").trim();

      // /uploaded/attachment/{数字}.pdf パターンのみ対象
      if (!/\/uploaded\/attachment\/\d+\.pdf/.test(rawHref)) continue;

      const pdfUrl = rawHref.startsWith("http")
        ? rawHref
        : `${BASE_ORIGIN}${rawHref}`;

      const heldOn = parseJapaneseDate(rawLinkText);
      if (!heldOn) continue;

      // 年度フィルタ用の年（heldOn の年）
      const heldYear = parseInt(heldOn.slice(0, 4), 10);
      const year = currentYear || heldYear;

      items.push({
        pdfUrl,
        heldOn,
        meetingType: currentMeetingType,
        sessionLabel: currentSessionLabel || currentSectionTitle,
        detailPageUrl,
        year,
      });
    }
  }

  return items;
}

/**
 * 指定年の PDF リンク一覧を取得する。
 *
 * 1. トップページ → 年度別一覧ページ URL を収集
 * 2. バックナンバーページ → 詳細ページ URL を収集
 * 3. 各詳細ページから PDF メタ情報を収集
 * 4. year でフィルタリング
 */
export async function fetchPdfList(year: number): Promise<KitahiroshimaPdfItem[]> {
  const allDetailPageUrls: string[] = [];

  // Step 1: トップページから年度別一覧ページ URL を収集
  const topHtml = await fetchPage(TOP_PAGE_URL);
  if (topHtml) {
    const yearIndexUrls = parseTopPage(topHtml);

    for (const yearIndexUrl of yearIndexUrls) {
      // バックナンバーページは別途処理
      if (yearIndexUrl.includes("list98-325")) continue;

      const yearIndexHtml = await fetchPage(yearIndexUrl);
      if (!yearIndexHtml) continue;

      const detailUrls = parseYearIndexPage(yearIndexHtml);
      for (const url of detailUrls) {
        if (!allDetailPageUrls.includes(url)) {
          allDetailPageUrls.push(url);
        }
      }
    }
  }

  // Step 2: バックナンバーページから詳細ページ URL を収集
  const backnumHtml = await fetchPage(BACKNUM_PAGE_URL);
  if (backnumHtml) {
    const detailUrls = parseYearIndexPage(backnumHtml);
    for (const url of detailUrls) {
      if (!allDetailPageUrls.includes(url)) {
        allDetailPageUrls.push(url);
      }
    }
  }

  // Step 3: 各詳細ページから PDF メタ情報を収集
  const allItems: KitahiroshimaPdfItem[] = [];

  for (const detailPageUrl of allDetailPageUrls) {
    const detailHtml = await fetchPage(detailPageUrl);
    if (!detailHtml) continue;

    const items = parseDetailPage(detailHtml, detailPageUrl);
    for (const item of items) {
      if (!allItems.some((i) => i.pdfUrl === item.pdfUrl)) {
        allItems.push(item);
      }
    }
  }

  // Step 4: 年でフィルタリング
  return allItems.filter((item) => item.year === year || parseInt(item.heldOn.slice(0, 4), 10) === year);
}
