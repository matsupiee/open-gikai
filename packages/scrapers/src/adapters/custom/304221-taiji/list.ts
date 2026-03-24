/**
 * 太地町議会 — list フェーズ
 *
 * スクレイピング戦略:
 * 1. kaigiroku.html から .pdf および .docx リンクを全件取得する
 * 2. 相対 URL を絶対 URL に変換する
 * 3. ファイル名に mokuzi・mokugi を含むものを目次として除外する
 *
 * 各 PDF/DOCX が fetchDetail の1レコードに対応する。
 */

import {
  BASE_ORIGIN,
  LIST_URL,
  detectMeetingType,
  fetchPage,
} from "./shared";

export interface TaijiSessionInfo {
  /** 会議タイトル（リンクテキストまたはファイル名から生成） */
  title: string;
  /** 開催日 YYYY-MM-DD（解析できないため null） */
  heldOn: string | null;
  /** ファイルの絶対 URL */
  pdfUrl: string;
  /** 会議種別 */
  meetingType: string;
  /** ファイル名（externalId 生成用） */
  fileName: string;
}

/**
 * ファイル名が目次かどうかを判定する。
 *
 * 「mokuzi」「mokugi」を含むファイル名は目次として除外する。
 */
export function isTocFileName(fileName: string): boolean {
  const lower = fileName.toLowerCase();
  return lower.includes("mokuzi") || lower.includes("mokugi") || lower.includes("mokuji");
}

/**
 * リンクテキストまたはファイル名から会議タイトルを組み立てる。
 *
 * リンクテキストが空、または不明瞭な場合はファイル名をそのまま使用する。
 */
export function buildTitleFromLink(linkText: string, fileName: string): string {
  const cleaned = linkText.replace(/\s+/g, " ").trim();
  if (cleaned.length > 0) {
    return cleaned;
  }
  return fileName;
}

/**
 * 会議録一覧ページ HTML から PDF/DOCX リンクを抽出する（純粋関数）。
 *
 * リンク形式:
 *   <a href="files/{ファイル名}.pdf">...</a>
 *   <a href="files/{ファイル名}.docx">...</a>
 */
export function parseListPage(html: string): TaijiSessionInfo[] {
  const results: TaijiSessionInfo[] = [];
  const seen = new Set<string>();

  // href に .pdf または .docx を含むリンクを全件取得
  const linkPattern = /href="([^"]*\.(pdf|docx))"[^>]*>([\s\S]*?)<\/a>/gi;

  let m: RegExpExecArray | null;
  while ((m = linkPattern.exec(html)) !== null) {
    const href = m[1]!;
    const linkText = m[3]!.replace(/<[^>]+>/g, "").trim();

    // 相対 URL を絶対 URL に変換
    let pdfUrl: string;
    if (href.startsWith("http://") || href.startsWith("https://")) {
      pdfUrl = href;
    } else if (href.startsWith("/")) {
      pdfUrl = `${BASE_ORIGIN}${href}`;
    } else {
      // 相対パス（例: "files/R704.pdf" → gikai/ 配下）
      pdfUrl = `${BASE_ORIGIN}/gikai/${href}`;
    }

    if (seen.has(pdfUrl)) continue;
    seen.add(pdfUrl);

    // ファイル名を取得
    const fileName = pdfUrl.split("/").pop() ?? href;

    // 目次ファイルを除外
    if (isTocFileName(fileName)) continue;

    const title = buildTitleFromLink(linkText, fileName);

    results.push({
      title,
      heldOn: null,
      pdfUrl,
      meetingType: detectMeetingType(title),
      fileName,
    });
  }

  return results;
}

/**
 * 指定年のセッション一覧を取得する。
 *
 * 太地町は全年度が1ページにまとめて掲載されているため、
 * 全リンクを取得して年度でフィルタリングすることが困難。
 * （ファイル名に体系的な命名規則がないため）
 * year パラメータは受け取るが、現時点では全件を返す。
 */
export async function fetchDocumentList(
  _year: number,
): Promise<TaijiSessionInfo[]> {
  const html = await fetchPage(LIST_URL);
  if (!html) return [];
  return parseListPage(html);
}
