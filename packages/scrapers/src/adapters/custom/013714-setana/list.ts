/**
 * せたな町議会 会議録 — list フェーズ
 *
 * 会議録トップページから年度別ページを収集し、各年度ページから PDF リンクを収集する。
 */

import {
  LIST_URL,
  fetchPage,
  extractPdfLinks,
  extractYearPageLinks,
} from "./shared";

export interface SetanaPdfRecord {
  /** PDF の絶対 URL */
  pdfUrl: string;
  /** リンクテキスト（会議名のヒント） */
  linkText: string;
  /** 収集元ページ URL */
  sourcePageUrl: string;
}

/**
 * HTML から PDF リンクと年度ページリンクをまとめて収集する。
 * （テスト可能な純粋関数として公開）
 */
export function parsePageLinks(
  html: string,
  pageUrl: string,
): {
  pdfLinks: { url: string; text: string }[];
  yearPageLinks: string[];
} {
  return {
    pdfLinks: extractPdfLinks(html, pageUrl),
    yearPageLinks: extractYearPageLinks(html),
  };
}

/**
 * 指定年の PDF 一覧を収集する。
 * トップページ → 年度別ページを辿り、PDF リンクをすべて返す。
 */
export async function fetchPdfList(
  _year: number,
): Promise<SetanaPdfRecord[]> {
  const records: SetanaPdfRecord[] = [];
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

  // Step 1: トップページを取得
  const indexHtml = await fetchPage(LIST_URL);
  if (!indexHtml) return records;

  // トップページ自体の PDF リンクを収集
  const { pdfLinks: indexPdfs, yearPageLinks } = parsePageLinks(
    indexHtml,
    LIST_URL,
  );
  for (const { url, text } of indexPdfs) {
    if (!seenUrls.has(url)) {
      seenUrls.add(url);
      records.push({ pdfUrl: url, linkText: text, sourcePageUrl: LIST_URL });
    }
  }

  // Step 2: 年度別ページを巡回
  for (const yearUrl of yearPageLinks) {
    await collectFromPage(yearUrl);
  }

  return records;
}
