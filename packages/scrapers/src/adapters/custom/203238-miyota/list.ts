/**
 * 御代田町議会 -- list フェーズ
 *
 * 3 階層構造:
 *   会議録一覧 (kaigiroku/index.html)
 *     └─ 年度別一覧 ({年度カテゴリ}/index.html)
 *          └─ 定例会詳細ページ ({年度カテゴリ}/{ページID}.html)
 *               └─ PDF ファイル (file/{ファイルID}.pdf)
 *
 * 年度カテゴリスラッグに規則性がないため、一覧ページから動的に取得する。
 */

import {
  BASE_ORIGIN,
  KAIGIROKU_LIST_URL,
  detectMeetingType,
  fetchPage,
  parseWarekiYear,
  toHankaku,
  delay,
} from "./shared";

export interface MiyotaSessionInfo {
  /** 会議タイトル（例: "令和６年第４回御代田町議会定例会会議録"） */
  title: string;
  /** 西暦年（例: 2024） */
  year: number;
  /** 定例会詳細ページの URL */
  sessionPageUrl: string;
  /** PDF の絶対 URL */
  pdfUrl: string;
  /** 会議種別 */
  meetingType: string;
  /** 会議を一意に識別するキー */
  sessionKey: string;
}

/**
 * 会議録一覧ページから年度別カテゴリ URL を抽出する。
 *
 * 例: href="../../category/reiwarokunenkaigiroku/index.html"
 * 例: href="/category/reiwarokunenkaigiroku/index.html"
 */
export function parseYearCategoryUrls(html: string): string[] {
  const urls: string[] = [];
  // 相対パス（../../category/...）と絶対パス（/category/...）の両方に対応
  const pattern = /href="(?:\.\.\/\.\.)?(\/?category\/[^"]+\/index\.html)"/gi;
  let m: RegExpExecArray | null;

  while ((m = pattern.exec(html)) !== null) {
    const href = m[1]!.startsWith("/") ? m[1]! : `/${m[1]!}`;
    // kaigiroku 自身を除外
    if (href === "/category/kaigiroku/index.html") continue;
    // 会議録関連のカテゴリのみ対象（kaigi, reiwa, heisei パターン）
    const slug = href.match(/\/category\/([^/]+)\/index\.html/)?.[1] ?? "";
    if (
      !slug.startsWith("kaigir") &&
      !slug.startsWith("kaigih") &&
      !slug.startsWith("reiwa") &&
      !slug.startsWith("heisei")
    )
      continue;
    const url = `${BASE_ORIGIN}${href}`;
    if (!urls.includes(url)) {
      urls.push(url);
    }
  }

  return urls;
}

/**
 * 年度別一覧ページから定例会詳細ページの URL とタイトルを抽出する。
 *
 * 各リンクのテキストから会議名（例: 「令和６年第４回御代田町議会定例会会議録」）を抽出。
 * 相対パス（../../category/{スラッグ}/...）と絶対パス（/category/{スラッグ}/...）に対応。
 */
export function parseSessionLinks(
  html: string,
  categorySlug: string
): Array<{ url: string; title: string }> {
  const links: Array<{ url: string; title: string }> = [];

  // 相対パスと絶対パスの両方に対応: ../../category/{slug}/{id}.html または /category/{slug}/{id}.html
  const escaped = escapeRegExp(categorySlug);
  const pattern = new RegExp(
    `href="(?:\\.\\.\\/\\.\\.\\/)?(?:\\/?category\\/${escaped}\\/)((?!index)[^"]+\\.html)"[^>]*>([^<]+)<`,
    "gi"
  );

  let m: RegExpExecArray | null;
  while ((m = pattern.exec(html)) !== null) {
    const pageFile = m[1]!;
    const rawTitle = m[2]!
      .replace(/&nbsp;/g, " ")
      .replace(/\s+/g, " ")
      .trim();
    const url = `${BASE_ORIGIN}/category/${categorySlug}/${pageFile}`;
    if (!links.some((l) => l.url === url)) {
      links.push({ url, title: rawTitle });
    }
  }

  return links;
}

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * 定例会詳細ページから PDF URL を抽出する。
 *
 * PDF は `../../file/{ファイルID}.pdf` または `/file/{ファイルID}.pdf` パターン。
 */
export function parsePdfUrls(html: string): string[] {
  const urls: string[] = [];
  // 相対パス（../../file/...）と絶対パス（/file/...）の両方に対応
  const pattern = /href="(?:\.\.\/\.\.)?(\/?file\/[^"]+\.pdf)"/gi;
  let m: RegExpExecArray | null;

  while ((m = pattern.exec(html)) !== null) {
    const href = m[1]!.startsWith("/") ? m[1]! : `/${m[1]!}`;
    const url = `${BASE_ORIGIN}${href}`;
    if (!urls.includes(url)) {
      urls.push(url);
    }
  }

  return urls;
}

/**
 * リンクテキストから西暦年を抽出する。
 * 例: "令和６年第４回御代田町議会定例会会議録" → 2024
 */
export function extractYearFromTitle(title: string): number | null {
  return parseWarekiYear(toHankaku(title));
}

/**
 * 指定年の全セッション情報を取得する。
 *
 * 会議録一覧 → 年度別一覧 → 定例会詳細 → PDF URL の 3 段階クロール。
 */
export async function fetchDocumentList(
  _baseUrl: string,
  year: number
): Promise<MiyotaSessionInfo[]> {
  const listHtml = await fetchPage(KAIGIROKU_LIST_URL);
  if (!listHtml) return [];

  const yearCategoryUrls = parseYearCategoryUrls(listHtml);
  const sessions: MiyotaSessionInfo[] = [];

  for (const categoryUrl of yearCategoryUrls) {
    await delay(1000);

    const categoryHtml = await fetchPage(categoryUrl);
    if (!categoryHtml) continue;

    // カテゴリスラッグを URL から抽出
    const slugMatch = categoryUrl.match(/\/category\/([^/]+)\/index\.html$/);
    if (!slugMatch) continue;
    const categorySlug = slugMatch[1]!;

    const sessionLinks = parseSessionLinks(categoryHtml, categorySlug);

    for (const { url: sessionPageUrl, title } of sessionLinks) {
      const titleYear = extractYearFromTitle(title);
      if (titleYear !== year) continue;

      await delay(1000);

      const sessionHtml = await fetchPage(sessionPageUrl);
      if (!sessionHtml) continue;

      const pdfUrls = parsePdfUrls(sessionHtml);

      for (let i = 0; i < pdfUrls.length; i++) {
        const pdfUrl = pdfUrls[i]!;
        const fileIdMatch = pdfUrl.match(/\/file\/(\d+)\.pdf$/);
        const fileId = fileIdMatch ? fileIdMatch[1]! : `${i}`;
        const sessionKey = `miyota_${year}_${categorySlug}_${fileId}`;

        sessions.push({
          title: title.replace(/\s+/g, ""),
          year,
          sessionPageUrl,
          pdfUrl,
          meetingType: detectMeetingType(title),
          sessionKey,
        });
      }
    }
  }

  return sessions;
}
