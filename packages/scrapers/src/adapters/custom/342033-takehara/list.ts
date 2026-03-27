/**
 * 竹原市議会 — list フェーズ
 *
 * 2段階で PDF リンクを収集する:
 * 1. 年度索引ページから対象年度のページ URL を取得
 * 2. 年度別ページから PDF リンクとメタ情報を抽出
 *
 * 年度索引ページ: https://www.city.takehara.lg.jp/gyoseijoho/takeharashigikai/kaiginokekka/2/index.html
 * 年度別ページ: https://www.city.takehara.lg.jp/gyoseijoho/takeharashigikai/kaiginokekka/2/{ページID}.html
 * PDF リンク: /material/files/group/20/{ファイル名}.pdf
 *
 * 年度別ページ構造:
 * - セクション見出し: 定例会・臨時会ごとに区切り
 * - 本会議・委員会の PDF リンクが列挙される
 */

import { BASE_ORIGIN, fetchPage, toHalfWidth, toJapaneseEra } from "./shared";

export interface TakeharaMeeting {
  pdfUrl: string;
  title: string;
  heldOn: string;
  section: string;
}

/**
 * 年度索引ページから年度別ページのリンクを抽出する。
 * /gyoseijoho/takeharashigikai/kaiginokekka/2/{ID}.html 形式のリンクを収集する。
 */
export function parseIndexPage(
  html: string
): { label: string; url: string }[] {
  const results: { label: string; url: string }[] = [];

  // /gyoseijoho/takeharashigikai/kaiginokekka/2/{ID}.html 形式のリンクを抽出
  const linkRegex =
    /<a[^>]+href="([^"]*\/gyoseijoho\/takeharashigikai\/kaiginokekka\/2\/\d+(?:\.html)?)"[^>]*>([\s\S]*?)<\/a>/g;

  for (const match of html.matchAll(linkRegex)) {
    const href = match[1]!;
    const label = match[2]!.replace(/<[^>]+>/g, "").trim();

    // 年度リンク（令和・平成を含む）のみ対象
    if (!/(令和|平成)/.test(label)) continue;

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
 * セクション見出しから年と月を抽出して YYYY-MM 形式を返す。
 * 例: "令和6年第4回定例会（12月10日〜12月20日）" → "2024-12"
 * 例: "令和元年9月定例会" → "2019-09"
 * 例: "平成30年第3回定例会（9月10日〜）" → "2018-09"
 */
export function parseSectionDate(section: string): string | null {
  const normalized = toHalfWidth(section);

  // まず月を括弧内（「12月」形式）から探す
  const monthInParens = normalized.match(/[（(].*?(\d+)月/);
  if (monthInParens) {
    const eraMatch = normalized.match(/(令和|平成)\s*(元|\d+)\s*年/);
    if (eraMatch) {
      const era = eraMatch[1]!;
      const eraYear = eraMatch[2] === "元" ? 1 : parseInt(eraMatch[2]!, 10);
      const month = parseInt(monthInParens[1]!, 10);
      let westernYear: number;
      if (era === "令和") westernYear = eraYear + 2018;
      else if (era === "平成") westernYear = eraYear + 1988;
      else return null;
      return `${westernYear}-${String(month).padStart(2, "0")}`;
    }
  }

  // 見出し自体に月が含まれる場合: "令和6年12月定例会"
  const match = normalized.match(
    /(令和|平成)\s*(元|\d+)\s*年\s*(\d+)\s*月/
  );
  if (match) {
    const era = match[1]!;
    const eraYear = match[2] === "元" ? 1 : parseInt(match[2]!, 10);
    const month = parseInt(match[3]!, 10);

    let westernYear: number;
    if (era === "令和") westernYear = eraYear + 2018;
    else if (era === "平成") westernYear = eraYear + 1988;
    else return null;

    return `${westernYear}-${String(month).padStart(2, "0")}`;
  }

  return null;
}

/**
 * セクション見出しから西暦年のみを抽出する。
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
 * リンクテキストまたは周辺テキストから日付を抽出する。
 * 例: "12月10日" → "2024-12-10"
 */
export function parseDateFromText(text: string, yearMonth: string): string | null {
  const normalized = toHalfWidth(text);
  const match = normalized.match(/(\d+)月(\d+)日/);
  if (!match) return null;

  const day = parseInt(match[2]!, 10);
  // yearMonth の月と一致するかチェック
  const ymMonth = parseInt(yearMonth.split("-")[1]!, 10);
  const textMonth = parseInt(match[1]!, 10);

  if (textMonth === ymMonth) {
    return `${yearMonth}-${String(day).padStart(2, "0")}`;
  }

  // 月が異なる場合（会期をまたぐ場合）は年のみ使う
  const year = yearMonth.split("-")[0]!;
  return `${year}-${String(textMonth).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

/**
 * テキストから日付（月日）を抽出して年付き完全日付を返す。
 * 例: "12月10日", 2024 → "2024-12-10"
 */
export function parseDateWithYear(text: string, year: number): string | null {
  const normalized = toHalfWidth(text);
  const match = normalized.match(/(\d+)月(\d+)日/);
  if (!match) return null;

  const month = parseInt(match[1]!, 10);
  const day = parseInt(match[2]!, 10);
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

/**
 * セクション見出しの開始日を抽出する。
 * 例: "令和6年第4回定例会（12月10日〜12月20日）" → "2024-12-10"
 * 例: "令和6年第1回臨時会（11月18日）" → "2024-11-18"
 */
export function parseSectionStartDate(section: string): string | null {
  const normalized = toHalfWidth(section);

  // 括弧内の最初の日付を抽出
  const parenMatch = normalized.match(/[（(](\d+)月(\d+)日/);
  if (parenMatch) {
    const eraMatch = normalized.match(/(令和|平成)\s*(元|\d+)\s*年/);
    if (eraMatch) {
      const era = eraMatch[1]!;
      const eraYear = eraMatch[2] === "元" ? 1 : parseInt(eraMatch[2]!, 10);
      let westernYear: number;
      if (era === "令和") westernYear = eraYear + 2018;
      else if (era === "平成") westernYear = eraYear + 1988;
      else return null;

      const month = parseInt(parenMatch[1]!, 10);
      const day = parseInt(parenMatch[2]!, 10);
      return `${westernYear}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    }
  }

  return null;
}

/**
 * 年度別ページの HTML から PDF リンクを抽出する（テスト可能な純粋関数）。
 *
 * 構造:
 * - セクション見出し（h2/h3/strong/li 等）: 定例会・臨時会ごとに区切り
 * - 各セクション内に本会議・委員会の PDF リンクが列挙される
 *
 * PDF リンク形式: <a href="/material/files/group/20/{ファイル名}.pdf">[リンクテキスト]</a>
 */
export function parseYearPage(
  html: string,
  pageUrl: string
): TakeharaMeeting[] {
  const results: TakeharaMeeting[] = [];

  // セクション見出し（定例会・臨時会を含む）の位置を収集
  // h2, h3, または strong タグの見出しを探す
  const sections: { index: number; name: string }[] = [];
  const headingPattern = /<(?:h[2-4]|strong|b)[^>]*>([\s\S]*?)<\/(?:h[2-4]|strong|b)>/gi;

  for (const match of html.matchAll(headingPattern)) {
    const text = match[1]!.replace(/<[^>]+>/g, "").trim();
    if (!text.includes("定例会") && !text.includes("臨時会")) continue;
    if (!/(令和|平成)/.test(text)) continue;
    sections.push({ index: match.index!, name: text });
  }

  // li タグ内のテキストもセクションとして検出（リスト形式のページに対応）
  const liSectionPattern = /<li[^>]*>([\s\S]*?)<\/li>/gi;
  for (const match of html.matchAll(liSectionPattern)) {
    const text = match[1]!.replace(/<[^>]+>/g, "").trim();
    if (!text.includes("定例会") && !text.includes("臨時会")) continue;
    if (!/(令和|平成)/.test(text)) continue;
    // PDF リンクを含まない li のみセクションとして扱う
    if (match[1]!.includes(".pdf")) continue;
    sections.push({ index: match.index!, name: text });
  }

  sections.sort((a, b) => a.index - b.index);

  if (sections.length === 0) return results;

  // PDF リンクを全て抽出して各セクションに割り当て
  const pdfLinkPattern = /<a[^>]+href="([^"]+\.pdf)"[^>]*>([\s\S]*?)<\/a>/gi;

  for (const linkMatch of html.matchAll(pdfLinkPattern)) {
    const linkIndex = linkMatch.index!;
    const href = linkMatch[1]!;
    const linkText = linkMatch[2]!.replace(/<[^>]+>/g, "").trim();

    // /material/files/ または .pdf を含む PDF リンクのみ対象
    if (!href.includes(".pdf")) continue;

    // 現在のセクションを特定
    let currentSection = "";
    for (const section of sections) {
      if (section.index < linkIndex) {
        currentSection = section.name;
      }
    }
    if (!currentSection) continue;

    // PDF の完全 URL を構築
    let pdfUrl: string;
    if (href.startsWith("http")) {
      pdfUrl = href;
    } else if (href.startsWith("//")) {
      pdfUrl = `https:${href}`;
    } else if (href.startsWith("/")) {
      pdfUrl = `${BASE_ORIGIN}${href}`;
    } else {
      const baseUrl = pageUrl.replace(/\/[^/]*$/, "/");
      pdfUrl = baseUrl + href;
    }

    // 日付を取得: セクション見出しから開始日を取得
    const sectionStartDate = parseSectionStartDate(currentSection);
    const yearMonth = parseSectionDate(currentSection);
    const sectionYear = parseSectionYear(currentSection);

    let heldOn: string;
    if (sectionStartDate) {
      // リンクテキストに日付があればそちらを優先
      const textDate = yearMonth
        ? parseDateFromText(linkText, yearMonth)
        : sectionYear
          ? parseDateWithYear(linkText, sectionYear)
          : null;
      heldOn = textDate ?? sectionStartDate;
    } else if (yearMonth) {
      const textDate = parseDateFromText(linkText, yearMonth);
      heldOn = textDate ?? `${yearMonth}-01`;
    } else if (sectionYear) {
      const textDate = parseDateWithYear(linkText, sectionYear);
      heldOn = textDate ?? `${sectionYear}-01-01`;
    } else {
      continue;
    }

    // タイトルを構築
    const cleanLinkText = linkText
      .replace(/\[PDFファイル[^\]]*\]/g, "")
      .replace(/\s+/g, " ")
      .trim();

    const title = cleanLinkText
      ? `${currentSection} ${cleanLinkText}`.trim()
      : currentSection;

    results.push({
      pdfUrl,
      title,
      heldOn,
      section: currentSection,
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
): Promise<TakeharaMeeting[]> {
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
  const allMeetings: TakeharaMeeting[] = [];

  for (const targetPage of targetPages) {
    const yearHtml = await fetchPage(targetPage.url);
    if (!yearHtml) continue;

    const meetings = parseYearPage(yearHtml, targetPage.url);
    allMeetings.push(...meetings);
  }

  return allMeetings;
}
