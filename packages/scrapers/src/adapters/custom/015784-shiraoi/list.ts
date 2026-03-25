/**
 * 白老町議会 — list フェーズ
 *
 * クロール構造:
 *   1. トップページ（page2014063000011.html）から年度別ページへのリンクを収集
 *   2. 各年度ページから PDF リンク（/fs/ 配下）を抽出
 *   3. リンクテキスト・セクション見出しから会議種別・開催日のメタ情報を付与
 */

import {
  BASE_URL,
  detectMeetingType,
  fetchPage,
  parseJapaneseDate,
  parseDateFromFilename,
  stripHtml,
} from "./shared";

export const TOP_URL = `${BASE_URL}/docs/page2014063000011.html`;

export interface ShiraoiMeeting {
  /** PDF の完全 URL */
  pdfUrl: string;
  /** 会議タイトル */
  title: string;
  /** 開催日 YYYY-MM-DD（解析できない場合は null） */
  heldOn: string | null;
  /** 会議種別 */
  meetingType: string;
}

/**
 * トップページから年度別ページへのリンク URL を抽出する。
 *
 * `/docs/{ID}.html` 形式のリンクを探す。
 */
export function parseTopPageLinks(html: string): string[] {
  const links: string[] = [];
  const seenUrls = new Set<string>();

  // /docs/{何か}.html 形式のリンクを抽出（トップページ自身は除外）
  const pattern = /href="(\/docs\/(?!page2014063000011)[^"]+\.html)"/gi;
  for (const match of html.matchAll(pattern)) {
    const path = match[1]!;
    const url = `${BASE_URL}${path}`;
    if (!seenUrls.has(url)) {
      seenUrls.add(url);
      links.push(url);
    }
  }

  return links;
}

/**
 * 年度別ページから PDF リンク情報を抽出する。
 *
 * PDF リンクは `/fs/` で始まるパスで提供される。
 * テーブル形式で会議録が一覧表示されており、リンクテキストから会議種別・開催日を推定する。
 */
export function parseYearPage(html: string): ShiraoiMeeting[] {
  const results: ShiraoiMeeting[] = [];
  const seenUrls = new Set<string>();

  // /fs/ 配下の PDF リンクを全て抽出
  const pattern = /href="(\/fs\/[^"]+\.pdf)"/gi;
  for (const match of html.matchAll(pattern)) {
    const path = match[1]!;
    const pdfUrl = `${BASE_URL}${path}`;

    if (seenUrls.has(pdfUrl)) continue;
    seenUrls.add(pdfUrl);

    // このリンクの周辺コンテキストからリンクテキストとタイトルを取得
    const idx = match.index!;
    const contextBefore = html.slice(Math.max(0, idx - 500), idx);
    const contextAfter = html.slice(idx, idx + 300);

    // リンクテキスト（href= の後の > ... </a>）を取得
    const linkTextMatch = contextAfter.match(/href="[^"]*"[^>]*>([\s\S]*?)<\/a>/i);
    const linkText = linkTextMatch ? stripHtml(linkTextMatch[1]!) : "";

    // セクション見出し（th や h2〜h4）からタイトル候補を探す
    let sectionTitle = "";
    const headingMatch = contextBefore.match(/<(?:th|h[2-4])[^>]*>([\s\S]*?)<\/(?:th|h[2-4])>(?:[^<]|<(?!\/(?:th|h[2-4])))*$/i);
    if (headingMatch) {
      sectionTitle = stripHtml(headingMatch[1]!);
    }

    // リンクテキストか見出しから開催日を解析
    let heldOn = parseJapaneseDate(linkText);
    if (!heldOn) {
      heldOn = parseJapaneseDate(sectionTitle);
    }
    // ファイル名から日付を解析（フォールバック）
    if (!heldOn) {
      const filenameMatch = path.match(/\/([^/]+\.pdf)$/i);
      if (filenameMatch) {
        heldOn = parseDateFromFilename(filenameMatch[1]!);
      }
    }

    // タイトルの構築
    const titleCandidate = sectionTitle || linkText || path;
    const title = heldOn && !titleCandidate.includes(heldOn)
      ? `${titleCandidate} ${heldOn}`.trim()
      : titleCandidate;

    results.push({
      pdfUrl,
      title,
      heldOn,
      meetingType: detectMeetingType(titleCandidate),
    });
  }

  return results;
}

/**
 * 指定年の会議一覧を取得する。
 *
 * 1. トップページから年度別ページリンクを収集
 * 2. 各年度ページから PDF リンクを収集
 * 3. 指定年（heldOn の年）でフィルタ
 */
export async function fetchMeetingList(year: number): Promise<ShiraoiMeeting[]> {
  const topHtml = await fetchPage(TOP_URL);
  if (!topHtml) return [];

  const yearPageUrls = parseTopPageLinks(topHtml);

  const allMeetings: ShiraoiMeeting[] = [];

  for (const url of yearPageUrls) {
    const html = await fetchPage(url);
    if (!html) continue;

    const meetings = parseYearPage(html);

    // 指定年でフィルタ（heldOn が null のものは含める）
    const filtered = meetings.filter((m) => {
      if (!m.heldOn) return true;
      const y = parseInt(m.heldOn.slice(0, 4), 10);
      return y === year;
    });

    allMeetings.push(...filtered);
  }

  return allMeetings;
}
