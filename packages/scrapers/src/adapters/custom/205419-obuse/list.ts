/**
 * 小布施町議会 -- list フェーズ
 *
 * 2段階クロール:
 *   1. トップページ /diet/minutes/ から年度リンクを収集
 *   2. 各年度ページ /diet/minutes/{年度}/ から会議詳細ページ URL を収集
 *
 * トップページ構造:
 *   /diet/minutes/{年度}/ 形式のリンクが掲載されている
 *
 * 年度ページ構造:
 *   会議名テキスト（例: "令和7年3月会議"）と
 *   詳細ページリンク /docs/{ID}.html が掲載されている
 */

import { BASE_ORIGIN, fetchPage, LIST_TOP_URL, parseWarekiYear } from "./shared";

export interface ObuseSession {
  /** 詳細ページ URL (e.g., https://www.town.obuse.nagano.jp/docs/r7_3.html) */
  detailUrl: string;
  /** 会議タイトル (e.g., "令和7年3月会議") */
  sessionTitle: string;
  /** 西暦年（フィルタリング用） */
  year: number | null;
}

/**
 * トップページの HTML から年度別ページリンクを抽出する（テスト可能な純粋関数）。
 *
 * リンクパターン: href="/diet/minutes/{4桁数字}/"
 */
export function parseTopPage(html: string): string[] {
  const urls: string[] = [];
  const seen = new Set<string>();

  const linkPattern = /href="(\/diet\/minutes\/(\d{4})\/)"/gi;

  for (const match of html.matchAll(linkPattern)) {
    const href = match[1]!;
    const url = `${BASE_ORIGIN}${href}`;
    if (!seen.has(url)) {
      seen.add(url);
      urls.push(url);
    }
  }

  return urls;
}

/**
 * 年度ページの HTML から会議詳細ページリンクを抽出する（テスト可能な純粋関数）。
 *
 * リンクパターン: href="/docs/{ID}.html"
 * テキストパターン: "令和7年3月会議" など
 */
export function parseYearPage(html: string): ObuseSession[] {
  const results: ObuseSession[] = [];
  const seen = new Set<string>();

  // /docs/{任意文字}.html 形式のリンクを抽出
  const linkPattern = /<a[^>]+href="(\/docs\/[^"]+\.html)"[^>]*>([\s\S]*?)<\/a>/gi;

  for (const match of html.matchAll(linkPattern)) {
    const href = match[1]!;
    const rawText = match[2]!.replace(/<[^>]+>/g, "").trim();

    // 全角数字を半角に正規化
    const title = rawText.replace(/[０-９]/g, (c) =>
      String.fromCharCode(c.charCodeAt(0) - 0xfee0),
    );

    // 「会議」を含むリンクのみを対象にする（会議録以外のリンクを除外）
    if (!title.includes("会議")) continue;

    const detailUrl = `${BASE_ORIGIN}${href}`;

    // 重複スキップ
    if (seen.has(detailUrl)) continue;
    seen.add(detailUrl);

    // 和暦年を西暦に変換
    const year = parseWarekiYear(title);

    results.push({ detailUrl, sessionTitle: title, year });
  }

  return results;
}

/**
 * 会議詳細ページの HTML から会議録 PDF リンクを抽出する（テスト可能な純粋関数）。
 *
 * PDF リンクパターン:
 *   - 絶対 URL: href="https://www.town.obuse.nagano.jp/fs/..."
 *   - 相対 URL: href="/fs/..."
 * ファイル名に「会議録」を含むものを対象とする
 */
export function parseDetailPagePdfs(html: string): string[] {
  const pdfs: string[] = [];
  const seen = new Set<string>();

  // .pdf で終わるリンクを抽出（絶対 URL または相対 URL）
  const pdfPattern = /href="((?:https?:\/\/[^"]+|\/[^"]+)\.pdf)"/gi;

  for (const match of html.matchAll(pdfPattern)) {
    const rawUrl = match[1]!;

    // 相対 URL を絶対 URL に変換
    const url = rawUrl.startsWith("/")
      ? `${BASE_ORIGIN}${rawUrl}`
      : rawUrl;

    // URL エンコードされたファイル名に「会議録」を含むかチェック
    // エンコード前後どちらにも対応: %E4%BC%9A%E8%AD%B0%E9%8C%B2 = 会議録
    const hasMinutes =
      url.includes("%E4%BC%9A%E8%AD%B0%E9%8C%B2") ||
      url.includes("会議録") ||
      url.toLowerCase().includes("kaigiroku");

    if (!hasMinutes) continue;
    if (seen.has(url)) continue;
    seen.add(url);
    pdfs.push(url);
  }

  return pdfs;
}

/**
 * PDF ファイル名から開催日と会議情報を抽出する。
 *
 * パターン: 令和7年3月3日会議録第1号.pdf
 * → { year: 2025, month: 3, day: 3, number: 1 }
 */
export interface PdfMeta {
  heldOnLabel: string; // 例: "令和7年3月3日"
  number: number;
}

export function parsePdfFileName(fileName: string): PdfMeta | null {
  // URL デコード
  let decoded = fileName;
  try {
    decoded = decodeURIComponent(fileName);
  } catch {
    // デコード失敗時はそのまま使用
  }

  // ファイル名部分を取得（パスの最後）
  const baseName = decoded.split("/").pop() ?? decoded;

  const match = baseName.match(
    /((?:令和|平成)(?:元|\d+)年\d+月\d+日)会議録第(\d+)号/,
  );
  if (!match) return null;

  return {
    heldOnLabel: match[1]!,
    number: parseInt(match[2]!, 10),
  };
}

/**
 * トップページと年度ページを巡回して、指定年の会議セッション一覧を取得する。
 */
export async function fetchSessionList(year: number): Promise<ObuseSession[]> {
  const topHtml = await fetchPage(LIST_TOP_URL);
  if (!topHtml) return [];

  const yearUrls = parseTopPage(topHtml);

  const results: ObuseSession[] = [];

  for (const yearUrl of yearUrls) {
    const yearHtml = await fetchPage(yearUrl);
    if (!yearHtml) continue;

    const sessions = parseYearPage(yearHtml);
    const filtered = sessions.filter((s) => s.year === year);
    results.push(...filtered);
  }

  return results;
}
