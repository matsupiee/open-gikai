/**
 * 大和町議会 — list フェーズ
 *
 * トップページ（年度一覧）から各年度ページへのリンクを収集し、
 * 指定年の年度ページから会議録 PDF リンクを収集する。
 *
 * HTML 構造（トップページ）:
 * - <article id="contents"> 内に年度ページへのリンク一覧
 * - <a href="...kaigiroku/{ID}.html">{年度名}大和町議会会議録</a>
 *
 * HTML 構造（年度別ページ）:
 * - <h2> 内の <span class="bg3"> から会議種別を取得
 * - <p class="file-link-item"> 内の <a class="pdf"> から PDF URL を取得
 * - リンクテキストから開催日と議事内容を取得
 */

import {
  BASE_ORIGIN,
  LIST_PATH,
  detectMeetingType,
  fetchPage,
  parseWarekiYear,
  toHankaku,
  delay,
} from "./shared";

export interface TaiwaMeeting {
  /** PDF の絶対 URL */
  pdfUrl: string;
  /** 会議タイトル（例: "令和6年12月定例会議 12月2日分"） */
  title: string;
  /** 開催日 YYYY-MM-DD（解析できない場合は null） */
  heldOn: string | null;
  /** 会議種別 */
  meetingType: "plenary" | "extraordinary" | "committee";
}

/**
 * トップページ HTML から指定年に対応する年度ページ URL を抽出する。
 */
export function parseTopPage(html: string, targetYear: number): string | null {
  // <article id="contents"> 内のリンクを検索
  const contentsMatch = html.match(
    /<article[^>]*id="contents"[^>]*>([\s\S]*?)<\/article>/i
  );
  const contentsHtml = contentsMatch ? contentsMatch[1]! : html;

  // 年度ページへのリンクを全て抽出
  const linkPattern =
    /<a\s[^>]*href="([^"]*\/choseijoho\/gikai\/kaigiroku\/\d+\.html)"[^>]*>([\s\S]*?)<\/a>/gi;

  for (const match of contentsHtml.matchAll(linkPattern)) {
    const href = match[1]!.trim();
    const linkText = match[2]!.replace(/<[^>]+>/g, "").trim();

    const year = parseWarekiYear(linkText);
    if (year === targetYear) {
      return href.startsWith("http") ? href : `${BASE_ORIGIN}${href}`;
    }
  }

  return null;
}

/**
 * 年度別ページ HTML から会議録 PDF 情報を抽出する（テスト可能な純粋関数）。
 *
 * アルゴリズム:
 * 1. <h2> から会議種別を抽出し、currentMeetingType を更新する
 * 2. <p class="file-link-item"> 内の <a class="pdf"> からPDF URLとリンクテキストを取得
 * 3. リンクテキストから開催日を抽出し、タイトルを組み立てる
 */
export function parseYearPage(html: string, year: number): TaiwaMeeting[] {
  const results: TaiwaMeeting[] = [];

  // h2 とそれに続くコンテンツを処理するため、ブロック分割する
  // <h2> タグを区切りとして処理
  const blockRegex =
    /<h2[^>]*>([\s\S]*?)<\/h2>([\s\S]*?)(?=<h2|<\/article|$)/gi;

  for (const blockMatch of html.matchAll(blockRegex)) {
    const h2Content = blockMatch[1]!;
    const blockContent = blockMatch[2]!;

    // <span class="bg3"> から会議種別テキストを抽出
    const bg3Match = h2Content.match(
      /<span[^>]*class="bg3"[^>]*>([\s\S]*?)<\/span>/i
    );
    if (!bg3Match) continue;

    const meetingTypeText = bg3Match[1]!
      .replace(/<[^>]+>/g, "")
      .replace(/\s+/g, " ")
      .trim();

    // <p class="file-link-item"> 内の <a class="pdf"> を抽出
    const pdfItemPattern =
      /<p[^>]*class="file-link-item"[^>]*>([\s\S]*?)<\/p>/gi;

    for (const pdfItemMatch of blockContent.matchAll(pdfItemPattern)) {
      const pdfItemContent = pdfItemMatch[1]!;

      const pdfLinkPattern =
        /<a[^>]*class="pdf"[^>]*href="([^"]*)"[^>]*>([\s\S]*?)<\/a>/i;
      const pdfLinkMatch = pdfItemContent.match(pdfLinkPattern);
      if (!pdfLinkMatch) continue;

      const href = pdfLinkMatch[1]!.trim();
      const rawLinkText = pdfLinkMatch[2]!
        .replace(/<[^>]+>/g, "")
        .replace(/\s+/g, " ")
        .trim();

      // プロトコル相対URLに https: を付加して絶対URLに変換
      let pdfUrl: string;
      if (href.startsWith("//")) {
        pdfUrl = `https:${href}`;
      } else if (href.startsWith("http")) {
        pdfUrl = href;
      } else {
        pdfUrl = `${BASE_ORIGIN}${href}`;
      }

      // リンクテキストから開催日を抽出
      // パターン: "12月2日分（...）(PDFファイル: 1.2MB)"
      const normalizedText = toHankaku(rawLinkText);
      const dateMatch = normalizedText.match(/^(\d{1,2})月(\d{1,2})日/);
      let heldOn: string | null = null;
      if (dateMatch?.[1] && dateMatch[2]) {
        const month = parseInt(dateMatch[1], 10);
        const day = parseInt(dateMatch[2], 10);
        heldOn = `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
      }

      // ファイルサイズ情報を除去してリンクテキストを整理
      const cleanLinkText = rawLinkText
        .replace(/\s*\(PDFファイル[^)]*\)/g, "")
        .trim();

      const title = `${meetingTypeText} ${cleanLinkText}`;

      results.push({
        pdfUrl,
        title,
        heldOn,
        meetingType: detectMeetingType(meetingTypeText),
      });
    }
  }

  return results;
}

/**
 * トップページから指定年の年度ページURLを取得し、
 * 年度ページから全会議録 PDF 情報を返す。
 */
export async function fetchMeetingList(year: number): Promise<TaiwaMeeting[]> {
  const topUrl = `${BASE_ORIGIN}${LIST_PATH}`;
  const topHtml = await fetchPage(topUrl);
  if (!topHtml) return [];

  const yearPageUrl = parseTopPage(topHtml, year);
  if (!yearPageUrl) return [];

  await delay(1000);

  const yearHtml = await fetchPage(yearPageUrl);
  if (!yearHtml) return [];

  return parseYearPage(yearHtml, year);
}
