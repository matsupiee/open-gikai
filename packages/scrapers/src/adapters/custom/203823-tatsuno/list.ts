/**
 * 辰野町議会 -- list フェーズ
 *
 * 2段階クロール:
 *   1. トップページ (index.html) から年度別ページへのリンクを収集
 *   2. 各年度ページから PDF リンクを収集（会期日程 PDF は除外）
 *
 * ページ構造:
 *   トップページ: <a href="/gyosei/.../gikaigijiroku/{pageId}.html">令和6年</a>
 *   年度ページ:
 *     <h2>定例会</h2>
 *     <h3>令和6年12月定例会</h3>
 *     <p class="file-link-item">
 *       <a class="pdf" href="//www.town.tatsuno.lg.jp/material/files/group/11/2024-12heikai.pdf">
 *         令和6年 第7回（12月）辰野町議会定例会会議録（最終日） (PDFファイル: 626.2KB)
 *       </a>
 *     </p>
 */

import {
  BASE_ORIGIN,
  INDEX_PAGE_URL,
  detectMeetingType,
  fetchPage,
  parseWarekiYear,
  delay,
} from "./shared";

export interface TatsunoSessionInfo {
  /** 会議タイトル（例: "令和6年第7回（12月）辰野町議会定例会会議録（最終日）"） */
  title: string;
  /** 西暦年（例: 2024） */
  year: number;
  /** PDF の絶対 URL */
  pdfUrl: string;
  /** 会議種別 */
  meetingType: string;
  /** 会議を一意に識別するキー */
  sessionKey: string;
}

/** 年度別ページへのリンクを抽出する */
export function parseIndexPage(html: string): Array<{ year: number; url: string }> {
  const results: Array<{ year: number; url: string }> = [];

  // /gikaigijiroku/{pageId}.html パターンのリンクを抽出
  const linkPattern = /href="([^"]*\/gikaigijiroku\/(\d+)\.html)"/g;
  const seen = new Set<string>();

  let m: RegExpExecArray | null;
  while ((m = linkPattern.exec(html)) !== null) {
    const href = m[1]!;
    const pageId = m[2]!;

    if (seen.has(pageId)) continue;
    seen.add(pageId);

    // href の前後テキストから年を探す
    // href 周辺のアンカーテキストを抽出
    const anchorPattern = new RegExp(
      `<a[^>]*href="${href.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}"[^>]*>([\\s\\S]*?)<\\/a>`,
      "i"
    );
    const anchorMatch = anchorPattern.exec(html);
    const anchorText = anchorMatch
      ? anchorMatch[1]!.replace(/<[^>]+>/g, "").trim()
      : "";

    const year = parseWarekiYear(anchorText);
    if (!year) continue;

    const url = href.startsWith("http")
      ? href
      : `${BASE_ORIGIN}${href.startsWith("/") ? "" : "/"}${href}`;

    results.push({ year, url });
  }

  return results;
}

/** リンクテキストからタイトル部分を抽出（ファイルサイズ情報を除去） */
export function cleanLinkText(text: string): string {
  return text
    .replace(/\s*\(PDFファイル:.+?\)\s*$/i, "")
    .replace(/\s+/g, " ")
    .trim();
}

/** 年度別ページから PDF セッション情報を抽出する */
export function parseYearPage(html: string, year: number): TatsunoSessionInfo[] {
  const sessions: TatsunoSessionInfo[] = [];

  // <p class="file-link-item"> 内の <a class="pdf"> を抽出
  const itemPattern = /<p[^>]*class="[^"]*file-link-item[^"]*"[^>]*>([\s\S]*?)<\/p>/gi;
  let itemMatch: RegExpExecArray | null;
  let index = 0;

  while ((itemMatch = itemPattern.exec(html)) !== null) {
    const itemHtml = itemMatch[1]!;

    // <a class="pdf" href="...">テキスト</a>
    const aPattern = /<a[^>]*class="[^"]*pdf[^"]*"[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/i;
    const aMatch = aPattern.exec(itemHtml);
    if (!aMatch) continue;

    const rawHref = aMatch[1]!;
    const rawText = aMatch[2]!.replace(/<[^>]+>/g, "").trim();

    const title = cleanLinkText(rawText);
    if (!title) continue;

    // 会期日程は除外
    if (title.includes("会期日程") || rawHref.includes("kaikinittei")) continue;

    // プロトコル省略形式の補完（//www.town.tatsuno.lg.jp/...）
    let pdfUrl: string;
    if (rawHref.startsWith("//")) {
      pdfUrl = `https:${rawHref}`;
    } else if (rawHref.startsWith("http")) {
      pdfUrl = rawHref;
    } else {
      pdfUrl = `${BASE_ORIGIN}${rawHref.startsWith("/") ? "" : "/"}${rawHref}`;
    }

    const sessionKey = `tatsuno_${year}_${index}`;
    const meetingType = detectMeetingType(title);

    sessions.push({
      title,
      year,
      pdfUrl,
      meetingType,
      sessionKey,
    });

    index++;
  }

  return sessions;
}

/**
 * 指定年の全セッション情報を取得する。
 * トップページから年度ページ URL を取得し、該当年のページをクロールする。
 */
export async function fetchSessionList(
  _baseUrl: string,
  year: number
): Promise<TatsunoSessionInfo[]> {
  const indexHtml = await fetchPage(INDEX_PAGE_URL);
  if (!indexHtml) return [];

  const yearPages = parseIndexPage(indexHtml);
  const targetPage = yearPages.find((p) => p.year === year);
  if (!targetPage) return [];

  await delay(1000);

  const yearHtml = await fetchPage(targetPage.url);
  if (!yearHtml) return [];

  return parseYearPage(yearHtml, year);
}
