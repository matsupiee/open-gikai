/**
 * 江別市議会 会議録 — list フェーズ
 *
 * 1. トップページ GET → 本会議・委員会の年度別リンクを取得
 * 2. 対象年の年度ページを GET → 個別会議録リンクを抽出
 *
 * サイト構造:
 *   トップ: /site/gijiroku1/
 *   年度ページ: /site/gijiroku1/{id}.html （本会議・委員会それぞれ別）
 *   会議録: /site/gijiroku1/{id}.html （h4 タグで発言者、テキストで発言内容）
 */

import {
  BASE_ORIGIN,
  fetchPage,
  toJapaneseEraPatterns,
  stripHtml,
} from "./shared";

export interface EbetsuDocument {
  /** ページ ID（URL パスから抽出: "144862" など） */
  pageId: string;
  /** 会議録ページの絶対 URL */
  url: string;
  /** リンクテキスト（例: "令和7年2月20日（初日）"） */
  title: string;
  /** 所属セクション（例: "第1回定例会", "総務文教常任委員会"） */
  section: string;
}

/**
 * トップページ HTML から対象年の「○○年分の目次」リンク URL を抽出する。
 */
export function parseYearPageUrls(html: string, year: number): string[] {
  const patterns = toJapaneseEraPatterns(year);
  const urls: string[] = [];

  const linkRegex =
    /<a\s[^>]*href="([^"]*\/site\/gijiroku1\/[^"]+\.html)"[^>]*>([\s\S]*?)<\/a>/gi;

  let match: RegExpExecArray | null;
  while ((match = linkRegex.exec(html)) !== null) {
    const href = match[1]!;
    const text = stripHtml(match[2]!).trim();
    if (text.includes("目次") && patterns.some((p) => text.includes(p))) {
      const url = href.startsWith("http") ? href : `${BASE_ORIGIN}${href}`;
      urls.push(url);
    }
  }

  return urls;
}

/**
 * 年度ページ HTML から個別会議録リンクを抽出する。
 *
 * HTML 構造:
 *   <h2>セクション名</h2> or <h3>セクション名</h3>
 *   <ul>
 *     <li><a href="/site/gijiroku1/XXXXX.html">リンクテキスト</a></li>
 *   </ul>
 */
export function parseMeetingLinks(html: string): EbetsuDocument[] {
  const records: EbetsuDocument[] = [];
  let currentSection = "";

  const tokenRegex =
    /<(h[23])[^>]*>([\s\S]*?)<\/\1>|<a\s[^>]*href="([^"]*\/site\/gijiroku1\/(\d+)\.html)"[^>]*>([\s\S]*?)<\/a>/gi;

  let token: RegExpExecArray | null;
  while ((token = tokenRegex.exec(html)) !== null) {
    if (token[1]) {
      // h2/h3 見出し → セクション更新
      currentSection = stripHtml(token[2]!).trim();
    } else if (token[3] && token[4] && token[5]) {
      const href = token[3];
      const pageId = token[4];
      const linkText = stripHtml(token[5]).trim();

      // ナビゲーション・メニューリンクを除外
      if (!linkText || linkText.includes("目次") || linkText.includes("一覧")) {
        continue;
      }

      // PDF リンクを除外（一部の委員会は PDF のみ）
      if (href.endsWith(".pdf")) continue;

      const url = href.startsWith("http") ? href : `${BASE_ORIGIN}${href}`;

      // 重複チェック
      if (records.some((r) => r.pageId === pageId)) continue;

      records.push({ pageId, url, title: linkText, section: currentSection });
    }
  }

  return records;
}

/**
 * 指定年の会議録リンクを取得する。
 * 本会議・委員会の両方を対象とする。
 */
export async function fetchDocumentList(
  baseUrl: string,
  year: number,
): Promise<EbetsuDocument[]> {
  const topHtml = await fetchPage(baseUrl);
  if (!topHtml) return [];

  const yearPageUrls = parseYearPageUrls(topHtml, year);
  if (yearPageUrls.length === 0) return [];

  const allRecords: EbetsuDocument[] = [];

  for (const yearPageUrl of yearPageUrls) {
    const html = await fetchPage(yearPageUrl);
    if (!html) continue;

    const records = parseMeetingLinks(html);
    for (const record of records) {
      if (!allRecords.some((r) => r.pageId === record.pageId)) {
        allRecords.push(record);
      }
    }
  }

  return allRecords;
}
