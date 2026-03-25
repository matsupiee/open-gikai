/**
 * 境町議会 — list フェーズ
 *
 * 3段階で PDF リンクを収集する:
 * 1. トップページ (dir000145.html) から年別ディレクトリページ URL を取得
 * 2. 年別ディレクトリページから定例会ページ URL を取得
 * 3. 各定例会ページのテーブルから質問者名と PDF リンクを取得
 */

import { BASE_ORIGIN, eraToWesternYear, fetchPage, toJapaneseEra } from "./shared";

export interface SakaiIbarakiRecord {
  /** 会議タイトル（例: "令和7年第4回定例会"） */
  title: string;
  /** 質問者名（例: "枝　史子"） */
  questioner: string;
  /** 定例会ページの URL */
  pageUrl: string;
  /** 会議録 PDF の URL */
  pdfUrl: string;
}

/**
 * トップページから年別ディレクトリページのリンクを抽出する。
 * href が `page/dir{XXXXXX}.html` 形式のもの。
 */
export function parseTopPage(html: string): { label: string; url: string }[] {
  const results: { label: string; url: string }[] = [];

  const linkRegex = /<a[^>]+href="([^"]*\/page\/dir\d+\.html)"[^>]*>([^<]+)<\/a>/g;

  for (const match of html.matchAll(linkRegex)) {
    const href = match[1]!;
    const label = match[2]!.trim();

    // 年度ラベル: 「令和N年」or「平成N年」
    if (!/(令和|平成)(元|\d+)年/.test(label)) continue;
    // 会議名が含まれる場合はスキップ
    if (label.includes("定例会") || label.includes("臨時会")) continue;

    const url = href.startsWith("http")
      ? href
      : `${BASE_ORIGIN}${href.startsWith("/") ? "" : "/"}${href}`;

    if (!results.some((r) => r.url === url)) {
      results.push({ label, url });
    }
  }

  return results;
}

/**
 * 年別ディレクトリページから定例会ページのリンクを抽出する。
 * href が `page/page{XXXXXX}.html` 形式のもの。
 */
export function parseYearPage(html: string): { title: string; url: string }[] {
  const results: { title: string; url: string }[] = [];

  const linkRegex = /<a[^>]+href="([^"]*\/page\/page\d+\.html)"[^>]*>([^<]+)<\/a>/g;

  for (const match of html.matchAll(linkRegex)) {
    const href = match[1]!;
    const title = match[2]!.trim();

    if (!title.includes("定例会") && !title.includes("臨時会")) continue;

    const url = href.startsWith("http")
      ? href
      : `${BASE_ORIGIN}${href.startsWith("/") ? "" : "/"}${href}`;

    if (!results.some((r) => r.url === url)) {
      results.push({ title, url });
    }
  }

  return results;
}

/**
 * 定例会ページから質問者名と PDF リンクのペアを抽出する。
 * テーブル行から質問者名（リンクテキスト）と PDF URL を取得する。
 *
 * HTML 構造:
 *   <tr>
 *     <td>1</td>
 *     <td><a href="/data/doc/{timestamp}_doc_88_0.pdf">枝　史子</a></td>
 *     ...
 *   </tr>
 */
export function parseSessionPage(
  html: string,
): { questioner: string; pdfUrl: string }[] {
  const results: { questioner: string; pdfUrl: string }[] = [];

  // PDF リンクを持つ <a> タグを抽出
  const linkRegex =
    /<a[^>]+href="([^"]*\/data\/doc\/[^"]+\.pdf)"[^>]*>([\s\S]*?)<\/a>/gi;

  for (const match of html.matchAll(linkRegex)) {
    const href = match[1]!;
    const rawText = match[2]!.replace(/<[^>]+>/g, "").trim();

    if (!rawText) continue;

    const url = href.startsWith("http")
      ? href
      : `${BASE_ORIGIN}${href.startsWith("/") ? "" : "/"}${href}`;

    if (!results.some((r) => r.pdfUrl === url)) {
      results.push({ questioner: rawText, pdfUrl: url });
    }
  }

  return results;
}

/**
 * 会議タイトルから開催年（西暦）を抽出する。
 * e.g., "令和7年第4回定例会" → 2025
 */
export function extractYearFromTitle(title: string): number | null {
  const match = title.match(/(令和|平成)(元|\d+)年/);
  if (!match) return null;
  return eraToWesternYear(match[1]!, match[2]!);
}

/**
 * 指定年の一般質問会議録レコード一覧を取得する。
 */
export async function fetchMeetingList(
  baseUrl: string,
  year: number,
): Promise<SakaiIbarakiRecord[]> {
  // Step 1: トップページから年別ディレクトリページを取得
  const topHtml = await fetchPage(baseUrl);
  if (!topHtml) return [];

  const yearPages = parseTopPage(topHtml);
  const eraTexts = toJapaneseEra(year);

  // 対象年度のディレクトリページを見つける
  const targetPages = yearPages.filter((p) =>
    eraTexts.some((era) => p.label.includes(era)),
  );
  if (targetPages.length === 0) return [];

  // Step 2: 年別ディレクトリページから定例会ページリンクを取得
  const sessionLinks: { title: string; url: string }[] = [];
  for (const page of targetPages) {
    const yearHtml = await fetchPage(page.url);
    if (!yearHtml) continue;
    const links = parseYearPage(yearHtml);
    for (const link of links) {
      const meetingYear = extractYearFromTitle(link.title);
      if (meetingYear === year && !sessionLinks.some((s) => s.url === link.url)) {
        sessionLinks.push(link);
      }
    }
  }

  // Step 3: 各定例会ページから質問者名と PDF リンクを取得
  const records: SakaiIbarakiRecord[] = [];
  for (let i = 0; i < sessionLinks.length; i++) {
    const session = sessionLinks[i]!;
    const pageHtml = await fetchPage(session.url);
    if (!pageHtml) continue;

    const pairs = parseSessionPage(pageHtml);
    for (const pair of pairs) {
      records.push({
        title: session.title,
        questioner: pair.questioner,
        pageUrl: session.url,
        pdfUrl: pair.pdfUrl,
      });
    }

    if (i < sessionLinks.length - 1) {
      await new Promise((r) => setTimeout(r, 1000));
    }
  }

  return records;
}
