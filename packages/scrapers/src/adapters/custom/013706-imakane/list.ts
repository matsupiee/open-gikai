/**
 * 今金町議会 会議録 — list フェーズ
 *
 * 会議録一覧ページおよびカテゴリページを巡回し、PDF リンクを収集する。
 */

import {
  LIST_URL,
  fetchPage,
  extractPdfLinks,
  extractCategoryLinks,
} from "./shared";

export interface ImakanePdfRecord {
  /** PDF の絶対 URL */
  pdfUrl: string;
  /** リンクテキスト（会議名のヒント） */
  linkText: string;
  /** 収集元ページ URL */
  sourcePageUrl: string;
}

/**
 * HTML から PDF リンクとカテゴリリンクをまとめて収集する。
 * （テスト可能な純粋関数として公開）
 */
export function parsePageLinks(
  html: string,
  pageUrl: string,
): {
  pdfLinks: { url: string; text: string }[];
  categoryLinks: string[];
} {
  return {
    pdfLinks: extractPdfLinks(html, pageUrl),
    categoryLinks: extractCategoryLinks(html, pageUrl),
  };
}

/**
 * 指定年の PDF 一覧を収集する。
 * 一覧ページ → カテゴリページを1段階辿り、PDF リンクをすべて返す。
 * WAF 対策のため year フィルタリングはリンクテキスト・URL への正規表現マッチで行う。
 */
export async function fetchPdfList(
  _year: number,
): Promise<ImakanePdfRecord[]> {
  const records: ImakanePdfRecord[] = [];
  const seenUrls = new Set<string>();

  /** 指定 URL のページを取得して PDF を収集 */
  async function collectFromPage(pageUrl: string): Promise<void> {
    const html = await fetchPage(pageUrl);
    if (!html) return;

    const { pdfLinks } = parsePageLinks(html, pageUrl);
    for (const { url, text } of pdfLinks) {
      if (!seenUrls.has(url)) {
        seenUrls.add(url);
        records.push({ pdfUrl: url, linkText: text, sourcePageUrl: pageUrl });
      }
    }
  }

  // Step 1: 一覧ページを取得
  const indexHtml = await fetchPage(LIST_URL);
  if (!indexHtml) return records;

  // 一覧ページ自体の PDF リンクを収集
  const { pdfLinks: indexPdfs, categoryLinks } = parsePageLinks(
    indexHtml,
    LIST_URL,
  );
  for (const { url, text } of indexPdfs) {
    if (!seenUrls.has(url)) {
      seenUrls.add(url);
      records.push({ pdfUrl: url, linkText: text, sourcePageUrl: LIST_URL });
    }
  }

  // Step 2: カテゴリページを巡回
  for (const catUrl of categoryLinks) {
    await collectFromPage(catUrl);
  }

  return records;
}
