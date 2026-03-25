/**
 * 西米良村議会 — list フェーズ
 *
 * 2段階のクロールで PDF リンクを収集する:
 * 1. カテゴリページ (category/c-00-admininfo/c-03/c-03-02) から各年度の記事ページ URL を収集
 * 2. 各年度ページから wp-content/uploads/ 配下の PDF リンクとメタ情報を抽出
 *
 * PDF ファイル名はランダムなハッシュ値のため、会議名・日付はリンクテキストから取得する。
 */

import {
  BASE_ORIGIN,
  CATEGORY_URL,
  KNOWN_ARTICLE_IDS,
  convertJapaneseEra,
  detectMeetingType,
  fetchPage,
} from "./shared";

export interface NishimeraMeeting {
  pdfUrl: string;
  /** リンクテキスト（例: "令和6年第1回定例会 1日目"） */
  linkText: string;
  /** 記事ページ URL（詳細の source URL として使用） */
  articleUrl: string;
  /** 開催年 */
  year: number;
  /** 会議タイプ */
  meetingType: "plenary" | "extraordinary" | "committee";
}

/**
 * カテゴリページの HTML から年度別記事ページへのリンクを抽出する（テスト可能な純粋関数）。
 *
 * WordPress のカテゴリアーカイブ構造:
 *   <a href=".../c-03-02/{記事ID}">...</a>
 */
export function parseCategoryPage(
  html: string,
): { articleId: string; url: string }[] {
  const results: { articleId: string; url: string }[] = [];
  const seen = new Set<string>();

  // c-00-admininfo/c-03/c-03-02/{記事ID} パターンのリンクを抽出
  const linkRegex =
    /<a[^>]+href="([^"]*c-00-admininfo\/c-03\/c-03-02\/(\d+)[^"]*)"[^>]*>/gi;

  for (const match of html.matchAll(linkRegex)) {
    const href = match[1]!;
    const articleId = match[2]!;

    if (seen.has(articleId)) continue;
    seen.add(articleId);

    const url = href.startsWith("http")
      ? href
      : `${BASE_ORIGIN}${href.startsWith("/") ? "" : "/"}${href}`;

    results.push({ articleId, url });
  }

  return results;
}

/**
 * 年度ページの HTML から PDF リンクとメタ情報を抽出する（テスト可能な純粋関数）。
 *
 * 対象: href に wp-content/uploads/ を含む .pdf リンク
 * 会議情報はリンクテキストから取得する。
 */
export function parseArticlePage(
  html: string,
  articleUrl: string,
  year: number,
): NishimeraMeeting[] {
  const results: NishimeraMeeting[] = [];
  const seen = new Set<string>();

  // <a href="...wp-content/uploads/...pdf">リンクテキスト</a> を抽出
  const linkRegex =
    /<a[^>]+href="([^"]*wp-content\/uploads\/[^"]+\.pdf)"[^>]*>([\s\S]*?)<\/a>/gi;

  for (const match of html.matchAll(linkRegex)) {
    const href = match[1]!;
    const rawText = match[2]!.replace(/<[^>]+>/g, "").trim();

    if (!rawText) continue;
    if (seen.has(href)) continue;
    seen.add(href);

    const pdfUrl = href.startsWith("http")
      ? href
      : `${BASE_ORIGIN}${href.startsWith("/") ? "" : "/"}${href}`;

    const meetingType = detectMeetingType(rawText);

    results.push({
      pdfUrl,
      linkText: rawText,
      articleUrl,
      year,
      meetingType,
    });
  }

  return results;
}

/**
 * リンクテキストまたはページコンテキストから開催日を抽出する。
 *
 * 対応パターン:
 *   "令和6年第1回定例会（3月4日）" → "2024-03-04"
 *   "令和6年第1回定例会 3月4日" → "2024-03-04"
 *   "3月定例会" → null（月のみ）
 */
export function parseHeldOnFromText(
  text: string,
  year: number,
): string | null {
  // 全角数字を半角に変換
  const normalized = text.replace(/[０-９]/g, (c) =>
    String.fromCharCode(c.charCodeAt(0) - 0xfee0),
  );

  // 「令和/平成N年N月N日」パターン
  const fullDateMatch = normalized.match(
    /(令和|平成|昭和)(元|\d+)年(\d+)月(\d+)日/,
  );
  if (fullDateMatch) {
    const convertedYear = convertJapaneseEra(fullDateMatch[1]!, fullDateMatch[2]!);
    if (!convertedYear) return null;
    const month = parseInt(fullDateMatch[3]!, 10);
    const day = parseInt(fullDateMatch[4]!, 10);
    return `${convertedYear}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
  }

  // 「N月N日」パターン（年は context から）
  const monthDayMatch = normalized.match(/(\d+)月(\d+)日/);
  if (monthDayMatch) {
    const month = parseInt(monthDayMatch[1]!, 10);
    const day = parseInt(monthDayMatch[2]!, 10);
    if (month >= 1 && month <= 12 && day >= 1 && day <= 31) {
      return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    }
  }

  return null;
}

/**
 * リンクテキストから回次を抽出する。
 * e.g., "令和6年第1回定例会" → "第1回"
 */
export function parseSessionNumber(text: string): string | null {
  // 全角数字を半角に変換
  const normalized = text.replace(/[０-９]/g, (c) =>
    String.fromCharCode(c.charCodeAt(0) - 0xfee0),
  );

  const match = normalized.match(/第(\d+)回/);
  if (match) return `第${match[1]}回`;
  return null;
}

/**
 * カテゴリページを解析して指定年の記事ページ URL を取得する。
 * カテゴリページのリンクから年を推測できない場合は KNOWN_ARTICLE_IDS を使用する。
 */
export async function fetchArticleUrlsForYear(
  year: number,
): Promise<string[]> {
  const html = await fetchPage(CATEGORY_URL);

  if (html) {
    const articleLinks = parseCategoryPage(html);

    // カテゴリページから取得した記事 ID と KNOWN_ARTICLE_IDS を照合
    const knownForYear = KNOWN_ARTICLE_IDS.filter((k) => k.year === year);
    const urlsFromCategory: string[] = [];

    for (const known of knownForYear) {
      const found = articleLinks.find((l) => l.articleId === known.articleId);
      if (found) {
        urlsFromCategory.push(found.url);
      } else {
        // カテゴリページにない場合は固定 URL を構築
        urlsFromCategory.push(
          `${BASE_ORIGIN}/village/c-00-admininfo/c-03/c-03-02/${known.articleId}`,
        );
      }
    }

    if (urlsFromCategory.length > 0) {
      return urlsFromCategory;
    }
  }

  // フォールバック: KNOWN_ARTICLE_IDS から URL を構築
  return KNOWN_ARTICLE_IDS.filter((k) => k.year === year).map(
    (k) =>
      `${BASE_ORIGIN}/village/c-00-admininfo/c-03/c-03-02/${k.articleId}`,
  );
}

/**
 * 指定年の会議録 PDF リンク一覧を取得する。
 */
export async function fetchMeetingList(
  year: number,
): Promise<NishimeraMeeting[]> {
  const articleUrls = await fetchArticleUrlsForYear(year);
  const meetings: NishimeraMeeting[] = [];
  const seenUrls = new Set<string>();

  for (const articleUrl of articleUrls) {
    const html = await fetchPage(articleUrl);
    if (!html) continue;

    const pageMeetings = parseArticlePage(html, articleUrl, year);
    for (const meeting of pageMeetings) {
      if (!seenUrls.has(meeting.pdfUrl)) {
        seenUrls.add(meeting.pdfUrl);
        meetings.push(meeting);
      }
    }
  }

  return meetings;
}
