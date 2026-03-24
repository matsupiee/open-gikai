/**
 * 南越前町議会 — list フェーズ
 *
 * 年度別インデックスページから会議録リンクを収集する。
 * 各リンクから会議種別と年月メタ情報を抽出する。
 *
 * ページネーションなしで全件が1ページに列挙されている。
 */

import {
  BASE_ORIGIN,
  BASE_KAIGIROKU_PATH,
  NENDO_CODE_MAP,
  buildHeldOn,
  buildNendoIndexUrl,
  buildPdfUrl,
  delay,
  detectMeetingType,
  extractYearMonth,
  fetchPage,
} from "./shared";

export interface MinamiechizeMeetingLink {
  /** 会議タイトル（リンクテキスト） */
  title: string;
  /** 詳細ページの絶対 URL */
  detailUrl: string;
  /** PDF の絶対 URL */
  pdfUrl: string;
  /** ページ ID（例: p010808） */
  pageId: string;
  /** 年度コード（例: r6） */
  nendoCode: string;
  /** 会議種別 */
  meetingType: string;
  /** 開催日（YYYY-MM-DD 形式）または null */
  heldOn: string | null;
}

/**
 * 年度別一覧ページの HTML からリンクを抽出する（テスト可能な純粋関数）。
 *
 * p{ID}.html パターンのリンクを収集し、リンクテキストから会議メタ情報を抽出する。
 */
export function parseListPage(html: string, nendoCode: string): MinamiechizeMeetingLink[] {
  const results: MinamiechizeMeetingLink[] = [];
  const seen = new Set<string>();

  const linkPattern = /<a[^>]+href="([^"]*)"[^>]*>([\s\S]*?)<\/a>/gi;

  for (const match of html.matchAll(linkPattern)) {
    const href = match[1]!;
    const rawText = match[2]!.replace(/<[^>]*>/g, "").trim();

    // p{ID}.html パターンにマッチするリンクのみ（相対パス or 絶対パス）
    let pageId: string | null = null;

    // 相対パス: p010808.html
    const relMatch = href.match(/^(p\d+)\.html$/);
    if (relMatch) {
      pageId = relMatch[1]!;
    } else {
      // 絶対パス: /tyougikai/kaigiroku/r6/p010808.html
      const absMatch = href.match(/\/tyougikai\/kaigiroku\/[^/]+\/(p\d+)\.html/);
      if (absMatch) {
        pageId = absMatch[1]!;
      }
    }

    if (!pageId) continue;

    // 重複を除外
    if (seen.has(pageId)) continue;
    seen.add(pageId);

    // タイトルが空の場合はスキップ
    if (!rawText) continue;

    const detailUrl = `${BASE_ORIGIN}${BASE_KAIGIROKU_PATH}/${nendoCode}/${pageId}.html`;
    const pdfUrl = buildPdfUrl(nendoCode, pageId);
    const meetingType = detectMeetingType(rawText);
    const { year, month } = extractYearMonth(rawText);
    const heldOn = buildHeldOn(year, month);

    results.push({
      title: rawText,
      detailUrl,
      pdfUrl,
      pageId,
      nendoCode,
      meetingType,
      heldOn,
    });
  }

  return results;
}

/**
 * 指定年の会議録リンクを全年度コードから取得する。
 */
export async function fetchDocumentList(year: number): Promise<MinamiechizeMeetingLink[]> {
  const allLinks: MinamiechizeMeetingLink[] = [];

  const nendoCodes = Object.keys(NENDO_CODE_MAP);

  for (let i = 0; i < nendoCodes.length; i++) {
    const nendoCode = nendoCodes[i]!;
    const url = buildNendoIndexUrl(nendoCode);
    const html = await fetchPage(url);
    if (!html) {
      if (i < nendoCodes.length - 1) await delay(1000);
      continue;
    }

    const links = parseListPage(html, nendoCode);

    // 指定年にマッチするリンクのみ追加
    for (const link of links) {
      const { year: linkYear } = extractYearMonth(link.title);
      if (linkYear === year) {
        allLinks.push(link);
      }
    }

    if (i < nendoCodes.length - 1) await delay(1000);
  }

  return allLinks;
}
