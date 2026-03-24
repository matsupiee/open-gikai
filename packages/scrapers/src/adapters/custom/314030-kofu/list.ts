/**
 * 江府町議会 -- list フェーズ
 *
 * 3 段階クロール:
 *   1. トップページ (/2/1/10/2/) から年度別リンクを取得
 *   2. 各年度ページから会議ごとのリンクを収集
 *      - 定例会: サブページへのリンク
 *      - 臨時会: PDF への直リンク
 *   3. 定例会のサブページから日付別 PDF リンクを収集
 *
 * 返り値: 1 PDF ファイルにつき 1 レコード
 */

import {
  BASE_ORIGIN,
  TOP_PATH,
  detectMeetingType,
  parseWarekiYear,
  fetchPage,
  delay,
  normalizeNumbers,
} from "./shared";

export interface KofuSessionInfo {
  /** 会議タイトル（例: "令和6年 第7回江府町議会12月定例会 12月9日"） */
  title: string;
  /** 開催日 YYYY-MM-DD */
  heldOn: string;
  /** PDF の絶対 URL */
  pdfUrl: string;
  /** 会議種別 */
  meetingType: string;
  /** 外部 ID 用の識別キー（年度ID_会議ID_日付 等） */
  externalKey: string;
}

const INTER_PAGE_DELAY_MS = 1500;

/**
 * トップページから年度別リンクを抽出する。
 * href が /2/1/10/2/{ID}/ の形式であるリンクを収集する。
 */
export function parseYearLinks(html: string): { href: string; text: string }[] {
  const links: { href: string; text: string }[] = [];
  const seen = new Set<string>();

  // /2/1/10/2/{ID}/ の形式のリンクを抽出（トップページ自身は除外）
  const pattern = /<a\s[^>]*href="(\/2\/1\/10\/2\/[^/"]+\/)"[^>]*>([^<]+)<\/a>/gi;

  let m: RegExpExecArray | null;
  while ((m = pattern.exec(html)) !== null) {
    const href = m[1]!;
    const text = m[2]!.replace(/\s+/g, " ").trim();
    if (seen.has(href)) continue;
    seen.add(href);
    links.push({ href, text });
  }

  return links;
}

/**
 * 年度ページから会議リンクを抽出する。
 *
 * 返り値:
 *   - subpageHref: サブページへのリンク（定例会）
 *   - pdfHref: PDF への直リンク（臨時会）
 */
export function parseMeetingLinks(
  html: string,
  yearPageUrl: string
): { title: string; subpageHref?: string; pdfHref?: string }[] {
  const results: { title: string; subpageHref?: string; pdfHref?: string }[] =
    [];

  // PDF 直リンク（臨時会）
  const pdfPattern = /<a\s[^>]*href="([^"]*\.pdf)"[^>]*>([^<]+)<\/a>/gi;
  let m: RegExpExecArray | null;
  while ((m = pdfPattern.exec(html)) !== null) {
    const href = m[1]!;
    const text = m[2]!.replace(/\s+/g, " ").trim();
    const absoluteUrl = new URL(href, yearPageUrl).toString();
    results.push({ title: text, pdfHref: absoluteUrl });
  }

  // サブページリンク（定例会: /2/1/10/2/{yearId}/{meetingId}/ の形式）
  const subPattern =
    /<a\s[^>]*href="(\/2\/1\/10\/2\/[^/"]+\/[^/"]+\/)"[^>]*>([^<]+)<\/a>/gi;
  while ((m = subPattern.exec(html)) !== null) {
    const href = m[1]!;
    const text = m[2]!.replace(/\s+/g, " ").trim();
    results.push({ title: text, subpageHref: href });
  }

  return results;
}

/**
 * 定例会サブページから日付別 PDF リンクを抽出する。
 */
export function parsePdfLinksFromSubpage(
  html: string,
  subpageUrl: string
): { linkText: string; pdfUrl: string }[] {
  const results: { linkText: string; pdfUrl: string }[] = [];

  const pattern = /<a\s[^>]*href="([^"]*\.pdf)"[^>]*>([^<]+)<\/a>/gi;
  let m: RegExpExecArray | null;
  while ((m = pattern.exec(html)) !== null) {
    const href = m[1]!;
    const text = m[2]!.replace(/\s+/g, " ").trim();
    const absoluteUrl = new URL(href, subpageUrl).toString();
    results.push({ linkText: text, pdfUrl: absoluteUrl });
  }

  return results;
}

/**
 * リンクテキストから開催日 (YYYY-MM-DD) を抽出する。
 * 例: "12月9日会議録.pdf" -> 月・日を取得し、年は会議の西暦年を使う
 */
export function parseDateFromLinkText(
  linkText: string,
  year: number
): string | null {
  const normalized = normalizeNumbers(linkText);
  const dateMatch = normalized.match(/(\d{1,2})月(\d{1,2})日/);
  if (!dateMatch) return null;

  const month = parseInt(dateMatch[1]!, 10);
  const day = parseInt(dateMatch[2]!, 10);
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

/**
 * 指定年の全 PDF セッション情報を収集する。
 */
export async function fetchSessionList(
  _baseUrl: string,
  year: number
): Promise<KofuSessionInfo[]> {
  const allSessions: KofuSessionInfo[] = [];

  // Step 1: トップページから年度リンクを取得
  const topUrl = `${BASE_ORIGIN}${TOP_PATH}`;
  const topHtml = await fetchPage(topUrl);
  if (!topHtml) return [];

  const yearLinks = parseYearLinks(topHtml);

  // Step 2: 各年度ページを処理（対象年のみ）
  for (const { href, text: yearText } of yearLinks) {
    // 年度テキストから西暦を推定
    const seirekiYear = parseWarekiYear(yearText);
    if (seirekiYear === null || seirekiYear !== year) continue;

    await delay(INTER_PAGE_DELAY_MS);

    const yearPageUrl = `${BASE_ORIGIN}${href}`;
    const yearHtml = await fetchPage(yearPageUrl);
    if (!yearHtml) continue;

    const meetingLinks = parseMeetingLinks(yearHtml, yearPageUrl);

    // Step 3: 各会議リンクを処理
    for (const meeting of meetingLinks) {
      const meetingType = detectMeetingType(meeting.title);
      const yearId = href.split("/").filter(Boolean).pop() ?? "";

      if (meeting.pdfHref) {
        // 臨時会: PDF 直リンク
        // リンクテキスト or タイトルから日付を抽出
        const heldOn = parseDateFromLinkText(meeting.title, year);
        if (!heldOn) continue;

        const pdfSegment = meeting.pdfHref.split("/").pop() ?? "";
        allSessions.push({
          title: `${year}年 ${meeting.title}`,
          heldOn,
          pdfUrl: meeting.pdfHref,
          meetingType,
          externalKey: `${yearId}_${pdfSegment}`,
        });
      } else if (meeting.subpageHref) {
        // 定例会: サブページから PDF リンクを収集
        await delay(INTER_PAGE_DELAY_MS);

        const subpageUrl = `${BASE_ORIGIN}${meeting.subpageHref}`;
        const subpageHtml = await fetchPage(subpageUrl);
        if (!subpageHtml) continue;

        const pdfLinks = parsePdfLinksFromSubpage(subpageHtml, subpageUrl);
        const meetingId = meeting.subpageHref.split("/").filter(Boolean).pop() ?? "";

        for (const { linkText, pdfUrl } of pdfLinks) {
          const heldOn = parseDateFromLinkText(linkText, year);
          if (!heldOn) continue;

          const pdfSegment = pdfUrl.split("/").pop() ?? "";
          allSessions.push({
            title: `${year}年 ${meeting.title} ${linkText}`,
            heldOn,
            pdfUrl,
            meetingType,
            externalKey: `${yearId}_${meetingId}_${pdfSegment}`,
          });
        }
      }
    }
  }

  return allSessions;
}
