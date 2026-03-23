/**
 * 氷川町議会 -- list フェーズ
 *
 * 2段階クロール:
 * 1. 年度別一覧ページから会議録詳細ページリンクを収集
 * 2. 各詳細ページから PDF リンクを収集
 */

import {
  BASE_ORIGIN,
  YEAR_LIST_URLS,
  detectMeetingType,
  fetchPage,
  delay,
} from "./shared";

export interface HikawaPdfRecord {
  /** 会議タイトル（例: "令和6年第5回氷川町議会定例会会議録"） */
  title: string;
  /** PDF の絶対 URL */
  pdfUrl: string;
  /** PDF のリンクテキスト（号数情報付き、例: "令和6年第5回氷川町議会定例会会議録(第1号)"） */
  pdfLabel: string;
  /** 会議種別 */
  meetingType: string;
  /** 詳細ページの URL */
  detailPageUrl: string;
}

export interface MeetingLink {
  /** 会議タイトル */
  title: string;
  /** 詳細ページの絶対 URL */
  url: string;
}

const INTER_PAGE_DELAY_MS = 1500;

/**
 * 年度別一覧ページ HTML から会議録詳細ページへのリンクを抽出する。
 * <a href="...kiji{ID}/index.html"> パターンにマッチするリンクを取得。
 */
export function parseListPage(html: string): MeetingLink[] {
  const links: MeetingLink[] = [];
  const seen = new Set<string>();

  const pattern =
    /<a\s[^>]*href="([^"]*\/gikai\/kiji\d+\/index\.html)"[^>]*>([\s\S]*?)<\/a>/gi;

  let m: RegExpExecArray | null;
  while ((m = pattern.exec(html)) !== null) {
    const href = m[1]!;
    const linkText = m[2]!.replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim();

    if (!linkText) continue;
    if (seen.has(href)) continue;
    seen.add(href);

    const url = href.startsWith("http")
      ? href
      : `${BASE_ORIGIN}${href.startsWith("/") ? "" : "/"}${href}`;

    links.push({ title: linkText, url });
  }

  return links;
}

/**
 * 会議録詳細ページ HTML から PDF リンクを抽出する。
 * href が .pdf で終わるリンクを全件取得。
 */
export function parseDetailPage(
  html: string,
  meetingTitle: string,
  detailPageUrl: string,
): HikawaPdfRecord[] {
  const records: HikawaPdfRecord[] = [];

  const pattern =
    /<a\s[^>]*href="([^"]*\.pdf)"[^>]*>([\s\S]*?)<\/a>/gi;

  let m: RegExpExecArray | null;
  while ((m = pattern.exec(html)) !== null) {
    const href = m[1]!;
    const linkText = m[2]!.replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim();

    if (!linkText) continue;

    const pdfUrl = href.startsWith("http")
      ? href
      : `${BASE_ORIGIN}${href.startsWith("/") ? "" : "/"}${href}`;

    // リンクテキストからファイルサイズ情報を除去して号数ラベルを取得
    const pdfLabel = linkText
      .replace(/[（(]\s*PDF[：:][\s\S]*?[）)]/g, "")
      .trim();

    records.push({
      title: meetingTitle,
      pdfUrl,
      pdfLabel: pdfLabel || meetingTitle,
      meetingType: detectMeetingType(meetingTitle),
      detailPageUrl,
    });
  }

  return records;
}

/**
 * 指定年度の PDF レコード一覧を取得する。
 */
export async function fetchPdfList(year: number): Promise<HikawaPdfRecord[]> {
  const listUrl = YEAR_LIST_URLS[year];
  if (!listUrl) {
    console.warn(`[434680-hikawa] 年度 ${year} の URL が未登録`);
    return [];
  }

  // Step 1: 年度別一覧ページから会議録詳細ページリンクを収集
  const listHtml = await fetchPage(listUrl);
  if (!listHtml) return [];

  const meetingLinks = parseListPage(listHtml);
  if (meetingLinks.length === 0) return [];

  // Step 2: 各詳細ページから PDF リンクを収集
  const allRecords: HikawaPdfRecord[] = [];

  for (let i = 0; i < meetingLinks.length; i++) {
    const link = meetingLinks[i]!;

    const detailHtml = await fetchPage(link.url);
    if (detailHtml) {
      const records = parseDetailPage(detailHtml, link.title, link.url);
      allRecords.push(...records);
    }

    if (i < meetingLinks.length - 1) {
      await delay(INTER_PAGE_DELAY_MS);
    }
  }

  return allRecords;
}
