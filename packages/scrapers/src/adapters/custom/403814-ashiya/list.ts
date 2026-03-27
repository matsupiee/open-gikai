/**
 * 芦屋町議会 — list フェーズ
 *
 * 3段階クロール:
 * 1. 会議録トップページから「会議録」「一般質問」の一覧ページを取得
 * 2. 各一覧ページから対象年の記事ページリンクを取得
 * 3. 記事ページから PDF 添付リンクを抽出
 */

import {
  BASE_ORIGIN,
  delay,
  detectMeetingType,
  fetchPage,
  parseJapaneseDate,
  parseWarekiYear,
} from "./shared";

const INTER_PAGE_DELAY_MS = 1_500;

export interface CategoryLink {
  title: string;
  url: string;
}

export interface ArticleLink {
  title: string;
  pageUrl: string;
  meetingType: string;
}

export interface AshiyaPdfRecord {
  title: string;
  pdfUrl: string;
  heldOn: string | null;
  meetingType: string;
}

/**
 * トップページからカテゴリ一覧ページを抽出する。
 * 例: 「会議録」「一般質問」
 */
export function parseCategoryLinks(html: string): CategoryLink[] {
  const results: CategoryLink[] = [];
  const seen = new Set<string>();
  const pattern = /<a\s[^>]*href="(\/site\/gikai\/list433-\d+\.html)"[^>]*>([^<]+)<\/a>/gi;

  let match: RegExpExecArray | null;
  while ((match = pattern.exec(html)) !== null) {
    const href = match[1]!;
    const title = match[2]!.replace(/\s+/g, " ").trim();

    if (title !== "会議録" && title !== "一般質問") continue;

    const url = `${BASE_ORIGIN}${href}`;
    if (seen.has(url)) continue;
    seen.add(url);

    results.push({ title, url });
  }

  return results;
}

/**
 * カテゴリ一覧ページから記事ページリンクを抽出する。
 */
export function parseArticleLinks(html: string): ArticleLink[] {
  const results: ArticleLink[] = [];
  const seen = new Set<string>();
  const pattern = /<a\s[^>]*href="(\/site\/gikai\/\d+\.html)"[^>]*>([^<]+)<\/a>/gi;

  let match: RegExpExecArray | null;
  while ((match = pattern.exec(html)) !== null) {
    const href = match[1]!;
    const title = match[2]!.replace(/\s+/g, " ").trim();

    if (parseWarekiYear(title) === null) continue;
    if (!title.includes("会議録") && !title.includes("一般質問")) continue;

    const pageUrl = `${BASE_ORIGIN}${href}`;
    if (seen.has(pageUrl)) continue;
    seen.add(pageUrl);

    results.push({
      title,
      pageUrl,
      meetingType: detectMeetingType(title),
    });
  }

  return results;
}

function cleanPdfLabel(text: string): string {
  return text
    .replace(/<[^>]+>/g, "")
    .replace(/\s*\[PDFファイル[^\]]*\]/gi, "")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * 記事ページから PDF 添付を抽出する。
 * PDF ラベルをタイトル末尾に付与し、PDF 単位のレコードに展開する。
 */
export function parsePdfLinks(html: string, article: ArticleLink): AshiyaPdfRecord[] {
  const results: AshiyaPdfRecord[] = [];
  const seen = new Set<string>();
  const pattern = /<a\s[^>]*href="(\/uploaded\/attachment\/\d+\.pdf)"[^>]*>([\s\S]*?)<\/a>/gi;

  let match: RegExpExecArray | null;
  while ((match = pattern.exec(html)) !== null) {
    const href = match[1]!;
    const rawLabel = match[2]!;
    const pdfUrl = `${BASE_ORIGIN}${href}`;
    if (seen.has(pdfUrl)) continue;
    seen.add(pdfUrl);

    const pdfLabel = cleanPdfLabel(rawLabel);
    if (!pdfLabel) continue;

    results.push({
      title: `${article.title} ${pdfLabel}`.trim(),
      pdfUrl,
      heldOn: parseJapaneseDate(pdfLabel),
      meetingType: article.meetingType,
    });
  }

  return results;
}

/**
 * 指定年の PDF レコードを収集する。
 */
export async function fetchPdfRecordList(
  baseUrl: string,
  year: number,
): Promise<AshiyaPdfRecord[]> {
  const topHtml = await fetchPage(baseUrl);
  if (!topHtml) return [];

  const categories = parseCategoryLinks(topHtml);
  if (categories.length === 0) return [];

  const articleLinks: ArticleLink[] = [];

  for (const category of categories) {
    await delay(INTER_PAGE_DELAY_MS);
    const categoryHtml = await fetchPage(category.url);
    if (!categoryHtml) continue;

    const links = parseArticleLinks(categoryHtml).filter(
      (link) => parseWarekiYear(link.title) === year,
    );
    articleLinks.push(...links);
  }

  const records: AshiyaPdfRecord[] = [];
  for (const article of articleLinks) {
    await delay(INTER_PAGE_DELAY_MS);
    const articleHtml = await fetchPage(article.pageUrl);
    if (!articleHtml) continue;

    records.push(...parsePdfLinks(articleHtml, article));
  }

  return records;
}
