/**
 * 豊前市議会 — list フェーズ
 *
 * 2段階で会議録情報を収集する:
 * 1. 一覧ページ (gijiroku.html) から詳細ページリンクを取得
 * 2. 各詳細ページから PDF リンクとメタ情報を抽出
 *
 * 一覧ページは単一ページに全年度のリンクが逆時系列で掲載されている（ページネーションなし）。
 * 詳細ページには会議録 PDF（1つまたは複数）と一般質問一覧表 PDF がある。
 *
 * 新しい年度: 会議録 PDF が1つにまとまっている
 * 古い年度: 日付別に複数の PDF がある（例: "3月2日会議録"）
 */

import {
  BASE_ORIGIN,
  eraToWesternYear,
  fetchPage,
  toJapaneseEraPrefix,
} from "./shared";

export interface BuzenDetailLink {
  /** 詳細ページの URL */
  detailUrl: string;
  /** リンクテキスト（例: "令和7年第1回定例会"） */
  title: string;
}

export interface BuzenMeeting {
  /** 会議録 PDF の URL */
  pdfUrl: string;
  /** 会議タイトル（例: "令和7年第1回定例会"） */
  title: string;
  /** 開催日 YYYY-MM-DD（日付不明の場合は null） */
  heldOn: string | null;
  /** 詳細ページの URL */
  detailUrl: string;
}

/**
 * 一覧ページ HTML から詳細ページリンクを抽出する（テスト可能な純粋関数）。
 *
 * リンクパターン: gijiroku_{era}{year}_{num}.html または gijiroku_{era}{year}-{num}.html
 */
export function parseListPage(html: string): BuzenDetailLink[] {
  const results: BuzenDetailLink[] = [];
  const seen = new Set<string>();

  const linkRegex =
    /<a[^>]+href="([^"]*gijiroku_[a-z]+\d+[-_]\d+\.html)"[^>]*>([^<]+)<\/a>/gi;

  for (const match of html.matchAll(linkRegex)) {
    const href = match[1]!;
    const title = match[2]!.trim();

    const detailUrl = href.startsWith("http")
      ? href
      : `${BASE_ORIGIN}${href.startsWith("/") ? "" : "/"}${href}`;

    if (seen.has(detailUrl)) continue;
    seen.add(detailUrl);

    results.push({ detailUrl, title });
  }

  return results;
}

/**
 * 詳細ページ HTML から会議録 PDF リンクを抽出する（テスト可能な純粋関数）。
 *
 * - 「会議録」を含む PDF リンクのみ対象（一般質問一覧表はスキップ）
 * - 古い年度では日付別に複数の PDF がある場合がある
 *   例: "3月2日会議録（PDF：350KB）"
 * - 新しい年度では単一の「会議録（PDF：2,550KB）」
 */
export function parseDetailPage(
  html: string,
  detailUrl: string,
  meetingTitle: string,
): BuzenMeeting[] {
  const results: BuzenMeeting[] = [];

  // h1 からタイトルを取得（あれば上書き）
  const h1Match = html.match(/<h1[^>]*>([^<]+)<\/h1>/i);
  const pageTitle = h1Match ? h1Match[1]!.trim() : meetingTitle;

  // タイトルから西暦年を抽出
  const westernYear = eraToWesternYear(pageTitle);

  // PDF リンクを抽出
  const pdfRegex =
    /<a[^>]+href="([^"]+\.pdf)"[^>]*>([\s\S]*?)<\/a>/gi;

  for (const match of html.matchAll(pdfRegex)) {
    const href = match[1]!;
    // HTML タグを除去してテキストのみ取得
    const linkText = match[2]!.replace(/<[^>]+>/g, "").trim();

    // 「会議録」を含むリンクのみ対象
    if (!linkText.includes("会議録")) continue;

    // PDF の完全 URL を構築
    let pdfUrl: string;
    if (href.startsWith("http")) {
      pdfUrl = href;
    } else if (href.startsWith("/")) {
      pdfUrl = `${BASE_ORIGIN}${href}`;
    } else {
      // 相対パス: 詳細ページの URL を基準に解決
      const baseUrl = detailUrl.replace(/\/[^/]+$/, "/");
      pdfUrl = baseUrl + href;
    }

    // リンクテキストから日付を抽出（古い年度: "3月2日会議録"）
    let heldOn: string | null = null;
    const dateMatch = linkText.match(/(\d+)月(\d+)日/);
    if (dateMatch && westernYear) {
      const month = parseInt(dateMatch[1]!, 10);
      const day = parseInt(dateMatch[2]!, 10);
      heldOn = `${westernYear}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    }

    // タイトル構築: 日付がリンクテキストにある場合はそれを含める
    const title = dateMatch
      ? `${pageTitle} ${linkText.replace(/（PDF[^）]*）/, "").trim()}`
      : pageTitle;

    results.push({
      pdfUrl,
      title,
      heldOn: heldOn ?? null,
      detailUrl,
    });
  }

  return results;
}

/**
 * 指定年の全会議録 PDF リンクを取得する。
 */
export async function fetchMeetingList(
  baseUrl: string,
  year: number,
): Promise<BuzenMeeting[]> {
  // Step 1: 一覧ページから全詳細ページリンクを取得
  const topHtml = await fetchPage(baseUrl);
  if (!topHtml) return [];

  const allLinks = parseListPage(topHtml);
  const eraPrefixes = toJapaneseEraPrefix(year);

  // 対象年のリンクだけに絞り込む
  const targetLinks = allLinks.filter((link) =>
    eraPrefixes.some((prefix) => link.title.includes(prefix)),
  );

  if (targetLinks.length === 0) return [];

  // Step 2: 各詳細ページから PDF リンクを抽出
  const allMeetings: BuzenMeeting[] = [];

  for (let i = 0; i < targetLinks.length; i++) {
    const link = targetLinks[i]!;
    const detailHtml = await fetchPage(link.detailUrl);
    if (!detailHtml) continue;

    const meetings = parseDetailPage(detailHtml, link.detailUrl, link.title);
    allMeetings.push(...meetings);

    if (i < targetLinks.length - 1) {
      await new Promise((r) => setTimeout(r, 1000));
    }
  }

  return allMeetings;
}
