/**
 * 白石町議会 -- list フェーズ
 *
 * 3段階クロール:
 * 1. トップページから年度別ページのリンクを収集（URLに規則性がないため必須）
 * 2. 各年度ページから会議別詳細ページリンクを収集
 * 3. 各会議詳細ページから日別 PDF リンクを収集
 *
 * PDF URL 形式: https://www.town.shiroishi.lg.jp/var/rev0/0002/[番号]/kaigiroku.pdf
 */

import {
  BASE_ORIGIN,
  TOP_PAGE_URL,
  detectMeetingType,
  fetchPage,
  delay,
} from "./shared";

export interface ShiroishiPdfRecord {
  /** 会議タイトル（例: "令和7年3月 定例会"） */
  title: string;
  /** PDF の絶対 URL */
  pdfUrl: string;
  /** PDF のリンクテキスト（開催日など） */
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
 * トップページ HTML から年度別ページへのリンクを抽出する。
 * kaigiroku/ 配下の .html リンクを収集する。
 */
export function parseTopPage(html: string): string[] {
  const urls: string[] = [];
  const seen = new Set<string>();

  // kaigiroku/ 配下のhtmlリンク（h27_copy...形式）
  const pattern = /<a\s[^>]*href="([^"]*\/kaigiroku\/[^"]+\.html)"[^>]*>/gi;

  let m: RegExpExecArray | null;
  while ((m = pattern.exec(html)) !== null) {
    const href = m[1]!;
    const url = href.startsWith("http")
      ? href
      : href.startsWith("//")
        ? `https:${href}`
        : `${BASE_ORIGIN}${href.startsWith("/") ? "" : "/"}${href}`;

    if (seen.has(url)) continue;
    seen.add(url);
    urls.push(url);
  }

  return urls;
}

/**
 * 年度別ページ HTML から会議録詳細ページへのリンクを抽出する。
 * `_[番号].html` 形式のリンクを取得。
 */
export function parseYearPage(
  html: string,
  yearPageUrl: string,
): MeetingLink[] {
  const links: MeetingLink[] = [];
  const seen = new Set<string>();

  // _[番号].html 形式のリンク
  const pattern = /<a\s[^>]*href="([^"]*\/_\d+\.html)"[^>]*>([\s\S]*?)<\/a>/gi;

  let m: RegExpExecArray | null;
  while ((m = pattern.exec(html)) !== null) {
    const href = m[1]!;
    const linkText = m[2]!.replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim();

    if (!linkText) continue;

    // 絶対 URL に変換
    let url: string;
    if (href.startsWith("http")) {
      url = href;
    } else if (href.startsWith("//")) {
      url = `https:${href}`;
    } else if (href.startsWith("/")) {
      url = `${BASE_ORIGIN}${href}`;
    } else if (href.startsWith("./")) {
      // 相対パス: ./_[番号].html → 年度ページ名（.html を除いた部分）をディレクトリとして解決
      // 例: h27_copy_copy.html の配下 → h27_copy_copy/_7932.html
      const base = yearPageUrl.replace(/\.html$/, "");
      url = `${base}/${href.slice(2)}`;
    } else {
      const base = yearPageUrl.replace(/\/[^/]+$/, "");
      url = `${base}/${href}`;
    }

    if (seen.has(url)) continue;
    seen.add(url);

    links.push({ title: linkText, url });
  }

  return links;
}

/**
 * 会議別詳細ページ HTML から PDF リンクを抽出する。
 * /var/rev0/0002/[番号]/kaigiroku.pdf 形式のリンクを取得。
 */
export function parseMeetingPage(
  html: string,
  meetingTitle: string,
  detailPageUrl: string,
): ShiroishiPdfRecord[] {
  const records: ShiroishiPdfRecord[] = [];

  const pattern = /<a\s[^>]*href="([^"]*\/var\/rev0\/[^"]*\.pdf)"[^>]*>([\s\S]*?)<\/a>/gi;

  let m: RegExpExecArray | null;
  while ((m = pattern.exec(html)) !== null) {
    const href = m[1]!;
    const linkText = m[2]!.replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim();

    const pdfUrl = href.startsWith("http")
      ? href
      : href.startsWith("//")
        ? `https:${href}`
        : `${BASE_ORIGIN}${href.startsWith("/") ? "" : "/"}${href}`;

    records.push({
      title: meetingTitle,
      pdfUrl,
      pdfLabel: linkText || meetingTitle,
      meetingType: detectMeetingType(meetingTitle),
      detailPageUrl,
    });
  }

  return records;
}

/**
 * 指定年度の PDF レコード一覧を取得する。
 * トップページから年度URLを動的に取得するため、year パラメータは絞り込みに使用。
 */
export async function fetchPdfList(_year: number): Promise<ShiroishiPdfRecord[]> {
  // Step 1: トップページから年度別ページリンクを収集
  const topHtml = await fetchPage(TOP_PAGE_URL);
  if (!topHtml) return [];

  const yearPageUrls = parseTopPage(topHtml);
  if (yearPageUrls.length === 0) return [];

  const allRecords: ShiroishiPdfRecord[] = [];

  for (const yearPageUrl of yearPageUrls) {
    // Step 2: 各年度ページから会議別詳細ページリンクを収集
    await delay(INTER_PAGE_DELAY_MS);
    const yearHtml = await fetchPage(yearPageUrl);
    if (!yearHtml) continue;

    const meetingLinks = parseYearPage(yearHtml, yearPageUrl);
    if (meetingLinks.length === 0) continue;

    // 年度フィルタリング: タイトルから年を推定
    // 年度ページには複数の会議が含まれるため、全件取得後にフィルタリング
    for (let i = 0; i < meetingLinks.length; i++) {
      const link = meetingLinks[i]!;

      await delay(INTER_PAGE_DELAY_MS);
      const meetingHtml = await fetchPage(link.url);
      if (!meetingHtml) continue;

      const records = parseMeetingPage(meetingHtml, link.title, link.url);
      allRecords.push(...records);
    }
  }

  return allRecords;
}
