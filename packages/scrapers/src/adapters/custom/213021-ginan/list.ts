/**
 * 岐南町議会 — list フェーズ
 *
 * 2段階で PDF リンクを収集する:
 * 1. 年別一覧ページから定例会詳細ページ URL を取得
 * 2. 各定例会詳細ページから PDF リンクとメタ情報を抽出
 *
 * リンクテキスト形式:
 *   一覧ページ: "第{X}回定例会({月})会議録"
 *   詳細ページ: "〇第{X}回定例会(第{号数}号){元号}{年}年{月}日({サイズ}KB)"
 */

import {
  BASE_ORIGIN,
  buildYearPageUrl,
  fetchPage,
  parseDateText,
} from "./shared";

export interface GinanMeeting {
  pdfUrl: string;
  title: string;
  heldOn: string;
  sessionTitle: string;
}

/**
 * 年別一覧ページの HTML から定例会詳細ページのリンクを抽出する（テスト可能な純粋関数）。
 *
 * リンクテキストが "第{X}回定例会" を含むものを抽出。
 */
export function parseYearListPage(
  html: string
): { label: string; url: string }[] {
  const results: { label: string; url: string }[] = [];

  const linkRegex = /<a[^>]+href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/gi;

  for (const match of html.matchAll(linkRegex)) {
    const href = match[1]!;
    const text = match[2]!.replace(/<[^>]+>/g, "").trim();

    if (!/第\d+回定例会/.test(text)) continue;

    const url = href.startsWith("http")
      ? href
      : href.startsWith("/")
        ? `${BASE_ORIGIN}${href}`
        : `${BASE_ORIGIN}/${href}`;

    results.push({ label: text, url });
  }

  return results;
}

/**
 * 定例会詳細ページの HTML から PDF リンクを抽出する（テスト可能な純粋関数）。
 *
 * - /secure/ 配下の .pdf へのリンクを抽出
 * - 目次 PDF（mokuji.pdf）は除外
 * - リンクテキストから日付を抽出
 */
export function parseSessionPage(
  html: string,
  sessionTitle: string
): GinanMeeting[] {
  const results: GinanMeeting[] = [];

  const linkRegex = /<a[^>]+href="([^"]*\.pdf)"[^>]*>([\s\S]*?)<\/a>/gi;

  for (const match of html.matchAll(linkRegex)) {
    const href = match[1]!;
    const text = match[2]!.replace(/<[^>]+>/g, "").trim();

    if (!href.includes("/secure/")) continue;

    // 目次 PDF をスキップ
    if (/mokuji\.pdf$/i.test(href)) continue;

    // 日付を抽出
    const heldOn = parseDateText(text);
    if (!heldOn) continue;

    const pdfUrl = href.startsWith("http")
      ? href
      : href.startsWith("/")
        ? `${BASE_ORIGIN}${href}`
        : `${BASE_ORIGIN}/${href}`;

    // タイトル構築: セッション名 + 号数情報
    const numberMatch = text.match(/第(\d+)号/);
    const numberStr = numberMatch ? `第${numberMatch[1]}号` : "";
    const title = numberStr
      ? `${sessionTitle} ${numberStr}`
      : sessionTitle;

    results.push({ pdfUrl, title, heldOn, sessionTitle });
  }

  return results;
}

/**
 * 指定年の全 PDF リンクを取得する。
 */
export async function fetchMeetingList(
  year: number
): Promise<GinanMeeting[]> {
  // Step 1: 年別一覧ページを取得
  const yearPageUrl = buildYearPageUrl(year);
  if (!yearPageUrl) return [];

  const yearHtml = await fetchPage(yearPageUrl);
  if (!yearHtml) return [];

  const sessionPages = parseYearListPage(yearHtml);
  if (sessionPages.length === 0) return [];

  // Step 2: 各定例会詳細ページから PDF リンクを抽出
  const allMeetings: GinanMeeting[] = [];

  for (let i = 0; i < sessionPages.length; i++) {
    const session = sessionPages[i]!;
    const sessionHtml = await fetchPage(session.url);
    if (!sessionHtml) continue;

    // セッションタイトルから "会議録" を除去
    const sessionTitle = session.label.replace(/会議録$/, "").trim();
    const meetings = parseSessionPage(sessionHtml, sessionTitle);
    allMeetings.push(...meetings);

    if (i < sessionPages.length - 1) {
      await new Promise((r) => setTimeout(r, 1000));
    }
  }

  return allMeetings;
}
