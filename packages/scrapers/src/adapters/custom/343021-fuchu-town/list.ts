/**
 * 府中町議会 — list フェーズ
 *
 * 2段階で PDF リンクを収集する:
 * 1. 年度別一覧ページから会議別詳細ページの URL を取得
 * 2. 各会議別詳細ページから本文 PDF リンクとメタ情報を抽出
 */

import { BASE_ORIGIN, buildYearPageUrl, fetchPage } from "./shared";

export interface FuchuMeeting {
  pdfUrl: string;
  title: string;
  heldOn: string;
  detailPageUrl: string;
}

/**
 * 年度別一覧ページの HTML から会議別詳細ページへのリンクを抽出する。
 *
 * 構造:
 *   <ul>
 *     <li><a href="/site/assembly/12345.html">令和７年第５回府中町議会定例会</a></li>
 *   </ul>
 */
export function parseYearPage(
  html: string
): { label: string; url: string }[] {
  const results: { label: string; url: string }[] = [];

  // /site/assembly/{数字}.html パターンのリンクを収集（list158 系は除外）
  const linkRegex =
    /<a[^>]+href="(\/site\/assembly\/(\d+)\.html)"[^>]*>([\s\S]*?)<\/a>/g;

  for (const match of html.matchAll(linkRegex)) {
    const href = match[1]!;
    const label = match[3]!.replace(/<[^>]+>/g, "").trim();

    // list158 ページ自体はスキップ（年度一覧ページへのリンク）
    if (href.includes("list158")) continue;

    // 議会関連のリンクのみ
    if (!label.includes("議会")) continue;

    const url = `${BASE_ORIGIN}${href}`;
    results.push({ label, url });
  }

  return results;
}

/**
 * 会議別詳細ページの HTML から本文 PDF リンクを抽出する。
 *
 * 実際の構造:
 *   <ul>
 *     <li><a href="/uploaded/attachment/31535.pdf">会議録（第1号）目録（12月12日） [PDFファイル／161KB]</a></li>
 *     <li><a href="/uploaded/attachment/31536.pdf">会議録（第1号）本文（12月12日） [PDFファイル／821KB]</a></li>
 *   </ul>
 */
export function parseDetailPage(
  html: string,
  meetingTitle: string,
  detailPageUrl: string
): FuchuMeeting[] {
  const results: FuchuMeeting[] = [];

  // 会議タイトルから年を抽出
  const yearFromTitle = extractYearFromTitle(meetingTitle);

  // PDF リンクを抽出
  const linkRegex =
    /<a[^>]+href="(\/uploaded\/attachment\/\d+\.pdf)"[^>]*>([\s\S]*?)<\/a>/g;

  for (const match of html.matchAll(linkRegex)) {
    const href = match[1]!;
    const linkText = match[2]!.replace(/<[^>]+>/g, "").trim();

    // 本文 PDF のみ取得（目録はスキップ）
    if (!linkText.includes("本文")) continue;

    const pdfUrl = `${BASE_ORIGIN}${href}`;

    // 号数を抽出: "会議録（第1号）本文..." → "第1号"
    const numberMatch = linkText.match(/会議録[（(](第\d+号)[）)]/);
    const number = numberMatch ? numberMatch[1]! : "";

    // タイトル: 会議名 + 号数
    const title = number
      ? `${meetingTitle} ${number}`
      : meetingTitle;

    // リンクテキストから日付を抽出: "本文（12月12日）" → month=12, day=12
    let heldOn = "";
    if (yearFromTitle) {
      const dateMatch = linkText.match(/本文[（(](\d+)月(\d+)日[）)]/);
      if (dateMatch) {
        const month = parseInt(dateMatch[1]!, 10);
        const day = parseInt(dateMatch[2]!, 10);
        heldOn = `${yearFromTitle}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
      }
    }

    results.push({
      pdfUrl,
      title,
      heldOn,
      detailPageUrl,
    });
  }

  return results;
}

/**
 * 会議タイトルから西暦年を抽出する。
 * "令和７年第５回府中町議会定例会" → 2025
 */
export function extractYearFromTitle(title: string): number | null {
  // 全角数字を半角に変換
  const normalized = title.replace(/[０-９]/g, (ch) =>
    String.fromCharCode(ch.charCodeAt(0) - 0xfee0)
  );

  const match = normalized.match(/(令和|平成)(元|\d+)年/);
  if (!match) return null;

  const [, era, eraYearStr] = match;
  const eraYear = eraYearStr === "元" ? 1 : parseInt(eraYearStr!, 10);

  if (era === "令和") return eraYear + 2018;
  if (era === "平成") return eraYear + 1988;
  return null;
}

/**
 * 指定年の全 PDF リンクを取得する。
 */
export async function fetchMeetingList(
  year: number
): Promise<FuchuMeeting[]> {
  // Step 1: 年度別一覧ページの URL を取得
  const yearPageUrl = buildYearPageUrl(year);
  if (!yearPageUrl) return [];

  const yearHtml = await fetchPage(yearPageUrl);
  if (!yearHtml) return [];

  // Step 2: 会議別詳細ページのリンクを取得
  const detailPages = parseYearPage(yearHtml);
  if (detailPages.length === 0) return [];

  // Step 3: 各詳細ページから本文 PDF リンクを取得
  const allMeetings: FuchuMeeting[] = [];

  for (const page of detailPages) {
    const detailHtml = await fetchPage(page.url);
    if (!detailHtml) continue;

    const meetings = parseDetailPage(detailHtml, page.label, page.url);
    allMeetings.push(...meetings);
  }

  return allMeetings;
}
