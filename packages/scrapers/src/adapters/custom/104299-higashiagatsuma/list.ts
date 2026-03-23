/**
 * 東吾妻町議会 — list フェーズ
 *
 * 2段階で PDF リンクを収集する:
 * 1. 一覧ページから対象年度のページ URL を取得
 * 2. 年度別ページから PDF リンクとメタ情報を抽出
 */

import { BASE_ORIGIN, fetchPage, toJapaneseEra } from "./shared";

export interface HigashiagatsumaMeeting {
  pdfUrl: string;
  title: string;
  heldOn: string;
}

/**
 * 一覧ページから年度別ページのリンクを抽出する。
 * 各リンクのテキスト（例: "令和7年会議録"）とURLを返す。
 */
export function parseTopPage(
  html: string,
): { label: string; url: string }[] {
  const results: { label: string; url: string }[] = [];

  // リンクパターン: /www/gikai/contents/{id}/index.html
  const linkRegex =
    /<a[^>]+href="(\/www\/gikai\/contents\/\d+\/index\.html)"[^>]*>([^<]+)<\/a>/g;

  for (const match of html.matchAll(linkRegex)) {
    const href = match[1]!;
    const label = match[2]!.trim();

    if (!label.includes("会議録")) continue;

    const url = `${BASE_ORIGIN}${href}`;
    results.push({ label, url });
  }

  return results;
}

/**
 * リンクテキストから会議情報を抽出し heldOn (YYYY-MM-DD) を返す。
 *
 * 近年のパターン:
 *   "令和７年第１回（３月）定例会会議録(1954KB)(PDF)"
 *   → era=令和, eraYear=7, month=3, type=定例会
 *
 * 古い年度のパターン:
 *   "平成１９年　９月　６日会議録(202KB)(PDF文書)"
 *   → era=平成, eraYear=19, month=9, day=6
 */
export function parseLinkDate(text: string): string | null {
  // 全角数字を半角に変換
  const normalized = text.replace(/[０-９]/g, (c) =>
    String.fromCharCode(c.charCodeAt(0) - 0xfee0),
  );

  // パターン1: 近年形式 "令和7年第1回（3月）定例会会議録"
  const modernPattern =
    /(?:令和|平成)(元|\d+)年第\d+回(?:[（(](\d+)月[）)])/;
  const modernMatch = normalized.match(modernPattern);
  if (modernMatch) {
    const era = normalized.includes("令和") ? "令和" : "平成";
    const eraYear = modernMatch[1] === "元" ? 1 : parseInt(modernMatch[1]!, 10);
    const month = parseInt(modernMatch[2]!, 10);

    let westernYear: number;
    if (era === "令和") westernYear = eraYear + 2018;
    else westernYear = eraYear + 1988;

    // 日付は月の1日をデフォルトとする
    return `${westernYear}-${String(month).padStart(2, "0")}-01`;
  }

  // パターン2: 古い形式 "平成19年 9月 6日会議録"
  const oldPattern = /(?:令和|平成)(元|\d+)年\s*(\d+)月\s*(\d+)日/;
  const oldMatch = normalized.match(oldPattern);
  if (oldMatch) {
    const era = normalized.includes("令和") ? "令和" : "平成";
    const eraYear = oldMatch[1] === "元" ? 1 : parseInt(oldMatch[1]!, 10);
    const month = parseInt(oldMatch[2]!, 10);
    const day = parseInt(oldMatch[3]!, 10);

    let westernYear: number;
    if (era === "令和") westernYear = eraYear + 2018;
    else westernYear = eraYear + 1988;

    return `${westernYear}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
  }

  return null;
}

/**
 * 年度別ページの HTML から PDF リンクを抽出する（テスト可能な純粋関数）。
 *
 * 構造:
 * - <li><a href="/www/gikai/contents/{id}/files/{name}.pdf">リンクテキスト</a></li>
 * - リンクテキストに会議名と開催月 or 日付が含まれる
 */
export function parseYearPage(
  html: string,
  pageUrl: string,
): HigashiagatsumaMeeting[] {
  const results: HigashiagatsumaMeeting[] = [];

  // PDF リンクを抽出
  const linkPattern = /<a[^>]+href="([^"]+\.pdf)"[^>]*>([\s\S]*?)<\/a>/gi;

  // pageUrl からベース URL を構築
  const baseUrl = pageUrl.replace(/\/[^/]+$/, "/");

  for (const match of html.matchAll(linkPattern)) {
    const href = match[1]!;
    // HTML タグを除去してテキストのみ取得
    const linkText = match[2]!.replace(/<[^>]+>/g, "").trim();

    // 目次ファイルはスキップ
    if (linkText.includes("目次")) continue;

    // 日付を抽出
    const heldOn = parseLinkDate(linkText);
    if (!heldOn) continue;

    // PDF の完全 URL を構築
    let pdfUrl: string;
    if (href.startsWith("http")) {
      pdfUrl = href;
    } else if (href.startsWith("/")) {
      pdfUrl = `${BASE_ORIGIN}${href}`;
    } else if (href.startsWith("./")) {
      pdfUrl = baseUrl + href.slice(2);
    } else {
      pdfUrl = baseUrl + href;
    }

    // タイトルを構築: リンクテキストからサイズ情報を除去
    const title = linkText
      .replace(/\([^)]*KB\)/gi, "")
      .replace(/\(PDF[^)]*\)/gi, "")
      .replace(/\(PDF文書\)/gi, "")
      .trim();

    results.push({ pdfUrl, title, heldOn });
  }

  return results;
}

/**
 * 指定年の全 PDF リンクを取得する。
 */
export async function fetchMeetingList(
  baseUrl: string,
  year: number,
): Promise<HigashiagatsumaMeeting[]> {
  // Step 1: 一覧ページから年度別ページのリンクを取得
  const topHtml = await fetchPage(baseUrl);
  if (!topHtml) return [];

  const yearPages = parseTopPage(topHtml);
  const eraTexts = toJapaneseEra(year);

  // 対象年度のページを見つける
  const targetPage = yearPages.find((p) =>
    eraTexts.some((era) => p.label.includes(era)),
  );
  if (!targetPage) return [];

  // Step 2: 年度別ページから PDF リンクを抽出
  const yearHtml = await fetchPage(targetPage.url);
  if (!yearHtml) return [];

  return parseYearPage(yearHtml, targetPage.url);
}
