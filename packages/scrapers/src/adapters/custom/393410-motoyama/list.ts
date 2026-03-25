/**
 * 本山町議会 — list フェーズ
 *
 * トップページから年度ページ URL を収集し、各年度ページから PDF リンクとメタ情報を抽出する。
 *
 * トップページ構造:
 * - ul.level1col2 > li.page > a: 年度ページへのリンク
 *
 * 年度別ページ構造:
 * - div.free-layout-area 内に h3 で会議セクションが区切られる
 * - div.wysiwyg > p: 会期情報（例: 「会期：令和6年12月3日～12月12日」）
 * - p.file-link-item > a.pdf: PDF リンク
 */

import { BASE_ORIGIN, TOP_URL, fetchPage, parseWarekiYear, parseWarekiDate } from "./shared";

export interface MotoyamaPdfEntry {
  /** PDF の URL */
  pdfUrl: string;
  /** PDF リンクのラベルテキスト（例: "12月3日 開会日"） */
  label: string;
  /** 会議名（h3 から抽出、例: "第9回本山町議会定例会会議録"） */
  meetingTitle: string;
  /** 会期開始日（YYYY-MM-DD）。会期情報から取得。取得できない場合は null */
  heldOn: string | null;
  /** 年度（西暦） */
  year: number;
  /** 年度ページの URL */
  yearPageUrl: string;
}

/**
 * トップページの HTML から年度ページのリンクを抽出する（テスト可能な純粋関数）。
 *
 * セレクタ: ul.level1col2 li.page a
 */
export function parseTopPage(html: string): Array<{ url: string; title: string }> {
  const results: Array<{ url: string; title: string }> = [];

  // ul.level1col2 ブロックを抽出（class に他のクラスが付く場合も対応）
  const ulPattern = /<ul[^>]*class="[^"]*level1col2[^"]*"[^>]*>([\s\S]*?)<\/ul>/gi;
  for (const ulMatch of html.matchAll(ulPattern)) {
    const ulContent = ulMatch[1]!;

    // li.page 内の a タグを抽出
    const liPattern = /<li[^>]*class="page"[^>]*>([\s\S]*?)<\/li>/gi;
    for (const liMatch of ulContent.matchAll(liPattern)) {
      const liContent = liMatch[1]!;

      const aPattern = /<a[^>]+href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/i;
      const aMatch = liContent.match(aPattern);
      if (!aMatch) continue;

      const href = aMatch[1]!;
      const title = aMatch[2]!
        .replace(/<[^>]+>/g, "")
        .replace(/&nbsp;/g, " ")
        .replace(/&amp;/g, "&")
        .trim();

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
  }

  return results;
}

/**
 * 年度別ページの HTML から PDF リンクとメタ情報を抽出する（テスト可能な純粋関数）。
 *
 * 構造:
 * - div.free-layout-area 内に h3 で会議セクションが区切られる
 * - div.wysiwyg > p: 「会期：令和X年X月X日～X月X日」
 * - p.file-link-item > a.pdf: PDF リンク
 */
export function parseYearPage(
  html: string,
  yearPageUrl: string,
  year: number
): MotoyamaPdfEntry[] {
  const results: MotoyamaPdfEntry[] = [];

  // div.free-layout-area が見つからない場合はページ全体を使う
  let areaContent = "";
  const areaMatch = html.match(/<div[^>]*class="free-layout-area"[^>]*>([\s\S]*)/i);
  if (areaMatch) {
    areaContent = areaMatch[1]!;
  } else {
    areaContent = html;
  }

  // h3 タグの位置を収集
  const h3Pattern = /<h3[^>]*>([\s\S]*?)<\/h3>/gi;
  const h3List: { index: number; title: string }[] = [];
  for (const h3Match of areaContent.matchAll(h3Pattern)) {
    const title = h3Match[1]!
      .replace(/<[^>]+>/g, "")
      .replace(/&nbsp;/g, " ")
      .trim();
    h3List.push({ index: h3Match.index!, title });
  }

  // 会期情報の位置を収集（div.wysiwyg > p から「会期：...」を抽出）
  const wysiwygPattern =
    /<div[^>]*class="wysiwyg"[^>]*>([\s\S]*?)<\/div>/gi;
  const periodList: { index: number; heldOn: string | null }[] = [];
  for (const wysiwygMatch of areaContent.matchAll(wysiwygPattern)) {
    const innerHtml = wysiwygMatch[1]!;
    const pPattern = /<p[^>]*>([\s\S]*?)<\/p>/gi;
    for (const pMatch of innerHtml.matchAll(pPattern)) {
      const text = pMatch[1]!
        .replace(/<[^>]+>/g, "")
        .replace(/&nbsp;/g, " ")
        .trim();
      if (text.startsWith("会期")) {
        // 会期テキストから開始日を抽出
        // 例: "会期：令和6年12月3日～12月12日" → "2024-12-03"
        const heldOn = parseWarekiDate(text);
        periodList.push({ index: wysiwygMatch.index!, heldOn });
        break;
      }
    }
  }

  // PDF リンクを抽出
  const pdfLinkPattern =
    /<p[^>]*class="file-link-item"[^>]*>[\s\S]*?<a[^>]*class="pdf"[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/gi;

  for (const linkMatch of areaContent.matchAll(pdfLinkPattern)) {
    const linkIndex = linkMatch.index!;
    const href = linkMatch[1]!;
    const labelHtml = linkMatch[2]!;
    const rawLabel = labelHtml
      .replace(/<[^>]+>/g, "")
      .replace(/&nbsp;/g, " ")
      .replace(/&amp;/g, "&")
      .trim();

    // "(PDFファイル: XXX)" の部分を除去
    const label = rawLabel.replace(/\s*\([^)]*PDFファイル[^)]*\)\s*$/, "").trim();

    // PDF URL を構築
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

    // 直前の h3 セクション（会議名）を特定
    let meetingTitle = "";
    for (const h3 of h3List) {
      if (h3.index < linkIndex) {
        meetingTitle = h3.title;
      }
    }

    // 直前の会期情報を特定
    let heldOn: string | null = null;
    for (const period of periodList) {
      if (period.index < linkIndex) {
        heldOn = period.heldOn;
      }
    }

    results.push({ pdfUrl, label, meetingTitle, heldOn, year, yearPageUrl });
  }

  return results;
}

/**
 * 指定年の全 PDF エントリを取得する。
 *
 * トップページから年度ページを自動検出する。
 */
export async function fetchDocumentList(year: number): Promise<MotoyamaPdfEntry[]> {
  const topHtml = await fetchPage(TOP_URL);
  if (!topHtml) return [];

  const yearLinks = parseTopPage(topHtml);

  const allEntries: MotoyamaPdfEntry[] = [];
  for (const { url, title } of yearLinks) {
    // タイトルから年度を判定してフィルタリング
    const linkYear = parseWarekiYear(title);
    if (linkYear !== null && linkYear !== year) continue;

    const yearHtml = await fetchPage(url);
    if (!yearHtml) continue;

    const entries = parseYearPage(yearHtml, url, year);
    allEntries.push(...entries);
  }

  return allEntries;
}
