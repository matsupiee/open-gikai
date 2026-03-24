/**
 * 共和町教育委員会 会議録 — list フェーズ
 *
 * 起点ページ (?content=91) から年度別ページへのリンクを収集し、
 * 各年度ページから PDF リンクとメタ情報を収集する。
 */

import {
  INDEX_CONTENT_ID,
  buildContentUrl,
  fetchPage,
  parseWarekiDate,
  resolveUrl,
} from "./shared";

export interface KyowaDocument {
  /** PDF の絶対 URL */
  pdfUrl: string;
  /** 会議タイトル (例: "第1回会議録") */
  title: string;
  /** 開催日 YYYY-MM-DD。解析失敗時は null */
  heldOn: string | null;
  /** 年度文字列 (例: "令和6年") */
  fiscalYear: string;
}

/**
 * 起点ページ HTML から年度別ページの content ID を抽出する。
 * ?content={ID} 形式のリンクを収集する（自己参照の INDEX_CONTENT_ID を除く）。
 */
export function parseYearPageIds(html: string): string[] {
  const ids: string[] = [];
  const linkRegex = /[?&]content=(\d+)/g;

  for (const match of html.matchAll(linkRegex)) {
    const id = match[1]!;
    if (id === INDEX_CONTENT_ID) continue;
    if (!ids.includes(id)) {
      ids.push(id);
    }
  }

  return ids;
}

/**
 * 年度別ページ HTML から PDF リンクとメタ情報をパースする。
 *
 * 各リンクのテキストに開催回次（第N回）と開催日（令和X年M月D日）が含まれる。
 */
export function parseYearPage(
  html: string,
  pageUrl: string,
): KyowaDocument[] {
  const documents: KyowaDocument[] = [];

  // <a> タグで href が .pdf で終わるリンクを抽出
  const linkRegex = /<a[^>]+href="([^"]*\.pdf)"[^>]*>([\s\S]*?)<\/a>/gi;

  for (const match of html.matchAll(linkRegex)) {
    const rawHref = match[1]!;
    const rawText = match[2]!
      .replace(/<[^>]+>/g, "")
      .replace(/&nbsp;/g, " ")
      .replace(/&amp;/g, "&")
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">")
      .replace(/&quot;/g, '"')
      .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(Number(code)))
      .replace(/\s+/g, " ")
      .trim();

    if (!rawText) continue;

    const pdfUrl = resolveUrl(rawHref, pageUrl);

    // 重複チェック
    if (documents.some((d) => d.pdfUrl === pdfUrl)) continue;

    // 開催日を抽出（令和X年M月D日 形式）
    const dateMatch = rawText.match(/(令和|平成)(元|\d+)年\d+月\d+日/);
    const heldOn = dateMatch ? parseWarekiDate(dateMatch[0]) : null;

    // 年度を抽出（令和X年 形式）
    const yearMatch = rawText.match(/(令和|平成)(元|\d+)年/);
    const fiscalYear = yearMatch ? yearMatch[0] : "";

    // 会議タイトルを抽出（第N回会議録 形式）
    const sessionMatch = rawText.match(/第\d+回[^\s]*会議録?/);
    const title = sessionMatch ? sessionMatch[0] : rawText;

    documents.push({
      pdfUrl,
      title: title.trim(),
      heldOn,
      fiscalYear,
    });
  }

  return documents;
}

/**
 * 全年度ページから PDF リンクとメタ情報を収集する。
 * baseUrl は municipalities.csv の url カラム（起点ページ）。
 */
export async function fetchAllDocuments(baseUrl: string): Promise<KyowaDocument[]> {
  const allDocuments: KyowaDocument[] = [];

  // 起点ページを取得して年度別ページの content ID を収集
  const indexHtml = await fetchPage(baseUrl);
  if (!indexHtml) return allDocuments;

  const yearPageIds = parseYearPageIds(indexHtml);

  // content=91 自体も起点ページとして処理（最初の年度ページが content=91 と同じ場合がある）
  // 起点ページの PDF リンクも収集
  const indexDocs = parseYearPage(indexHtml, baseUrl);
  for (const doc of indexDocs) {
    if (!allDocuments.some((d) => d.pdfUrl === doc.pdfUrl)) {
      allDocuments.push(doc);
    }
  }

  // 各年度ページを巡回
  for (const contentId of yearPageIds) {
    const pageUrl = buildContentUrl(contentId);
    const html = await fetchPage(pageUrl);
    if (!html) continue;

    const docs = parseYearPage(html, pageUrl);
    for (const doc of docs) {
      if (!allDocuments.some((d) => d.pdfUrl === doc.pdfUrl)) {
        allDocuments.push(doc);
      }
    }
  }

  return allDocuments;
}
