/**
 * 阿波市議会 -- list フェーズ
 *
 * 1. 一覧ページ (/gikai/category/bunya/kaigiroku) からページネーションを辿り、
 *    全会期のページ URL を収集
 * 2. 各会期ページから PDF リンクを抽出し、セッション日ごとの情報を返す
 *
 * fetchDetail は MeetingData | null を1件返すため、
 * list フェーズでセッション日ごとに1レコードを返す。
 */

import {
  BASE_ORIGIN,
  detectMeetingType,
  parseWarekiYear,
  fetchPage,
  delay,
} from "./shared";

export interface AwaSessionInfo {
  /** 会議タイトル（例: "令和7年第4回定例会会議録 11月25日"） */
  title: string;
  /** 開催日 YYYY-MM-DD */
  heldOn: string;
  /** PDF の絶対 URL */
  pdfUrl: string;
  /** 会議種別 */
  meetingType: string;
  /** 会期ページの ID */
  pageId: string;
}

const INTER_PAGE_DELAY_MS = 1500;

/**
 * 指定年度の全セッション日を収集する。
 * 一覧ページからページネーションを辿り、全会期ページの PDF リンクを収集する。
 */
export async function fetchSessionList(
  _baseUrl: string,
  year: number
): Promise<AwaSessionInfo[]> {
  const allSessions: AwaSessionInfo[] = [];

  // Step 1: 一覧ページからページネーションを辿り、全会期リンクを収集
  const sessionLinks = await fetchAllSessionLinks();

  // Step 2: 対象年度に絞り込み
  const targetLinks = sessionLinks.filter((link) => {
    const seirekiYear = parseWarekiYear(link.title);
    return seirekiYear !== null && seirekiYear === year;
  });

  // Step 3: 各会期ページから PDF リンクを収集
  for (const link of targetLinks) {
    await delay(INTER_PAGE_DELAY_MS);

    const pageHtml = await fetchPage(link.url);
    if (!pageHtml) continue;

    const sessions = extractPdfRecords(pageHtml, link.title, link.pageId, link.url);
    allSessions.push(...sessions);
  }

  return allSessions;
}

/**
 * 一覧ページからページネーションを辿り、全会期のリンクを収集する。
 */
async function fetchAllSessionLinks(): Promise<SessionLink[]> {
  const allLinks: SessionLink[] = [];

  // 1ページ目
  const firstPageUrl = `${BASE_ORIGIN}/gikai/category/bunya/kaigiroku`;
  const firstHtml = await fetchPage(firstPageUrl);
  if (!firstHtml) return [];

  allLinks.push(...parseSessionLinks(firstHtml));

  // ページネーション: more@docs_N.html を辿る
  const maxPages = 10; // 安全上限
  for (let n = 1; n <= maxPages; n++) {
    await delay(INTER_PAGE_DELAY_MS);
    const pageUrl = `${BASE_ORIGIN}/gikai/category/bunya/kaigiroku/more@docs_${n}.html`;
    const html = await fetchPage(pageUrl);
    if (!html) break;

    const links = parseSessionLinks(html);
    if (links.length === 0) break;

    allLinks.push(...links);
  }

  // 重複排除
  const seen = new Set<string>();
  return allLinks.filter((link) => {
    if (seen.has(link.pageId)) return false;
    seen.add(link.pageId);
    return true;
  });
}

// --- HTML パーサー（テスト用に export） ---

export interface SessionLink {
  title: string;
  url: string;
  pageId: string;
}

/**
 * 一覧ページ HTML から会期別ページリンクを抽出する。
 * リンク形式: <a href="/gikai/docs/{ID}/">令和7年第4回定例会会議録</a>
 */
export function parseSessionLinks(html: string): SessionLink[] {
  const links: SessionLink[] = [];
  const seen = new Set<string>();

  const pattern =
    /<a\s[^>]*href="\/gikai\/docs\/(\d+)\/?[^"]*"[^>]*>([^<]+)<\/a>/gi;

  let m: RegExpExecArray | null;
  while ((m = pattern.exec(html)) !== null) {
    const pageId = m[1]!;
    const title = m[2]!.replace(/\s+/g, " ").trim();

    // 会議録リンクのみ対象
    if (!title.includes("会議録")) continue;

    if (seen.has(pageId)) continue;
    seen.add(pageId);

    links.push({
      title,
      url: `${BASE_ORIGIN}/gikai/docs/${pageId}/`,
      pageId,
    });
  }

  return links;
}

/**
 * 会期別ページの HTML から PDF リンクを抽出し、セッション日情報を返す。
 *
 * リンクテキスト例: 令和7年第4回定例会会議録11月25日[PDF：326KB]
 * PDF URL は相対パスで記述: file_contents/kaigiroku071125.pdf
 */
export function extractPdfRecords(
  html: string,
  sessionTitle: string,
  pageId: string,
  pageUrl: string
): AwaSessionInfo[] {
  const records: AwaSessionInfo[] = [];

  const seirekiYear = parseWarekiYear(sessionTitle);
  if (!seirekiYear) return records;

  const meetingType = detectMeetingType(sessionTitle);

  // PDF リンクを抽出
  const pdfPattern =
    /<a\s[^>]*href="([^"]*\.pdf)"[^>]*>([^<]+)<\/a>/gi;

  let m: RegExpExecArray | null;
  while ((m = pdfPattern.exec(html)) !== null) {
    const href = m[1]!;
    const linkText = m[2]!.trim();

    // 開催日を抽出
    const dateMatch = linkText.match(/(\d{1,2})月(\d{1,2})日/);
    if (!dateMatch) continue;

    const month = parseInt(dateMatch[1]!, 10);
    const day = parseInt(dateMatch[2]!, 10);

    const heldOn = `${seirekiYear}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;

    // PDF 絶対 URL を構築
    const absoluteUrl = new URL(href, pageUrl).toString();

    // タイトルから [PDF：...] を除去した部分を使う
    const cleanTitle = sessionTitle.replace(/会議録$/, "").trim();
    const sessionLabel = `${cleanTitle} ${month}月${day}日`;

    records.push({
      title: sessionLabel,
      heldOn,
      pdfUrl: absoluteUrl,
      meetingType,
      pageId,
    });
  }

  return records;
}
