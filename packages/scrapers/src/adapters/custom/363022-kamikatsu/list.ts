/**
 * 上勝町議会 -- list フェーズ
 *
 * 議決書と議会だよりの `more.html` から全記事リンクを収集し、
 * 各記事ページから PDF URL・公開日・タイトルを抽出する。
 *
 * サイト: http://www.kamikatsu.jp/gikai/
 * 自治体コード: 363022
 */

import { BASE_ORIGIN, detectMeetingType, parseWarekiYear, fetchPage, delay } from "./shared";

export interface KamikatsuArticleInfo {
  /** 記事タイトル */
  title: string;
  /** 公開日 YYYY-MM-DD（解析できない場合は null） */
  publishedOn: string | null;
  /** PDF の絶対 URL */
  pdfUrl: string;
  /** 会議種別 */
  meetingType: string;
  /** 記事 ID（URL の {YYYYMMDD}{5桁連番} 部分） */
  articleId: string;
  /** カテゴリ: giketusho | gikaidayori */
  category: "giketusho" | "gikaidayori";
}

const INTER_REQUEST_DELAY_MS = 1500;

/** 議決書の more.html URL */
const GIKETUSHO_MORE_URL = `${BASE_ORIGIN}/gikai/category/zokusei/giketusho/more.html`;

/** 議会だよりの more.html URL */
const GIKAIDAYORI_MORE_URL = `${BASE_ORIGIN}/gikai/category/zokusei/gikaidayori/more.html`;

/**
 * more.html から記事リンク（/gikai/docs/{ID}/）を抽出する。
 * 重複は除去する。
 */
export function parseArticleLinks(html: string): { articleId: string; title: string }[] {
  const links: { articleId: string; title: string }[] = [];
  const seen = new Set<string>();

  // パターン: <a href="/gikai/docs/{ID}/">タイトル</a>
  const pattern = /<a\s[^>]*href="\/gikai\/docs\/(\d+)\/?[^"]*"[^>]*>([^<]+)<\/a>/gi;

  let m: RegExpExecArray | null;
  while ((m = pattern.exec(html)) !== null) {
    const articleId = m[1]!;
    const title = m[2]!.replace(/\s+/g, " ").trim();

    if (!articleId || !title) continue;
    if (seen.has(articleId)) continue;
    seen.add(articleId);

    links.push({ articleId, title });
  }

  return links;
}

/**
 * 記事詳細ページの HTML から公開日（YYYY-MM-DD）を抽出する。
 * 解析できない場合は null を返す。
 *
 * HTML例: <p class="publishedAt">公開日 2013年12月20日</p>
 */
export function parsePublishedDate(html: string): string | null {
  const m = html.match(/公開日\s*(\d{4})年(\d{1,2})月(\d{1,2})日/);
  if (!m) return null;

  const year = m[1]!;
  const month = String(parseInt(m[2]!, 10)).padStart(2, "0");
  const day = String(parseInt(m[3]!, 10)).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

/**
 * 記事詳細ページの HTML から PDF リンクを抽出する。
 * 相対パス "file_contents/{ファイル名}.pdf" を絶対 URL に変換する。
 *
 * HTML例: <a class="iconFile iconPdf" href="file_contents/H25_teireikai_5th.pdf">
 */
export function parsePdfUrl(html: string, articlePageUrl: string): string | null {
  const m = html.match(/<a[^>]*href="(file_contents\/[^"]+\.pdf)"[^>]*>/i);
  if (!m) return null;

  const relativePath = m[1]!;
  try {
    return new URL(relativePath, articlePageUrl).toString();
  } catch {
    return null;
  }
}

/**
 * 公開日ベースで対象年度に含まれるか判定する。
 */
export function isInYear(publishedOn: string | null, year: number): boolean {
  if (!publishedOn) return false;
  return publishedOn.startsWith(String(year));
}

/**
 * 公開日が対象年度より新しいか判定する（差分更新の打ち切り判定）。
 */
export function isAfterYear(publishedOn: string | null, year: number): boolean {
  if (!publishedOn) return false;
  return parseInt(publishedOn.slice(0, 4), 10) > year;
}

/**
 * 指定カテゴリの more.html から全記事を収集し、
 * 対象年度の記事のみを返す。
 */
async function fetchCategoryArticles(
  moreUrl: string,
  category: "giketusho" | "gikaidayori",
  year: number,
): Promise<KamikatsuArticleInfo[]> {
  const html = await fetchPage(moreUrl);
  if (!html) return [];

  const links = parseArticleLinks(html);
  const results: KamikatsuArticleInfo[] = [];

  for (const link of links) {
    const articlePageUrl = `${BASE_ORIGIN}/gikai/docs/${link.articleId}/`;

    await delay(INTER_REQUEST_DELAY_MS);

    const detailHtml = await fetchPage(articlePageUrl);
    if (!detailHtml) continue;

    const publishedOn = parsePublishedDate(detailHtml);

    // 対象年度より古い記事はスキップ（一覧は新しい順のため、以降の記事も古い）
    if (publishedOn && parseInt(publishedOn.slice(0, 4), 10) < year) {
      // more.html は新しい順のため、対象年より古くなったら終了
      break;
    }

    // 対象年度の記事のみ収集
    if (!isInYear(publishedOn, year)) continue;

    const pdfUrl = parsePdfUrl(detailHtml, articlePageUrl);
    if (!pdfUrl) continue;

    // タイトルに含まれる和暦から会議種別を判定
    const meetingType = detectMeetingType(link.title);

    // 開催日: 議決書タイトルから和暦を解析して年を特定
    // 例: "平成25年第5回定例会(12月)" → heldOn は publishedOn と同一とする
    results.push({
      title: link.title,
      publishedOn,
      pdfUrl,
      meetingType,
      articleId: link.articleId,
      category,
    });
  }

  return results;
}

/**
 * 指定年度の全記事（議決書 + 議会だより）を収集する。
 */
export async function fetchArticleList(
  _baseUrl: string,
  year: number,
): Promise<KamikatsuArticleInfo[]> {
  const allArticles: KamikatsuArticleInfo[] = [];

  // 議決書
  const giketushoArticles = await fetchCategoryArticles(
    GIKETUSHO_MORE_URL,
    "giketusho",
    year,
  );
  allArticles.push(...giketushoArticles);

  await delay(INTER_REQUEST_DELAY_MS);

  // 議会だより
  const gikaidayoriArticles = await fetchCategoryArticles(
    GIKAIDAYORI_MORE_URL,
    "gikaidayori",
    year,
  );
  allArticles.push(...gikaidayoriArticles);

  return allArticles;
}

/**
 * 公開日文字列から発行年度を取得する。
 * 議決書タイトルに含まれる和暦から開催年を取得する。
 * 和暦が含まれない場合は publishedOn の年を使う。
 */
export function resolveHeldOnYear(title: string, publishedOn: string | null): number | null {
  const fromTitle = parseWarekiYear(title);
  if (fromTitle !== null) return fromTitle;

  if (!publishedOn) return null;
  const year = parseInt(publishedOn.slice(0, 4), 10);
  return isNaN(year) ? null : year;
}
