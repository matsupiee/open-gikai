/**
 * 五城目町議会 — list フェーズ
 *
 * 2段階で PDF リンクを収集する:
 * 1. トップページから対象年度のページ URL を取得
 * 2. 年度別ページから h3 見出し配下の PDF リンクを抽出
 *
 * PDF 分類:
 * - 会期日程 → スキップ（発言データなし）
 * - 第○号（○月○日）→ 本会議の会議録
 * - ○.議員名 → 一般質問の会議録
 * - 臨時会（○月○日）→ 臨時会の会議録
 */

import { BASE_ORIGIN, fetchPage, toJapaneseEra } from "./shared";

export interface GojomeMeeting {
  pdfUrl: string;
  title: string;
  heldOn: string; // YYYY-MM-DD
  section: string; // h3 見出しテキスト（例: "令和７年第４回定例会 (１２月定例会)"）
}

/**
 * トップページから年度別ページのリンクを抽出する。
 */
export function parseTopPage(
  html: string
): { label: string; url: string }[] {
  const results: { label: string; url: string }[] = [];

  const linkRegex =
    /<a[^>]+href="(\/town\/gikai\/kaigiroku\/\d+)"[^>]*>([^<]+)<\/a>/g;

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
 * リンクテキストから日付（月日）を抽出する。
 * 対応パターン:
 *   "第1号（9月1日）" → { month: 9, day: 1 }
 *   "第2号  (12月9日)" → { month: 12, day: 9 }
 *   "第３回臨時会  (12月26日)" → { month: 12, day: 26 }
 *   "第１回臨時会　(1月27日)" → { month: 1, day: 27 }
 *   全角括弧・半角括弧両対応、全角数字・半角数字両対応
 */
export function parseDateFromLink(text: string): { month: number; day: number } | null {
  // 全角数字を半角に変換
  const normalized = text.replace(/[０-９]/g, (c) =>
    String.fromCharCode(c.charCodeAt(0) - 0xfee0)
  );

  const match = normalized.match(/[（(]\s*(\d{1,2})月(\d{1,2})日\s*[）)]/);
  if (!match) return null;

  return { month: parseInt(match[1]!, 10), day: parseInt(match[2]!, 10) };
}

/**
 * h3 見出しから年度（西暦）を抽出する。
 * e.g., "令和７年第４回定例会" → 2025
 */
export function parseYearFromHeading(heading: string): number | null {
  // 全角数字を半角に変換
  const normalized = heading.replace(/[０-９]/g, (c) =>
    String.fromCharCode(c.charCodeAt(0) - 0xfee0)
  );

  const match = normalized.match(/(令和|平成)(元|\d+)年/);
  if (!match) return null;

  const eraYear = match[2] === "元" ? 1 : parseInt(match[2]!, 10);
  if (match[1] === "令和") return eraYear + 2018;
  if (match[1] === "平成") return eraYear + 1988;
  return null;
}

/**
 * 年度別ページの HTML から PDF リンクを抽出する（テスト可能な純粋関数）。
 *
 * 構造:
 * - <h3>令和７年第４回定例会 (１２月定例会)</h3> でセクション分け
 * - <ul><li><a href="...pdf">リンクテキスト</a></li></ul> で PDF リンク
 *
 * スキップ対象:
 * - 会期日程 PDF（発言データなし）
 */
export function parseYearPage(
  html: string,
  _pageUrl: string
): GojomeMeeting[] {
  const results: GojomeMeeting[] = [];

  // h3 見出しの位置とテキストを収集
  const sections: { index: number; heading: string; year: number | null }[] = [];
  const h3Pattern = /<h3[^>]*>([\s\S]*?)<\/h3>/gi;
  for (const match of html.matchAll(h3Pattern)) {
    const heading = match[1]!.replace(/<[^>]+>/g, "").trim();
    sections.push({
      index: match.index!,
      heading,
      year: parseYearFromHeading(heading),
    });
  }

  // PDF リンクを抽出
  const linkPattern = /<a[^>]+href="([^"]+\.pdf)"[^>]*>([\s\S]*?)<\/a>/gi;

  for (const match of html.matchAll(linkPattern)) {
    const linkIndex = match.index!;
    const href = match[1]!;
    const linkText = match[2]!
      .replace(/<[^>]+>/g, "")
      .replace(/&nbsp;/g, " ")
      .replace(/&amp;/g, "&")
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">")
      .replace(/&quot;/g, '"')
      .trim();

    // 会期日程はスキップ
    if (linkText.includes("会期日程") || linkText.includes("議事日程")) continue;

    // 現在のセクションを特定
    let currentSection = "";
    let sectionYear: number | null = null;
    for (const section of sections) {
      if (section.index < linkIndex) {
        currentSection = section.heading;
        sectionYear = section.year;
      }
    }

    if (!sectionYear) continue;

    // リンクテキストから月日を抽出
    const dateInfo = parseDateFromLink(linkText);
    if (!dateInfo) continue;

    // 年度と月日から YYYY-MM-DD を構築
    const heldOn = `${sectionYear}-${String(dateInfo.month).padStart(2, "0")}-${String(dateInfo.day).padStart(2, "0")}`;

    // PDF の完全 URL を構築
    let pdfUrl: string;
    if (href.startsWith("http")) {
      pdfUrl = href;
    } else if (href.startsWith("/")) {
      pdfUrl = `${BASE_ORIGIN}${href}`;
    } else {
      pdfUrl = `${BASE_ORIGIN}/${href}`;
    }

    // タイトルを構築
    const title = currentSection
      ? `${currentSection} ${linkText}`
      : linkText;

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
): Promise<GojomeMeeting[]> {
  // Step 1: トップページから年度別ページのリンクを取得
  const topHtml = await fetchPage(baseUrl);
  if (!topHtml) return [];

  const yearPages = parseTopPage(topHtml);
  const eraTexts = toJapaneseEra(year);

  // 対象年度のページを見つける（全角数字を半角に正規化して比較）
  const normalize = (s: string) =>
    s.replace(/[０-９]/g, (c) =>
      String.fromCharCode(c.charCodeAt(0) - 0xfee0)
    );

  const targetPage = yearPages.find((p) =>
    eraTexts.some((era) => normalize(p.label).includes(normalize(era)))
  );
  if (!targetPage) return [];

  // Step 2: 年度別ページから PDF リンクを抽出
  const yearHtml = await fetchPage(targetPage.url);
  if (!yearHtml) return [];

  return parseYearPage(yearHtml, targetPage.url);
}
