/**
 * 下仁田町議会（群馬県） — list フェーズ
 *
 * 1. トップページ（ul.menu_list > li.linkList > a）から年別ページ URL を収集
 * 2. 対象年の年別ページから PDF リンクとメタ情報を抽出
 */

import {
  BASE_ORIGIN,
  TOP_URL,
  detectMeetingType,
  fetchPage,
  parseWarekiYear,
  parseDateFromPdfUrl,
  delay,
} from "./shared";

/** 年別ページへのリンク情報 */
export interface YearPageLink {
  /** 西暦年 */
  year: number;
  /** 年別ページの絶対 URL */
  url: string;
}

/** list フェーズが返す1件分のデータ */
export interface ShimonitaSessionInfo {
  /** 会議タイトル（例: "令和6年12月定例会 会議録第1号12月9日"） */
  title: string;
  /** 開催日 YYYY-MM-DD（PDF 名から取得できない場合は null） */
  heldOn: string | null;
  /** 号別 PDF の絶対 URL */
  pdfUrl: string;
  /** 会議種別 */
  meetingType: "plenary" | "extraordinary" | "committee";
  /** 会議種別見出し（例: "令和6年12月定例会"） */
  meetingHeading: string;
}

const INTER_PAGE_DELAY_MS = 1_500;

/**
 * トップページ HTML から年別ページリンクを抽出する。
 * ul.menu_list > li.linkList > a を対象とする。
 */
export function parseYearPageLinks(html: string): YearPageLink[] {
  const links: YearPageLink[] = [];

  // menu_list ブロック内の linkList アイテムを抽出
  const listBlockMatch = html.match(
    /<ul[^>]*class="[^"]*menu_list[^"]*"[^>]*>([\s\S]*?)<\/ul>/i
  );
  if (!listBlockMatch?.[1]) return links;

  const listBlock = listBlockMatch[1];

  // linkList の各アイテムからリンクを抽出
  const itemPattern = /<li[^>]*class="[^"]*linkList[^"]*"[^>]*>[\s\S]*?<a[^>]*href="([^"]+)"[^>]*>([^<]+)<\/a>/gi;
  let m: RegExpExecArray | null;
  while ((m = itemPattern.exec(listBlock)) !== null) {
    const href = m[1]!.trim();
    const text = m[2]!.trim();

    const year = parseWarekiYear(text);
    if (year === null) continue;

    const url = href.startsWith("http") ? href : `${BASE_ORIGIN}${href}`;
    links.push({ year, url });
  }

  return links;
}

/**
 * 年別ページ HTML から会議種別見出しと PDF リンクを抽出する。
 *
 * 新形式（令和2年〜）: <p>【令和6年12月定例会】</p> + <table> 内の <a href="*.pdf">
 * 古い形式（平成24年〜）: Excel/Word 由来のテーブルで会議種別セル + PDF リンクセル
 */
export function parsePdfLinksFromYearPage(
  html: string,
  yearPageUrl?: string
): ShimonitaSessionInfo[] {
  // article.article 内を対象とする
  const articleMatch = html.match(
    /<article[^>]*class="[^"]*article[^"]*"[^>]*>([\s\S]*?)<\/article>/i
  );
  const content = articleMatch?.[1] ?? html;

  // --- 新形式パース ---
  // 【...】形式の見出し（<p> タグ内）と直後のテーブル内 PDF リンクを対応付ける
  const newFormatResults = parseNewFormat(content);
  if (newFormatResults.length > 0) {
    return newFormatResults;
  }

  // --- 古い形式パース ---
  // Excel/Word 由来のテーブルで、rowspan セルに会議種別名、隣セルに PDF リンク
  const oldFormatResults = parseOldFormat(content, yearPageUrl);
  return oldFormatResults;
}

/**
 * 新形式ページ（令和2年〜）のパース。
 * 【...】形式の見出し + テーブル内 PDF リンクのパターン。
 */
export function parseNewFormat(content: string): ShimonitaSessionInfo[] {
  const results: ShimonitaSessionInfo[] = [];

  // 【...】を含む <p> タグを見出しとして扱い、続くテーブル内の PDF リンクと対応付ける
  // <p>【令和6年12月定例会】</p> のようなパターン
  const segments = content.split(/(<p[^>]*>[\s\S]*?<\/p>)/gi);

  let currentHeading = "";

  for (const segment of segments) {
    // 見出し <p> タグを検出
    const headingMatch = segment.match(
      /<p[^>]*>[\s\S]*?【([\s\S]*?(?:定例会|臨時会))】[\s\S]*?<\/p>/i
    );
    if (headingMatch) {
      currentHeading = headingMatch[1]!.trim();
      continue;
    }

    // PDF リンクを含むテーブルを検出
    if (!currentHeading) continue;

    const pdfPattern = /href="([^"]*\.pdf)"[^>]*>([^<]*)<\/a>/gi;
    let m: RegExpExecArray | null;
    while ((m = pdfPattern.exec(segment)) !== null) {
      const href = m[1]!.trim();
      const linkText = m[2]!.replace(/[\s\u3000]+/g, " ").trim();

      if (!linkText) continue;

      const pdfUrl = href.startsWith("http")
        ? href
        : `${BASE_ORIGIN}${href.startsWith("/") ? href : `/${href}`}`;

      const heldOn = parseDateFromPdfUrl(pdfUrl);
      const meetingType = detectMeetingType(currentHeading);
      const title = `${currentHeading} ${linkText}`;

      results.push({
        title,
        heldOn,
        pdfUrl,
        meetingType,
        meetingHeading: currentHeading,
      });
    }
  }

  return results;
}

/**
 * 古い形式ページ（平成24年〜平成30年頃）のパース。
 * Excel/Word 由来のスタイル付きテーブルで、rowspan セルに会議種別名、隣セルに PDF リンク。
 */
export function parseOldFormat(content: string, yearPageUrl?: string): ShimonitaSessionInfo[] {
  const results: ShimonitaSessionInfo[] = [];

  // テーブル内のすべての <tr> を処理
  const tablePattern = /<table[^>]*>([\s\S]*?)<\/table>/gi;
  let tableMatch: RegExpExecArray | null;

  while ((tableMatch = tablePattern.exec(content)) !== null) {
    const tableContent = tableMatch[1]!;
    const rows = tableContent.split(/<tr[^>]*>/i).slice(1);

    let currentHeading = "";

    for (const row of rows) {
      // rowspan セルから会議種別名を取得
      const headingCellMatch = row.match(
        /<td[^>]*rowspan[^>]*>[\s\S]*?(?:<span[^>]*>)?([^<]*(?:定例会|臨時会)[^<]*)(?:<\/span>)?[\s\S]*?<\/td>/i
      );
      if (headingCellMatch?.[1]) {
        currentHeading = headingCellMatch[1]
          .replace(/[\s\u3000]+/g, " ")
          .trim();
      }

      // PDF リンクを取得
      const pdfMatch = row.match(
        /href="([^"]*\.pdf)"[^>]*>([^<]*(?:会議録[^<]*)?)<\/a>/i
      );
      if (!pdfMatch) continue;

      const href = pdfMatch[1]!.trim();
      let linkText = pdfMatch[2]!.replace(/[\s\u3000]+/g, " ").trim();

      // ファイルサイズ表記を除去: （263KB）など
      linkText = linkText.replace(/（\d+KB）/g, "").trim();

      if (!href || !linkText) continue;

      const pdfUrl = href.startsWith("http")
        ? href
        : yearPageUrl
          ? new URL(href, yearPageUrl).href
          : `${BASE_ORIGIN}${href.startsWith("/") ? href : `/${href}`}`;

      const heldOn = parseDateFromPdfUrl(pdfUrl);
      const meetingType = detectMeetingType(currentHeading || linkText);
      const heading = currentHeading || "";
      const title = heading ? `${heading} ${linkText}` : linkText;

      results.push({
        title,
        heldOn,
        pdfUrl,
        meetingType,
        meetingHeading: heading,
      });
    }
  }

  return results;
}

/**
 * 指定年の会議録セッション一覧を取得する。
 * 1. トップページから年別ページ URL を収集
 * 2. 対象年の年別ページから PDF リンクを収集
 */
export async function fetchSessionList(
  year: number
): Promise<ShimonitaSessionInfo[]> {
  // トップページから年別ページ URL を取得
  const topHtml = await fetchPage(TOP_URL);
  if (!topHtml) return [];

  const yearLinks = parseYearPageLinks(topHtml);
  const targetLink = yearLinks.find((l) => l.year === year);
  if (!targetLink) return [];

  await delay(INTER_PAGE_DELAY_MS);

  // 年別ページから PDF リンクを取得
  const yearHtml = await fetchPage(targetLink.url);
  if (!yearHtml) return [];

  return parsePdfLinksFromYearPage(yearHtml, targetLink.url);
}
