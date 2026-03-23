/**
 * 玉東町議会 — list フェーズ
 *
 * 2段階で PDF リンクを収集する:
 * 1. 一覧ページ (list00507.html) から対象年度の kiji ページ URL を取得
 * 2. 年度別ページから h4 セクション単位で PDF リンクとメタ情報を抽出
 */

import { BASE_ORIGIN, fetchPage, toJapaneseEra } from "./shared";

export interface GyokutoMeeting {
  pdfUrl: string;
  title: string;
  heldOn: string; // YYYY-MM-DD
  section: string;
}

/**
 * 一覧ページから年度別ページのリンクを抽出する。
 *
 * HTML 構造:
 *   <div class="loadbox"><ul>
 *     <li><span>2025年1月31日更新</span>
 *       <a href="https://...kiji0031376/index.html">令和6年玉東町議会会議録</a></li>
 *   </ul></div>
 */
export function parseTopPage(
  html: string,
): { label: string; url: string }[] {
  const results: { label: string; url: string }[] = [];

  const linkRegex =
    /<a[^>]+href="([^"]*kiji\d+\/index\.html)"[^>]*>([^<]+)<\/a>/g;

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
 * 年度別ページの HTML から PDF リンクを抽出する（テスト可能な純粋関数）。
 *
 * 構造:
 *   <h4>第1回(3月)定例会</h4>
 *   <ul>
 *     <li><a href="...pdf">目次（PDF：58.4キロバイト）</a></li>
 *     <li><a href="...pdf">3月6日（PDF：888.2キロバイト）</a></li>
 *   </ul>
 */
export function parseYearPage(
  html: string,
  pageUrl: string,
  year: number,
): GyokutoMeeting[] {
  const results: GyokutoMeeting[] = [];

  // h4 セクション見出しの位置を収集
  const sections: { index: number; name: string }[] = [];
  const h4Pattern = /<h4[^>]*>([\s\S]*?)<\/h4>/g;
  for (const match of html.matchAll(h4Pattern)) {
    const rawName = match[1]!.replace(/&nbsp;/g, " ").trim();
    if (!rawName.includes("定例会") && !rawName.includes("臨時会")) continue;
    sections.push({
      index: match.index!,
      name: rawName,
    });
  }

  sections.sort((a, b) => a.index - b.index);

  // PDF リンクを抽出
  const linkPattern = /<a[^>]+href="([^"]+\.pdf)"[^>]*>([\s\S]*?)<\/a>/gi;
  const baseUrl = pageUrl.replace(/\/[^/]+$/, "/");

  for (const match of html.matchAll(linkPattern)) {
    const linkIndex = match.index!;
    const href = match[1]!;
    const linkText = match[2]!.replace(/<[^>]+>/g, "").replace(/&nbsp;/g, " ").trim();

    // 目次 PDF はスキップ
    if (linkText.includes("目次")) continue;

    // 現在のセクションを特定
    let currentSection = "";
    for (const section of sections) {
      if (section.index < linkIndex) {
        currentSection = section.name;
      }
    }

    // リンクテキストから日付を抽出（例: "3月6日（PDF：888.2キロバイト）"）
    const heldOn = parseDateLabel(linkText, year, currentSection);
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

    // タイトルを構築
    const dateText = linkText.replace(/（PDF[^）]*）/, "").replace(/\(PDF[^)]*\)/, "").trim();
    const title = currentSection
      ? `${currentSection} ${dateText}`
      : dateText;

    results.push({ pdfUrl, title, heldOn, section: currentSection });
  }

  return results;
}

/**
 * リンクラベルから日付を解析する。
 * 玉東町の PDF リンクは "3月6日（PDF：888.2キロバイト）" 形式。
 * セクション名の月情報 (例: "第1回(1月)臨時会") からも年の補正を行う。
 *
 * year は暦年（例: 2024）。玉東町は年度ではなく暦年でページを構成している。
 */
export function parseDateLabel(
  text: string,
  year: number,
  _sectionTitle: string,
): string | null {
  const match = text.match(/(\d{1,2})月(\d{1,2})日/);
  if (!match) return null;

  const month = parseInt(match[1]!, 10);
  const day = parseInt(match[2]!, 10);

  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

/**
 * 指定年の全 PDF リンクを取得する。
 */
export async function fetchMeetingList(
  baseUrl: string,
  year: number,
): Promise<GyokutoMeeting[]> {
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

  return parseYearPage(yearHtml, targetPage.url, year);
}
