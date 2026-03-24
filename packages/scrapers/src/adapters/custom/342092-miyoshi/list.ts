/**
 * 三次市議会 — list フェーズ
 *
 * 2段階で PDF リンクを収集する:
 * 1. 年度索引ページから対象年度のページ URL を取得
 * 2. 年度別ページから PDF リンクとメタ情報を抽出
 *
 * 年度索引ページ: https://www.city.miyoshi.hiroshima.jp/site/council/2938.html
 * 年度別ページ: https://www.city.miyoshi.hiroshima.jp/soshiki/34/{ページID}.html
 * PDF リンク: /uploaded/attachment/{ファイルID}.pdf
 *
 * 年度別ページ構造:
 * - <h2> 見出し: 定例会・臨時会ごとに区切り（例: <h2>令和6年12月定例会</h2>）
 * - テーブル: 各日程の月日と内容・PDFリンク
 */

import { BASE_ORIGIN, fetchPage, toHalfWidth, toJapaneseEra } from "./shared";

export interface MiyoshiMeeting {
  pdfUrl: string;
  title: string;
  heldOn: string;
  section: string;
}

/**
 * 年度索引ページから年度別ページのリンクを抽出する。
 * /soshiki/34/{ID}.html 形式のリンクを収集する。
 */
export function parseIndexPage(
  html: string
): { label: string; url: string }[] {
  const results: { label: string; url: string }[] = [];

  // /soshiki/34/{ID} 形式のリンクを抽出
  const linkRegex =
    /<a[^>]+href="([^"]*\/soshiki\/34\/\d+(?:\.html)?)"[^>]*>([\s\S]*?)<\/a>/g;

  for (const match of html.matchAll(linkRegex)) {
    const href = match[1]!;
    const label = match[2]!.replace(/<[^>]+>/g, "").trim();

    // 年度リンク（令和・平成を含む）のみ対象
    if (!/(令和|平成)/.test(label) && !/(令和|平成)/.test(href)) continue;

    const url = href.startsWith("http")
      ? href
      : `${BASE_ORIGIN}${href.startsWith("/") ? "" : "/"}${href}`;

    // .html がない場合は付与
    const finalUrl = url.endsWith(".html") ? url : `${url}.html`;

    results.push({ label, url: finalUrl });
  }

  return results;
}

/**
 * h2 見出しから年と月を抽出して YYYY-MM 形式を返す。
 * 例: "令和6年12月定例会" → "2024-12"
 * 例: "令和元年9月定例会" → "2019-09"
 * 例: "平成31年3月定例会" → "2019-03"
 */
export function parseSectionDate(section: string): string | null {
  // 全角数字を半角に正規化してからパース
  const normalized = toHalfWidth(section);

  const match = normalized.match(
    /(令和|平成)\s*(元|\d+)\s*年\s*(\d+)\s*月/
  );
  if (!match) return null;

  const era = match[1]!;
  const eraYear = match[2] === "元" ? 1 : parseInt(match[2]!, 10);
  const month = parseInt(match[3]!, 10);

  let westernYear: number;
  if (era === "令和") westernYear = eraYear + 2018;
  else if (era === "平成") westernYear = eraYear + 1988;
  else return null;

  return `${westernYear}-${String(month).padStart(2, "0")}`;
}

/**
 * h2 見出しから西暦年のみを抽出する。
 * 例: "令和6年第1回臨時会" → 2024
 * 例: "令和元年9月定例会" → 2019
 */
export function parseSectionYear(section: string): number | null {
  const normalized = toHalfWidth(section);

  const match = normalized.match(/(令和|平成)\s*(元|\d+)\s*年/);
  if (!match) return null;

  const era = match[1]!;
  const eraYear = match[2] === "元" ? 1 : parseInt(match[2]!, 10);

  if (era === "令和") return eraYear + 2018;
  if (era === "平成") return eraYear + 1988;
  return null;
}

/**
 * テーブルの月日セルから日付を抽出する。
 * 例: "12月2日（月曜日）" → "2024-12-02"
 */
export function parseDayFromCell(cell: string, yearMonth: string): string | null {
  const normalized = toHalfWidth(cell);
  const match = normalized.match(/(\d+)月(\d+)日/);
  if (!match) return null;

  const day = parseInt(match[2]!, 10);
  return `${yearMonth}-${String(day).padStart(2, "0")}`;
}

/**
 * テーブルの月日セルから年付き日付を抽出する（年情報は別途渡す）。
 * 例: "12月2日（月曜日）", 2024 → "2024-12-02"
 */
export function parseDayFromCellWithYear(cell: string, year: number): string | null {
  const normalized = toHalfWidth(cell);
  const match = normalized.match(/(\d+)月(\d+)日/);
  if (!match) return null;

  const month = parseInt(match[1]!, 10);
  const day = parseInt(match[2]!, 10);
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

/**
 * 年度別ページの HTML から PDF リンクを抽出する（テスト可能な純粋関数）。
 *
 * 構造:
 * - <h2> 見出し: 定例会・臨時会ごとに区切り
 * - テーブル: 月日列（列1）と内容・PDF リンク列（列2）
 *
 * PDF リンク形式: <a href="/uploaded/attachment/{ファイルID}.pdf">[内容テキスト [PDFファイル／サイズKB]]</a>
 */
export function parseYearPage(
  html: string,
  pageUrl: string
): MiyoshiMeeting[] {
  const results: MiyoshiMeeting[] = [];

  // h2 見出しの位置を収集
  const sections: { index: number; name: string }[] = [];
  const h2Pattern = /<h2[^>]*>([\s\S]*?)<\/h2>/gi;

  for (const match of html.matchAll(h2Pattern)) {
    const text = match[1]!.replace(/<[^>]+>/g, "").trim();
    // 定例会・臨時会を含む見出しのみ
    if (!text.includes("定例会") && !text.includes("臨時会")) continue;
    sections.push({ index: match.index!, name: text });
  }

  sections.sort((a, b) => a.index - b.index);

  // テーブル行を処理: 各行で日付セルと PDF リンクを抽出
  const trPattern = /<tr[^>]*>([\s\S]*?)<\/tr>/gi;

  for (const trMatch of html.matchAll(trPattern)) {
    const trIndex = trMatch.index!;
    const trContent = trMatch[1]!;

    // 現在のセクションを特定
    let currentSection = "";
    for (const section of sections) {
      if (section.index < trIndex) {
        currentSection = section.name;
      }
    }
    if (!currentSection) continue;

    // セクション見出しから YYYY-MM を取得（月がない臨時会などは null）
    const yearMonth = parseSectionDate(currentSection);
    const sectionYear = yearMonth ? null : parseSectionYear(currentSection);
    // 年も月も取得できない場合はスキップ
    if (!yearMonth && !sectionYear) continue;

    // td セルを抽出
    const tdPattern = /<td[^>]*>([\s\S]*?)<\/td>/gi;
    const cells: string[] = [];
    for (const tdMatch of trContent.matchAll(tdPattern)) {
      cells.push(tdMatch[1]!);
    }

    if (cells.length < 2) continue;

    // 列1: 月日
    const dateCell = cells[0]!.replace(/<[^>]+>/g, "").trim();
    // 列2: 内容 + PDF リンク
    const contentCell = cells[1]!;

    // PDF リンクを抽出
    const pdfLinkPattern = /<a[^>]+href="([^"]+\.pdf)"[^>]*>([\s\S]*?)<\/a>/gi;

    for (const linkMatch of contentCell.matchAll(pdfLinkPattern)) {
      const href = linkMatch[1]!;
      const linkText = linkMatch[2]!.replace(/<[^>]+>/g, "").trim();

      // 会議録以外（例: 議事日程など）はスキップ
      if (!linkText.includes("会議録") && !href.includes("attachment")) {
        // attachment URL ならば会議録とみなす
        if (!href.includes("/uploaded/attachment/")) continue;
      }

      // 日付の構築
      let heldOn: string;
      if (yearMonth) {
        heldOn = parseDayFromCell(dateCell, yearMonth) ?? `${yearMonth}-01`;
      } else {
        // 月が見出しにない場合（臨時会等）は日付セルから年月日を取得
        heldOn = parseDayFromCellWithYear(dateCell, sectionYear!) ?? `${sectionYear!}-01-01`;
      }

      // PDF の完全 URL を構築
      let pdfUrl: string;
      if (href.startsWith("http")) {
        pdfUrl = href;
      } else if (href.startsWith("/")) {
        pdfUrl = `${BASE_ORIGIN}${href}`;
      } else {
        const baseUrl = pageUrl.replace(/\/[^/]*$/, "/");
        pdfUrl = baseUrl + href;
      }

      // タイトルを構築
      const cleanLinkText = linkText
        .replace(/\[PDFファイル[^\]]*\]/g, "")
        .replace(/\s+/g, " ")
        .trim();

      const title = `${currentSection} ${cleanLinkText}`.trim();

      results.push({
        pdfUrl,
        title,
        heldOn,
        section: currentSection,
      });
    }
  }

  return results;
}

/**
 * 指定年の全 PDF リンクを取得する。
 */
export async function fetchMeetingList(
  baseUrl: string,
  year: number
): Promise<MiyoshiMeeting[]> {
  // Step 1: 年度索引ページから年度別ページのリンクを取得
  const indexHtml = await fetchPage(baseUrl);
  if (!indexHtml) return [];

  const yearPages = parseIndexPage(indexHtml);
  const eraTexts = toJapaneseEra(year);

  // 対象年度のページを見つける
  const targetPages = yearPages.filter((p) =>
    eraTexts.some((era) => p.label.includes(era))
  );
  if (targetPages.length === 0) return [];

  // Step 2: 各年度ページから PDF リンクを抽出
  const allMeetings: MiyoshiMeeting[] = [];

  for (const targetPage of targetPages) {
    const yearHtml = await fetchPage(targetPage.url);
    if (!yearHtml) continue;

    const meetings = parseYearPage(yearHtml, targetPage.url);
    allMeetings.push(...meetings);
  }

  return allMeetings;
}
