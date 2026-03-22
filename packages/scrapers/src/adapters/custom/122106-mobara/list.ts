/**
 * 茂原市議会 — list フェーズ
 *
 * 2段階で PDF リンクを収集する:
 * 1. 一覧ページから対象年度のページ URL を取得
 * 2. 年度別ページから PDF リンクとメタ情報を抽出
 */

import { BASE_ORIGIN, fetchPage, toJapaneseEra } from "./shared";

export interface MobaraMeeting {
  pdfUrl: string;
  title: string;
  heldOn: string;
  section: string;
}

/**
 * 一覧ページから年度別ページのリンクを抽出する。
 * 各リンクのテキスト（例: "令和7年会議録"）とURLを返す。
 */
export function parseTopPage(
  html: string
): { label: string; url: string }[] {
  const results: { label: string; url: string }[] = [];

  const linkRegex =
    /<a[^>]+href="([^"]*(?:\/\d{10}\.html|\/\d{10}\.html))"[^>]*>([^<]+)<\/a>/g;

  for (const match of html.matchAll(linkRegex)) {
    const href = match[1]!;
    const label = match[2]!.trim();

    if (!label.includes("会議録")) continue;

    const url = href.startsWith("http")
      ? href
      : `${BASE_ORIGIN}${href.startsWith("/") ? "" : "/"}${href}`;

    results.push({ label, url });
  }

  return results;
}

/**
 * 和暦の開催日テキストから YYYY-MM-DD を返す。
 * e.g., "令和7年11月26日" → "2025-11-26"
 */
export function parseDateText(text: string): string | null {
  const match = text.match(/(令和|平成)(\d+)年(\d+)月(\d+)日/);
  if (!match) return null;

  const [, era, eraYearStr, monthStr, dayStr] = match;
  const eraYear = parseInt(eraYearStr!, 10);
  const month = parseInt(monthStr!, 10);
  const day = parseInt(dayStr!, 10);

  let westernYear: number;
  if (era === "令和") westernYear = eraYear + 2018;
  else if (era === "平成") westernYear = eraYear + 1988;
  else return null;

  return `${westernYear}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

/**
 * 年度別ページの HTML から PDF リンクを抽出する（テスト可能な純粋関数）。
 *
 * 構造:
 * - <p class="mol_attachfileblock_title">12月定例会　会議録</p> でセクション分け
 * - <a href="./cmsfiles/...pdf">第1号　令和7年11月26日　（PDF形式、534.27KB）</a> で PDF リンク
 */
export function parseYearPage(
  html: string,
  pageUrl: string
): MobaraMeeting[] {
  const results: MobaraMeeting[] = [];

  // セクション見出しの位置を収集
  const sections: { index: number; name: string }[] = [];
  const sectionPattern =
    /<p[^>]*class="mol_attachfileblock_title"[^>]*>([^<]+)<\/p>/g;
  for (const match of html.matchAll(sectionPattern)) {
    sections.push({
      index: match.index!,
      name: match[1]!.replace(/[\s　]+会議録/, "").trim(),
    });
  }

  // h2/h3 タグもセクション見出しとして使われることがある
  const headingPattern = /<h[23][^>]*>([^<]*(?:定例会|臨時会)[^<]*)<\/h[23]>/g;
  for (const match of html.matchAll(headingPattern)) {
    sections.push({
      index: match.index!,
      name: match[1]!.replace(/[\s　]+会議録/, "").trim(),
    });
  }

  sections.sort((a, b) => a.index - b.index);

  // PDF リンクを抽出（<a> 内に <img> タグが含まれるケースに対応）
  const linkPattern =
    /<a[^>]+href="([^"]+\.pdf)"[^>]*>([\s\S]*?)<\/a>/gi;

  // pageUrl からベース URL を構築
  const baseUrl = pageUrl.replace(/\/[^/]+$/, "/");

  for (const match of html.matchAll(linkPattern)) {
    const linkIndex = match.index!;
    const href = match[1]!;
    // HTML タグを除去してテキストのみ取得
    const linkText = match[2]!.replace(/<[^>]+>/g, "").trim();

    // 現在のセクションを特定
    let currentSection = "";
    for (const section of sections) {
      if (section.index < linkIndex) {
        currentSection = section.name;
      }
    }

    // リンクテキストから日付を抽出
    const heldOn = parseDateText(linkText);
    if (!heldOn) continue;

    // PDF の完全 URL を構築
    let pdfUrl: string;
    if (href.startsWith("http")) {
      pdfUrl = href;
    } else if (href.startsWith("./")) {
      pdfUrl = baseUrl + href.slice(2);
    } else if (href.startsWith("/")) {
      pdfUrl = `${BASE_ORIGIN}${href}`;
    } else {
      pdfUrl = baseUrl + href;
    }

    // タイトルを構築: セクション名 + リンクテキスト（PDF情報を除去）
    const cleanLinkText = linkText.replace(/（PDF[^）]*）/, "").trim();
    const title = currentSection
      ? `${currentSection} ${cleanLinkText}`
      : cleanLinkText;

    results.push({ pdfUrl, title, heldOn, section: currentSection });
  }

  return results;
}

/**
 * 指定年の全 PDF リンクを取得する。
 */
export async function fetchMeetingList(
  baseUrl: string,
  year: number
): Promise<MobaraMeeting[]> {
  // Step 1: 一覧ページから年度別ページのリンクを取得
  const topHtml = await fetchPage(baseUrl);
  if (!topHtml) return [];

  const yearPages = parseTopPage(topHtml);
  const eraTexts = toJapaneseEra(year);

  // 対象年度のページを見つける
  const targetPage = yearPages.find((p) =>
    eraTexts.some((era) => p.label.includes(era))
  );
  if (!targetPage) return [];

  // Step 2: 年度別ページから PDF リンクを抽出
  const yearHtml = await fetchPage(targetPage.url);
  if (!yearHtml) return [];

  return parseYearPage(yearHtml, targetPage.url);
}
