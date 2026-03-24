/**
 * 江北町議会 -- list フェーズ
 *
 * 2段階クロール:
 * 1. 年度別一覧ページから会議録詳細ページリンクを収集
 * 2. 各詳細ページから PDF リンクを収集
 *
 * 令和2年以降: list[番号].html → kiji[番号]/index.html
 * 平成25〜30年: kiji[番号]/index.html（年度一覧自体が kiji ページ）
 */

import {
  BASE_ORIGIN,
  YEAR_LIST_URLS,
  detectMeetingType,
  fetchPage,
  delay,
} from "./shared";

export interface KohokuPdfRecord {
  /** 会議タイトル（例: "令和8年1月 臨時会　会議録"） */
  title: string;
  /** PDF の絶対 URL */
  pdfUrl: string;
  /** PDF のリンクテキスト */
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
 * <a href="...kiji[番号]/index.html"> パターンにマッチするリンクを取得。
 */
export function parseListPage(html: string): MeetingLink[] {
  const links: MeetingLink[] = [];
  const seen = new Set<string>();

  const pattern =
    /<a\s[^>]*href="([^"]*\/kiji\d+\/index\.html)"[^>]*>([\s\S]*?)<\/a>/gi;

  let m: RegExpExecArray | null;
  while ((m = pattern.exec(html)) !== null) {
    const href = m[1]!;
    const linkText = m[2]!.replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim();

    if (!linkText) continue;

    // ナビゲーションメニューなど非会議録リンクを除外する
    // 会議録リンクは「定例会」「臨時会」「会議録」を含む
    if (
      !linkText.includes("定例会") &&
      !linkText.includes("臨時会") &&
      !linkText.includes("会議録")
    )
      continue;

    const url = href.startsWith("http")
      ? href
      : href.startsWith("//")
        ? `https:${href}`
        : `${BASE_ORIGIN}${href.startsWith("/") ? "" : "/"}${href}`;

    if (seen.has(url)) continue;
    seen.add(url);

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
): KohokuPdfRecord[] {
  const records: KohokuPdfRecord[] = [];

  const pattern = /<a\s[^>]*href="([^"]*\.pdf)"[^>]*>([\s\S]*?)<\/a>/gi;

  let m: RegExpExecArray | null;
  while ((m = pattern.exec(html)) !== null) {
    const href = m[1]!;
    const linkText = m[2]!.replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim();

    if (!linkText) continue;

    const pdfUrl = href.startsWith("http")
      ? href
      : href.startsWith("//")
        ? `https:${href}`
        : `${BASE_ORIGIN}${href.startsWith("/") ? "" : "/"}${href}`;

    // リンクテキストからファイルサイズ情報を除去
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
export async function fetchPdfList(year: number): Promise<KohokuPdfRecord[]> {
  const listUrl = YEAR_LIST_URLS[year];
  if (!listUrl) {
    console.warn(`[414247-kohoku] 年度 ${year} の URL が未登録`);
    return [];
  }

  // Step 1: 年度別一覧ページから会議録詳細ページリンクを収集
  const listHtml = await fetchPage(listUrl);
  if (!listHtml) return [];

  const meetingLinks = parseListPage(listHtml);
  if (meetingLinks.length === 0) return [];

  // Step 2: 各詳細ページから PDF リンクを収集
  const allRecords: KohokuPdfRecord[] = [];

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
