/**
 * 越前町議会 — list フェーズ
 *
 * 一覧ページ index.html から全会議録への詳細ページリンクを収集する。
 * 各リンクから会議種別（定例会・臨時会・一般質問）と年月メタ情報を抽出する。
 *
 * ページネーションなしで全件が1ページに列挙されている。
 */

import {
  BASE_PATH,
  INDEX_URL,
  buildHeldOn,
  detectMeetingType,
  extractYearMonth,
  fetchPage,
  isGeneralQuestion,
} from "./shared";

export interface EchizenMeetingLink {
  /** 会議タイトル（リンクテキスト） */
  title: string;
  /** 詳細ページの絶対 URL */
  detailUrl: string;
  /** 詳細ページのパス（例: /chousei/04/06/p009573.html） */
  pagePath: string;
  /** ページ ID（例: p009573） */
  pageId: string;
  /** 会議種別 */
  meetingType: string;
  /** 一般質問会議録かどうか */
  generalQuestion: boolean;
  /** 開催日（YYYY-MM-DD 形式） */
  heldOn: string;
}

/**
 * 一覧ページの HTML からリンクを抽出する（テスト可能な純粋関数）。
 *
 * /chousei/04/06/p{6桁}.html パターンのリンクを収集し、
 * リンクテキストから会議メタ情報を抽出する。
 */
export function parseIndexPage(html: string): EchizenMeetingLink[] {
  const results: EchizenMeetingLink[] = [];
  const seen = new Set<string>();

  const linkPattern = /<a[^>]+href="([^"]*)"[^>]*>([\s\S]*?)<\/a>/gi;

  for (const match of html.matchAll(linkPattern)) {
    const href = match[1]!;
    const rawText = match[2]!.replace(/<[^>]*>/g, "").trim();

    // /chousei/04/06/p{6桁}.html パターンにマッチするリンクのみ
    const pathMatch = href.match(/\/chousei\/04\/06\/(p\d{6})\.html/);
    if (!pathMatch) continue;

    const pageId = pathMatch[1]!;

    // 重複を除外
    if (seen.has(pageId)) continue;
    seen.add(pageId);

    // タイトルが空の場合はスキップ
    if (!rawText) continue;

    const pagePath = `${BASE_PATH}/${pageId}.html`;
    const detailUrl = `https://www.town.echizen.fukui.jp${pagePath}`;
    const generalQuestion = isGeneralQuestion(rawText);
    const meetingType = generalQuestion ? "plenary" : detectMeetingType(rawText);
    const { year, month } = extractYearMonth(rawText);
    const heldOn = buildHeldOn(year, month);

    results.push({
      title: rawText,
      detailUrl,
      pagePath,
      pageId,
      meetingType,
      generalQuestion,
      heldOn,
    });
  }

  return results;
}

/**
 * 指定年度の会議録リンクを一覧ページから取得する。
 */
export async function fetchMeetingLinks(
  year: number,
): Promise<EchizenMeetingLink[]> {
  const html = await fetchPage(INDEX_URL);
  if (!html) return [];

  const allLinks = parseIndexPage(html);

  // 年度でフィルタ
  return allLinks.filter((link) => {
    const { year: linkYear } = extractYearMonth(link.title);
    return linkYear === year;
  });
}
