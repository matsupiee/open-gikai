/**
 * 大石田町議会 — list フェーズ
 *
 * 2段階で PDF リンクを収集する:
 * 1. 一覧ページから対象年度のページ URL を取得
 * 2. 年度別ページから PDF リンクとメタ情報を抽出
 *
 * トップページ構造:
 *   <li><a href="/chousei/chousei/kaigiroku/gikai20250206.html">令和6年会議録</a></li>
 *
 * 年度別ページ構造:
 *   <h3>定例会</h3>
 *   <p><a href="gikai20250206.files/R6.3.pdf">第1回定例会（3月）会議録（PDF：1,435KB）</a></p>
 *   <h3>臨時会</h3>
 *   <p><a href="gikai20250206.files/R6.1.25.pdf">第1回臨時会（1月25日）会議録（PDF：373KB）</a></p>
 */

import { BASE_ORIGIN, fetchPage, toJapaneseEra } from "./shared";

export interface OishidaMeeting {
  pdfUrl: string;
  title: string;
  heldOn: string | null; // YYYY-MM-DD or null
  meetingSection: string; // e.g., "定例会", "臨時会"
}

/**
 * トップページから年度別ページのリンクを抽出する。
 */
export function parseTopPage(
  html: string,
  baseUrl: string
): { label: string; url: string }[] {
  const results: { label: string; url: string }[] = [];

  const linkRegex = /<a[^>]+href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/g;

  for (const match of html.matchAll(linkRegex)) {
    const href = match[1]!;
    const rawLabel = match[2]!.replace(/<[^>]+>/g, "").trim();
    // 会議録へのリンクのみ対象（ページ名パターンと「会議録」テキスト）
    if (!rawLabel.includes("会議録")) continue;

    let url: string;
    if (href.startsWith("http")) {
      url = href;
    } else if (href.startsWith("/")) {
      url = `${BASE_ORIGIN}${href}`;
    } else {
      url = new URL(href, baseUrl).href;
    }

    results.push({ label: rawLabel, url });
  }

  return results;
}

/**
 * リンクテキストから開催日 (YYYY-MM-DD) を抽出する。
 *
 * 対応パターン:
 *   "第1回定例会（3月）会議録" → 月のみ → 1日を使用 "2024-03-01"
 *   "第1回臨時会（1月25日）会議録" → 月日 → "2024-01-25"
 */
export function parseDateFromLinkText(
  linkText: string,
  year: number
): string | null {
  // 臨時会パターン: （月日）
  const extraordinaryMatch = linkText.match(/（(\d+)月(\d+)日）/);
  if (extraordinaryMatch) {
    const month = parseInt(extraordinaryMatch[1]!, 10);
    const day = parseInt(extraordinaryMatch[2]!, 10);
    return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
  }

  // 定例会パターン: （月）
  const regularMatch = linkText.match(/（(\d+)月）/);
  if (regularMatch) {
    const month = parseInt(regularMatch[1]!, 10);
    return `${year}-${String(month).padStart(2, "0")}-01`;
  }

  return null;
}

/**
 * 年度別ページのラベルから西暦年を推定する。
 * e.g., "令和6年会議録" → 2024, "平成31年・令和元年会議録" → 2019
 */
export function extractYearFromLabel(label: string): number | null {
  // 令和元年
  if (label.includes("令和元年")) return 2019;

  // 令和N年
  const reiwaMatch = label.match(/令和(\d+)年/);
  if (reiwaMatch) return parseInt(reiwaMatch[1]!, 10) + 2018;

  // 平成元年
  if (label.includes("平成元年")) return 1989;

  // 平成N年
  const heiseiMatch = label.match(/平成(\d+)年/);
  if (heiseiMatch) return parseInt(heiseiMatch[1]!, 10) + 1988;

  return null;
}

/**
 * 年度別ページの HTML から PDF リンクを抽出する（テスト可能な純粋関数）。
 *
 * 構造:
 *   <h3>定例会</h3>
 *   <p><a href="gikai20250206.files/R6.3.pdf">第1回定例会（3月）会議録（PDF：1,435KB）</a></p>
 *   <h3>臨時会</h3>
 *   <p><a href="gikai20250206.files/R6.1.25.pdf">第1回臨時会（1月25日）会議録（PDF：373KB）</a></p>
 */
export function parseYearPage(
  html: string,
  pageUrl: string,
  yearContext: number
): OishidaMeeting[] {
  const results: OishidaMeeting[] = [];

  // h3 セクション見出しを収集（例: "定例会", "臨時会"）
  const h3Sections: { index: number; name: string }[] = [];
  const h3Pattern = /<h3[^>]*>([\s\S]*?)<\/h3>/g;
  for (const match of html.matchAll(h3Pattern)) {
    h3Sections.push({
      index: match.index!,
      name: match[1]!.replace(/<[^>]+>/g, "").trim(),
    });
  }

  // PDF リンクを抽出
  const linkPattern = /<a[^>]+href="([^"]+\.pdf)"[^>]*>([\s\S]*?)<\/a>/gi;
  // pageUrl の最後のファイル名を除いたディレクトリ部分
  const baseDir = pageUrl.replace(/\/[^/]+$/, "/");

  for (const match of html.matchAll(linkPattern)) {
    const linkIndex = match.index!;
    const href = match[1]!;
    const linkText = match[2]!.replace(/<[^>]+>/g, "").trim();

    // 現在の h3 セクションを特定
    let currentSection = "";
    for (const section of h3Sections) {
      if (section.index < linkIndex) {
        currentSection = section.name;
      }
    }

    // PDF の完全 URL を構築
    let pdfUrl: string;
    if (href.startsWith("http")) {
      pdfUrl = href;
    } else if (href.startsWith("./")) {
      pdfUrl = baseDir + href.slice(2);
    } else if (href.startsWith("/")) {
      pdfUrl = `${BASE_ORIGIN}${href}`;
    } else {
      pdfUrl = baseDir + href;
    }

    // リンクテキストから開催日を抽出
    const heldOn = parseDateFromLinkText(linkText, yearContext);

    // タイトルからファイルサイズ注記を除去
    const title = linkText.replace(/（PDF[：:][^）]+）/g, "").trim();

    results.push({
      pdfUrl,
      title,
      heldOn,
      meetingSection: currentSection,
    });
  }

  return results;
}

/**
 * 指定年の全 PDF リンクを取得する。
 */
export async function fetchMeetingList(
  baseUrl: string,
  year: number
): Promise<OishidaMeeting[]> {
  // Step 1: 一覧ページから年度別ページのリンクを取得
  const topHtml = await fetchPage(baseUrl);
  if (!topHtml) return [];

  const yearPages = parseTopPage(topHtml, baseUrl);
  const eraTexts = toJapaneseEra(year);

  // 対象年度のページを見つける（複数の和暦表記に対応: 令和元年・平成31年）
  const targetPage = yearPages.find((p) =>
    eraTexts.some((era) => p.label.includes(era))
  );
  if (!targetPage) return [];

  // Step 2: 年度別ページから PDF リンクを抽出
  const yearHtml = await fetchPage(targetPage.url);
  if (!yearHtml) return [];

  const labelYear = extractYearFromLabel(targetPage.label) ?? year;
  return parseYearPage(yearHtml, targetPage.url, labelYear);
}
