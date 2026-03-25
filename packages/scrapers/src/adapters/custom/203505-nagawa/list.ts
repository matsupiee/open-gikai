/**
 * 長和町議会 -- list フェーズ
 *
 * 一覧ページ (index.html) から年度別ページの URL を収集し、
 * 各年度別ページから PDF リンクを抽出する。
 *
 * ページ構造（一覧ページ）:
 *   <ul class="level1col2 clearfix">
 *     <li class="page">
 *       <a href="https://...1/2426.html">令和7年定例会会議録</a>
 *     </li>
 *   </ul>
 *
 * ページ構造（年度別ページ）:
 *   <p class="file-link-item">
 *     <a class="pdf" href="//www.town.nagawa.nagano.jp/material/files/group/11/{ファイル名}.pdf">
 *       令和6年長和町議会第1回定例会会議録 (PDFファイル: 1.4MB)
 *     </a>
 *   </p>
 */

import {
  BASE_ORIGIN,
  LIST_PAGE_URL,
  detectMeetingType,
  fetchPage,
  parseWarekiYear,
  toHankaku,
} from "./shared";

export interface NagawaSessionInfo {
  /** 会議タイトル（例: "令和6年長和町議会第1回定例会会議録"） */
  title: string;
  /** 西暦年（例: 2024） */
  year: number;
  /** PDF の絶対 URL */
  pdfUrl: string;
  /** 会議種別 */
  meetingType: string;
  /** 会議を一意に識別するキー（例: "nagawa_2024-1"） */
  sessionKey: string;
}

/**
 * 一覧ページ HTML から年度別ページの URL を抽出する（純粋関数）。
 *
 * セレクタ: ul.level1col2 li.page a
 */
export function parseYearlyPageLinks(html: string): Array<{
  url: string;
  title: string;
}> {
  const results: Array<{ url: string; title: string }> = [];

  // ul.level1col2 内の li.page > a を抽出
  const ulMatch = html.match(
    /<ul[^>]*class="[^"]*level1col2[^"]*"[^>]*>([\s\S]*?)<\/ul>/i
  );
  if (!ulMatch) return results;

  const ulContent = ulMatch[1]!;
  const liPattern = /<li[^>]*class="[^"]*page[^"]*"[^>]*>([\s\S]*?)<\/li>/gi;
  let liMatch: RegExpExecArray | null;

  while ((liMatch = liPattern.exec(ulContent)) !== null) {
    const liContent = liMatch[1]!;
    const aMatch = liContent.match(/<a[^>]+href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/i);
    if (!aMatch) continue;

    const href = aMatch[1]!.trim();
    const title = aMatch[2]!
      .replace(/<[^>]+>/g, "")
      .replace(/&nbsp;/g, " ")
      .replace(/\s+/g, " ")
      .trim();

    // 絶対 URL に変換
    let url: string;
    if (href.startsWith("http")) {
      url = href;
    } else if (href.startsWith("//")) {
      url = `https:${href}`;
    } else if (href.startsWith("/")) {
      url = `${BASE_ORIGIN}${href}`;
    } else {
      url = `${BASE_ORIGIN}/${href}`;
    }

    results.push({ url, title });
  }

  return results;
}

/**
 * 年度別ページ HTML から PDF リンク情報を抽出する（純粋関数）。
 *
 * セレクタ: p.file-link-item a.pdf
 */
export function parseYearlyPage(
  html: string,
  pageYear: number
): NagawaSessionInfo[] {
  const results: NagawaSessionInfo[] = [];

  // p.file-link-item 内の a.pdf を抽出
  const pPattern =
    /<p[^>]*class="[^"]*file-link-item[^"]*"[^>]*>([\s\S]*?)<\/p>/gi;
  let pMatch: RegExpExecArray | null;
  let sessionIndex = 0;

  while ((pMatch = pPattern.exec(html)) !== null) {
    const pContent = pMatch[1]!;
    const aMatch = pContent.match(
      /<a[^>]+class="[^"]*pdf[^"]*"[^>]+href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/i
    );
    if (!aMatch) continue;

    const href = aMatch[1]!.trim();
    const linkText = aMatch[2]!
      .replace(/<[^>]+>/g, "")
      .replace(/&nbsp;/g, " ")
      .replace(/\s+/g, " ")
      .trim();

    // ファイルサイズ情報を除去してタイトル取得
    const title = linkText.replace(/\s*\(PDFファイル[^)]*\)\s*$/, "").trim();
    if (!title) continue;

    // PDF URL を絶対 URL に変換（プロトコル相対パス対応）
    let pdfUrl: string;
    if (href.startsWith("http")) {
      pdfUrl = href;
    } else if (href.startsWith("//")) {
      pdfUrl = `https:${href}`;
    } else if (href.startsWith("/")) {
      pdfUrl = `${BASE_ORIGIN}${href}`;
    } else {
      pdfUrl = `${BASE_ORIGIN}/${href}`;
    }

    // タイトルから年を取得（失敗したらページ年を使用）
    const year = parseWarekiYear(title) ?? pageYear;

    // 回次を抽出してセッションキーを生成
    const normalized = toHankaku(title);
    const numMatch = normalized.match(/第(\d+)回/);
    const num = numMatch ? numMatch[1]! : String(sessionIndex);
    const sessionKey = `nagawa_${year}-${num}`;

    results.push({
      title,
      year,
      pdfUrl,
      meetingType: detectMeetingType(title),
      sessionKey,
    });

    sessionIndex++;
  }

  return results;
}

/**
 * 指定年の全セッション情報を取得する。
 *
 * 一覧ページから年度別ページ URL を収集し、
 * 対象年度のページのみ取得して PDF リンクを抽出する。
 */
export async function fetchDocumentList(
  year: number
): Promise<NagawaSessionInfo[]> {
  const indexHtml = await fetchPage(LIST_PAGE_URL);
  if (!indexHtml) return [];

  const yearlyLinks = parseYearlyPageLinks(indexHtml);

  const results: NagawaSessionInfo[] = [];

  for (const link of yearlyLinks) {
    // タイトルから年度を判定
    const linkYear = parseWarekiYear(link.title);
    if (linkYear !== null && linkYear !== year) continue;

    const pageHtml = await fetchPage(link.url);
    if (!pageHtml) continue;

    const sessions = parseYearlyPage(pageHtml, year);
    results.push(...sessions.filter((s) => s.year === year));
  }

  return results;
}
