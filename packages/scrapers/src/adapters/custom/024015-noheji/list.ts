/**
 * 野辺地町議会 — list フェーズ
 *
 * 会議録トップページから定例会/臨時会ページ URL を収集し、
 * 各ページから PDF ダウンロードリンクとメタ情報を抽出する。
 *
 * トップページ構造:
 *   <ul class="nav">
 *     <li>
 *       <a href=".../2787/{yearId}">令和X年　会議録</a>
 *       <ul>
 *         <li><a href=".../2787/{sessionPath}">令和X年第N回M月定例会</a></li>
 *       </ul>
 *     </li>
 *   </ul>
 *
 * 定例会ページ構造:
 *   <div class="contents_area">
 *     <p><a href="/download_file/view/{fileID}/{pageID}">本会議第N号（M月DD日）【...】</a></p>
 *   </div>
 */

import { BASE_ORIGIN, LIST_URL, fetchPage, normalizeFullWidth } from "./shared";

export interface NohejiDocument {
  /** 会議セッションタイトル（例: "令和６年第１回３月定例会"） */
  sessionTitle: string;
  /** PDF リンクテキスト（例: "本会議第２号（１２月　９日）【一般質問】"） */
  linkText: string;
  /** PDF ダウンロード URL（リダイレクト元） */
  downloadUrl: string;
  /** 定例会ページ URL（sourceUrl として使用） */
  sessionPageUrl: string;
}

/**
 * トップページ HTML から定例会/臨時会ページへのリンクを抽出する（純粋関数）。
 *
 * <ul class="nav"> 内の第2階層 <li> > <a> を収集する。
 */
export function parseTopPage(html: string): Array<{ url: string; title: string }> {
  const results: Array<{ url: string; title: string }> = [];

  // nav ul 内の第2階層リンクを抽出
  // <ul class="nav"> ... <li> <a ...>年度</a> <ul> <li><a href="...">定例会</a></li> </ul> </li>
  // cheerio なしのため正規表現でブロック抽出
  const navMatch = html.match(/<ul[^>]+class="nav"[^>]*>([\s\S]*?)<\/ul>\s*<\/div>/);
  if (!navMatch) {
    // フォールバック: ul.nav 全体を探す
    const fallback = html.match(/<ul[^>]+class="nav"[^>]*>([\s\S]*)/);
    if (!fallback) return results;
    return parseNavLinks(fallback[1]!, html);
  }

  return parseNavLinks(navMatch[1]!, html);
}

function parseNavLinks(
  _navContent: string,
  fullHtml: string,
): Array<{ url: string; title: string }> {
  const results: Array<{ url: string; title: string }> = [];

  // ul.nav > li > ul > li > a の構造から第2階層リンクを抽出する
  // 各 "定例会" や "臨時会" を含む <a> タグを取得
  const linkRegex =
    /<a[^>]+href="(https?:\/\/www\.town\.noheji\.aomori\.jp\/life\/chosei\/gikai\/2787\/[^"]+)"[^>]*>([^<]+)<\/a>/gi;

  for (const match of fullHtml.matchAll(linkRegex)) {
    const url = match[1]!;
    const title = match[2]!.trim();

    // 年度リンク（例: "令和３年　会議録"）を除外し、定例会/臨時会のみ収集
    if (title.includes("定例会") || title.includes("臨時会")) {
      results.push({ url, title });
    }
  }

  return results;
}

/**
 * 定例会/臨時会ページ HTML から PDF ダウンロードリンクを抽出する（純粋関数）。
 */
export function parseSessionPage(
  html: string,
  sessionTitle: string,
  sessionPageUrl: string,
): NohejiDocument[] {
  const documents: NohejiDocument[] = [];

  // <a href="/download_file/view/{fileID}/{pageID}"> のリンクを収集
  const linkRegex =
    /<a[^>]+href="((?:https?:\/\/www\.town\.noheji\.aomori\.jp)?\/download_file\/view\/[^"]+)"[^>]*>([^<]+)<\/a>/gi;

  for (const match of html.matchAll(linkRegex)) {
    const href = match[1]!;
    const rawText = match[2]!.trim();
    const normalizedText = normalizeFullWidth(rawText);

    // 目次 PDF はスキップ
    if (normalizedText.includes("目次")) continue;

    // 「本会議第N号」形式のリンクのみ収集
    if (!normalizedText.includes("本会議第")) continue;

    const downloadUrl = href.startsWith("http") ? href : `${BASE_ORIGIN}${href}`;

    documents.push({
      sessionTitle,
      linkText: rawText,
      downloadUrl,
      sessionPageUrl,
    });
  }

  return documents;
}

/**
 * セッションタイトルから西暦年を抽出する。
 */
function extractYearFromTitle(title: string): number | null {
  const normalized = normalizeFullWidth(title);
  const reiwaMatch = normalized.match(/令和(元|\d+)年/);
  if (reiwaMatch) {
    const eraYear = reiwaMatch[1] === "元" ? 1 : parseInt(reiwaMatch[1]!, 10);
    return 2018 + eraYear;
  }
  const heiseiMatch = normalized.match(/平成(元|\d+)年/);
  if (heiseiMatch) {
    const eraYear = heiseiMatch[1] === "元" ? 1 : parseInt(heiseiMatch[1]!, 10);
    return 1988 + eraYear;
  }
  return null;
}

/**
 * 会議録トップページを起点に全定例会/臨時会の PDF リンクを収集する。
 * year を指定した場合は開催年でフィルタする。
 */
export async function fetchDocumentList(year?: number): Promise<NohejiDocument[]> {
  const topHtml = await fetchPage(LIST_URL);
  if (!topHtml) return [];

  const sessionLinks = parseTopPage(topHtml);
  const allDocuments: NohejiDocument[] = [];

  for (const { url, title } of sessionLinks) {
    // 年度フィルタ（早期スキップ）
    if (year !== undefined) {
      const titleYear = extractYearFromTitle(title);
      if (titleYear !== null && titleYear !== year) continue;
    }

    const html = await fetchPage(url);
    if (!html) {
      console.warn(`[noheji] session page fetch failed: ${url}`);
      continue;
    }

    const docs = parseSessionPage(html, title, url);
    allDocuments.push(...docs);
  }

  return allDocuments;
}
