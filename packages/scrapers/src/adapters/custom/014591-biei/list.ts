/**
 * 美瑛町議会 — list フェーズ
 *
 * 2段階で PDF リンクを収集する:
 * 1. トップページから対象年度のページ URL を取得
 * 2. 年度別ページから会議録 PDF リンクとメタ情報を抽出
 *
 * 会議録 PDF の判別:
 * - アンカーテキストに「令和○年○月○日」等の開催日を含むものが会議録
 * - 「議案」「資料」「審議結果」等のテキストのものは対象外
 */

import {
  BASE_ORIGIN,
  fetchPage,
  normalizeDigits,
  toJapaneseEra,
} from "./shared";

export interface BieiMeeting {
  pdfUrl: string;
  title: string;
  heldOn: string;
  section: string;
}

/**
 * トップページから年度別ページのリンクを抽出する。
 * 各リンクのテキスト（例: "令和７年　会議録"）と URL を返す。
 */
export function parseTopPage(
  html: string,
  baseUrl: string
): { label: string; url: string }[] {
  const results: { label: string; url: string }[] = [];

  const linkRegex =
    /<a[^>]+href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/gi;

  for (const match of html.matchAll(linkRegex)) {
    const href = match[1]!;
    // HTML タグを除去してテキストのみ取得
    const label = match[2]!.replace(/<[^>]+>/g, "").trim();

    if (!label.includes("会議録")) continue;
    // トップページ自身のリンクやアンカーリンクはスキップ
    if (href === "#" || href.endsWith("proceedings/")) continue;

    const url = href.startsWith("http")
      ? href
      : href.startsWith("/")
        ? `${BASE_ORIGIN}${href}`
        : `${baseUrl.replace(/\/[^/]*$/, "/")}${href}`;

    results.push({ label: normalizeDigits(label), url });
  }

  return results;
}

/**
 * 和暦の開催日テキストから YYYY-MM-DD を返す。
 * e.g., "令和７年１２月１１日（木）開催" → "2025-12-11"
 */
export function parseDateText(text: string): string | null {
  const normalized = normalizeDigits(text);
  const match = normalized.match(/(令和|平成)(\d+)年(\d+)月(\d+)日/);
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

/** 会議録以外の文書（議案・資料・審議結果等）を除外するフィルタ */
function isMinutesLink(linkText: string, href: string): boolean {
  const text = normalizeDigits(linkText);
  // 開催日を含むリンクは会議録とみなす
  if (/(令和|平成)\d+年\d+月\d+日/.test(text)) return true;
  // 「会議録」を含むリンクも対象
  if (text.includes("会議録")) return true;
  // ファイル名に kaigiroku を含むものも対象
  if (/kaigiroku/i.test(href)) return true;
  return false;
}

/** 除外すべきリンクテキストか判定 */
function isExcludedLink(linkText: string, href: string): boolean {
  const text = normalizeDigits(linkText);
  const excludeTexts = [
    "議案",
    "資料",
    "審議結果",
    "予算",
    "執行方針",
    "別冊",
  ];
  for (const ex of excludeTexts) {
    if (text === ex || (text.includes(ex) && !text.includes("開催"))) {
      // ファイル名が kaigiroku を含む場合は除外しない
      if (/kaigiroku/i.test(href)) return false;
      return true;
    }
  }
  const excludeFiles = [
    "gian",
    "shiryo",
    "siryou",
    "shingikekka",
    "kekka",
    "kakka",
    "yosansho",
    "yosansetsumeisho",
    "shikkou",
  ];
  const filename = href.split("/").pop() ?? "";
  for (const ex of excludeFiles) {
    if (filename.includes(ex) && !filename.includes("kaigiroku")) return true;
  }
  return false;
}

/**
 * 年度別ページの HTML から会議録 PDF リンクを抽出する（テスト可能な純粋関数）。
 *
 * 構造:
 * - <h3> 見出しで会議区分（例: "第7回定例会（12月14日～15日）"）
 * - 見出しの下に <p> で PDF リンクを列挙
 * - アンカーテキストに「令和○年○月○日（曜日）開催」を含むものが会議録
 */
export function parseYearPage(
  html: string,
  pageUrl: string
): BieiMeeting[] {
  const results: BieiMeeting[] = [];

  // h3 見出しの位置を収集（会議区分を特定）
  const sections: { index: number; name: string }[] = [];
  const headingPattern =
    /<h3[^>]*>([\s\S]*?)<\/h3>/gi;
  for (const match of html.matchAll(headingPattern)) {
    const rawText = match[1]!.replace(/<[^>]+>/g, "").trim();
    sections.push({
      index: match.index!,
      name: rawText,
    });
  }

  sections.sort((a, b) => a.index - b.index);

  // PDF リンクを抽出
  const linkPattern = /<a[^>]+href="([^"]+\.pdf)"[^>]*>([\s\S]*?)<\/a>/gi;

  // pageUrl からベース URL を構築
  const baseUrl = pageUrl.replace(/\/[^/]+$/, "/");

  for (const match of html.matchAll(linkPattern)) {
    const linkIndex = match.index!;
    const href = match[1]!;
    const linkText = match[2]!.replace(/<[^>]+>/g, "").trim();

    // 除外対象の文書をスキップ
    if (isExcludedLink(linkText, href)) continue;
    // 会議録リンクでなければスキップ
    if (!isMinutesLink(linkText, href)) continue;

    // 現在のセクション（h3 見出し）を特定
    let currentSection = "";
    for (const section of sections) {
      if (section.index < linkIndex) {
        currentSection = section.name;
      }
    }

    // リンクテキストから開催日を抽出
    const heldOn = parseDateText(linkText);
    if (!heldOn) continue;

    // PDF の完全 URL を構築
    let pdfUrl: string;
    if (href.startsWith("http")) {
      pdfUrl = href;
    } else if (href.startsWith("/")) {
      pdfUrl = `${BASE_ORIGIN}${href}`;
    } else {
      pdfUrl = baseUrl + href;
    }

    // タイトルを構築
    const cleanLinkText = normalizeDigits(
      linkText.replace(/PDF\([^)]*\)/g, "").trim()
    );
    const title = currentSection
      ? `${currentSection} ${cleanLinkText}`
      : cleanLinkText;

    results.push({ pdfUrl, title, heldOn, section: currentSection });
  }

  return results;
}

/**
 * 指定年の全会議録 PDF リンクを取得する。
 */
export async function fetchMeetingList(
  baseUrl: string,
  year: number
): Promise<BieiMeeting[]> {
  // Step 1: トップページから年度別ページのリンクを取得
  const topHtml = await fetchPage(baseUrl);
  if (!topHtml) return [];

  const yearPages = parseTopPage(topHtml, baseUrl);
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
