/**
 * 牟岐町議会 — list フェーズ
 *
 * 定例会カテゴリ一覧ページをページネーションに従ってクロールし、
 * 各会議詳細ページの URL を収集する。
 * 詳細ページから PDF リンクと開催日を抽出し、PDF ごとに 1 レコードを返す。
 */

import {
  BASE_ORIGIN,
  detectMeetingType,
  parseWarekiYear,
  toHankakuDigits,
  fetchPage,
  delay,
} from "./shared";

export interface MugiPdfRecord {
  /** 会議タイトル（例: "令和７年第４回牟岐町議会定例会"） */
  title: string;
  /** 各 PDF の説明テキスト（例: "一般質問（堀内）"） */
  pdfLabel: string;
  /** PDF の絶対 URL */
  pdfUrl: string;
  /** 会議種別 */
  meetingType: string;
  /** 詳細ページの doc ID */
  docId: string;
  /** 開催日 YYYY-MM-DD（詳細ページ HTML から取得）。取得できない場合は null */
  heldOn: string | null;
}

const INTER_PAGE_DELAY_MS = 1500;

/**
 * 指定年度の全 PDF レコードを収集する。
 */
export async function fetchDocumentList(year: number): Promise<MugiPdfRecord[]> {
  const allRecords: MugiPdfRecord[] = [];

  // Step 1: 一覧ページから全会議リンクを収集
  const meetingLinks = await fetchAllMeetingLinks();

  // Step 2: 対象年度に絞り込み
  const targetLinks = meetingLinks.filter((link) => {
    const seirekiYear = parseWarekiYear(link.title);
    return seirekiYear !== null && seirekiYear === year;
  });

  // Step 3: 各詳細ページから PDF リンクと開催日を収集
  for (const link of targetLinks) {
    await delay(INTER_PAGE_DELAY_MS);

    const pageHtml = await fetchPage(link.url);
    if (!pageHtml) continue;

    const heldOn = parseHeldOnFromHtml(pageHtml);
    const records = extractPdfLinks(pageHtml, link.title, link.docId, link.url, heldOn);
    allRecords.push(...records);
  }

  return allRecords;
}

// --- HTML パーサー（テスト用に export） ---

export interface MeetingLink {
  title: string;
  url: string;
  docId: string;
}

/**
 * 一覧ページから全ページをクロールして会議リンクを収集する。
 */
async function fetchAllMeetingLinks(): Promise<MeetingLink[]> {
  const allLinks: MeetingLink[] = [];

  // 最大 10 ページ
  for (let page = 1; page <= 10; page++) {
    if (page > 1) await delay(INTER_PAGE_DELAY_MS);

    const url =
      page === 1
        ? `${BASE_ORIGIN}/category/gikai/teirei/more@docs_1.html`
        : `${BASE_ORIGIN}/category/gikai/teirei/more@docs_1.p${page}.html`;

    const html = await fetchPage(url);
    if (!html) break;

    const links = parseMeetingLinks(html);
    if (links.length === 0) break;

    allLinks.push(...links);
  }

  // 重複排除
  const seen = new Set<string>();
  return allLinks.filter((link) => {
    if (seen.has(link.docId)) return false;
    seen.add(link.docId);
    return true;
  });
}

/**
 * 一覧ページ HTML から会議詳細ページリンクを抽出する（純粋関数）。
 * リンク形式: <a href="/doc/{記事ID}/">令和７年第４回牟岐町議会定例会</a>
 */
export function parseMeetingLinks(html: string): MeetingLink[] {
  const links: MeetingLink[] = [];
  const seen = new Set<string>();

  const pattern = /<a\s[^>]*href="\/doc\/(\w+)\/?[^"]*"[^>]*>([^<]+)<\/a>/gi;

  let m: RegExpExecArray | null;
  while ((m = pattern.exec(html)) !== null) {
    const docId = m[1]!;
    const title = m[2]!.replace(/\s+/g, " ").trim();

    // 牟岐町議会に関する議会リンクのみ対象
    if (!title.includes("議会") && !title.includes("牟岐")) continue;
    // 年号を含まないリンクは除外
    if (!title.match(/令和|平成/)) continue;

    if (seen.has(docId)) continue;
    seen.add(docId);

    links.push({
      title,
      url: `${BASE_ORIGIN}/doc/${docId}/`,
      docId,
    });
  }

  return links;
}

/**
 * 詳細ページ HTML から開催日を抽出する（純粋関数）。
 * 形式: 「令和６年１２月１０日（火）　開会：９時３０分」
 */
export function parseHeldOnFromHtml(html: string): string | null {
  const normalized = toHankakuDigits(html);

  // 令和 X 年 X 月 X 日 パターン
  const reiwaMatch = normalized.match(/令和(\d+|元)年(\d{1,2})月(\d{1,2})日/);
  if (reiwaMatch) {
    const nengo = reiwaMatch[1] === "元" ? 1 : parseInt(reiwaMatch[1]!, 10);
    const seireki = 2018 + nengo;
    const month = parseInt(reiwaMatch[2]!, 10);
    const day = parseInt(reiwaMatch[3]!, 10);
    return `${seireki}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
  }

  const heiseiMatch = normalized.match(/平成(\d+|元)年(\d{1,2})月(\d{1,2})日/);
  if (heiseiMatch) {
    const nengo = heiseiMatch[1] === "元" ? 1 : parseInt(heiseiMatch[1]!, 10);
    const seireki = 1988 + nengo;
    const month = parseInt(heiseiMatch[2]!, 10);
    const day = parseInt(heiseiMatch[3]!, 10);
    return `${seireki}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
  }

  return null;
}

/**
 * 詳細ページ HTML から PDF リンクを抽出する（純粋関数）。
 * PDF は `file_contents/` 配下に配置される。
 */
export function extractPdfLinks(
  html: string,
  title: string,
  docId: string,
  pageUrl: string,
  heldOn: string | null
): MugiPdfRecord[] {
  const records: MugiPdfRecord[] = [];

  const meetingType = detectMeetingType(title);

  // PDF リンクを抽出
  const pdfPattern = /<a\s[^>]*href="([^"]*file_contents\/[^"]*\.pdf)"[^>]*>([^<]*)<\/a>/gi;

  let m: RegExpExecArray | null;
  while ((m = pdfPattern.exec(html)) !== null) {
    const href = m[1]!;
    const label = m[2]!.replace(/\s+/g, " ").trim();

    // 絶対 URL を構築
    const absoluteUrl = new URL(href, pageUrl).toString();

    records.push({
      title,
      pdfLabel: label,
      pdfUrl: absoluteUrl,
      meetingType,
      docId,
      heldOn,
    });
  }

  return records;
}
