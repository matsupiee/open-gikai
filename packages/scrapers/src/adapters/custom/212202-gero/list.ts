/**
 * 下呂市議会 — list フェーズ
 *
 * 3段階で PDF リンクを収集する:
 * 1. トップページ (list69.html) から年度別インデックスのリンクを取得
 * 2. 年度別インデックスから年度別会議録一覧ページの URL を取得
 * 3. 年度別会議録一覧から各会議の詳細ページ URL とメタ情報を抽出
 *
 * 各会議の詳細ページ URL と会議種別情報を detailParams として返す。
 * detail フェーズで各詳細ページから PDF をダウンロードし発言をパースする。
 */

import { BASE_ORIGIN, fetchPage, toJapaneseEra } from "./shared";

export interface GeroMeetingEntry {
  /** 会議詳細ページ URL */
  detailUrl: string;
  /** 会議タイトル (例: "第2回　定例会　令和7年2月25日から3月24日") */
  title: string;
  /** セクション名 (例: "定例会・臨時会", "民生教育まちづくり常任委員会") */
  section: string;
}

/**
 * トップページ (list69.html) から年度別インデックスのリンクを抽出する。
 */
export function parseTopPage(
  html: string,
): { label: string; url: string }[] {
  const results: { label: string; url: string }[] = [];

  // list69-{ID}.html へのリンクを抽出
  const linkRegex =
    /<a[^>]+href="([^"]*list69-\d+\.html)"[^>]*>([^<]+)<\/a>/g;

  for (const match of html.matchAll(linkRegex)) {
    const href = match[1]!;
    const label = match[2]!.trim();

    const url = href.startsWith("http")
      ? href
      : `${BASE_ORIGIN}${href.startsWith("/") ? "" : "/"}${href}`;

    results.push({ label, url });
  }

  return results;
}

/**
 * 年度別インデックスページから年度別会議録一覧ページの URL を抽出する。
 * 各年度インデックスには通常 1 件のリンク (例: "令和7年下呂市議会会議録") が掲載される。
 */
export function parseIndexPage(
  html: string,
): { label: string; url: string }[] {
  const results: { label: string; url: string }[] = [];

  // /site/gikai/{数字}.html へのリンクを抽出（list69 ではないもの）
  const linkRegex =
    /<a[^>]+href="([^"]*\/site\/gikai\/(\d+)\.html)"[^>]*>([^<]+)<\/a>/g;

  for (const match of html.matchAll(linkRegex)) {
    const href = match[1]!;
    const label = match[3]!.trim();

    // list69 系のナビゲーションリンクは除外
    if (href.includes("list69")) continue;
    // 会議録に関するリンクのみ
    if (!label.includes("会議録")) continue;

    const url = href.startsWith("http")
      ? href
      : `${BASE_ORIGIN}${href.startsWith("/") ? "" : "/"}${href}`;

    results.push({ label, url });
  }

  return results;
}

/**
 * 和暦の日付テキストから YYYY-MM-DD を返す。
 * "令和7年1月28日" → "2025-01-28"
 * 「元年」にも対応。
 */
export function parseDateText(text: string): string | null {
  const match = text.match(/(令和|平成)(元|\d+)年(\d+)月(\d+)日/);
  if (!match) return null;

  const [, era, eraYearStr, monthStr, dayStr] = match;
  const eraYear = eraYearStr === "元" ? 1 : Number.parseInt(eraYearStr!, 10);
  const month = Number.parseInt(monthStr!, 10);
  const day = Number.parseInt(dayStr!, 10);

  let westernYear: number;
  if (era === "令和") westernYear = eraYear + 2018;
  else if (era === "平成") westernYear = eraYear + 1988;
  else return null;

  return `${westernYear}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

/**
 * 年度別会議録一覧ページから各会議の詳細ページリンクとメタ情報を抽出する。
 *
 * 構造:
 * - <h3>【定例会・臨時会】</h3> でセクション分け
 * - <h4>民生教育まちづくり常任委員会</h4> でサブセクション
 * - <a href="/site/gikai/{ID}.html">第1回 臨時会 令和7年1月28日</a>
 */
export function parseYearlyPage(html: string): GeroMeetingEntry[] {
  const results: GeroMeetingEntry[] = [];

  // セクション見出し（h3）の位置を収集
  const sections: { index: number; name: string }[] = [];
  const h3Pattern = /<h3[^>]*>([^<]*)<\/h3>/g;
  for (const match of html.matchAll(h3Pattern)) {
    const name = match[1]!
      .replace(/^【/, "")
      .replace(/】$/, "")
      .replace(/】/, "")
      .trim();
    sections.push({ index: match.index!, name });
  }

  // サブセクション見出し（h4）— 委員会名
  const h4Pattern = /<h4[^>]*>([^<]*)<\/h4>/g;
  for (const match of html.matchAll(h4Pattern)) {
    const name = match[1]!.trim();
    if (name) {
      sections.push({ index: match.index!, name });
    }
  }

  sections.sort((a, b) => a.index - b.index);

  // /site/gikai/{数字}.html へのリンクを抽出
  const linkPattern =
    /<a[^>]+href="([^"]*\/site\/gikai\/(\d+)\.html)"[^>]*>([\s\S]*?)<\/a>/gi;

  for (const match of html.matchAll(linkPattern)) {
    const linkIndex = match.index!;
    const href = match[1]!;
    const linkText = match[3]!.replace(/<[^>]+>/g, "").trim();

    // list69 系のナビゲーションリンクは除外
    if (href.includes("list69")) continue;
    // 会議録一覧ページ自体へのリンクは除外
    if (linkText.includes("会議録") && !linkText.includes("第")) continue;

    // 現在のセクションを特定
    let currentSection = "";
    for (const section of sections) {
      if (section.index < linkIndex) {
        currentSection = section.name;
      }
    }

    const url = href.startsWith("http")
      ? href
      : `${BASE_ORIGIN}${href.startsWith("/") ? "" : "/"}${href}`;

    results.push({
      detailUrl: url,
      title: linkText,
      section: currentSection,
    });
  }

  return results;
}

/**
 * 会議詳細ページから会議録 PDF の URL を抽出する。
 * 目次 PDF は除外し、会議録本文 PDF のみを返す。
 * 各 PDF のリンクテキストから日付も抽出する。
 */
export function parseDetailPage(
  html: string,
): { pdfUrl: string; linkText: string; heldOn: string }[] {
  const results: { pdfUrl: string; linkText: string; heldOn: string }[] = [];

  // /uploaded/attachment/{ID}.pdf へのリンクを抽出
  const linkPattern =
    /<a[^>]+href="([^"]*\/uploaded\/attachment\/\d+\.pdf)"[^>]*>([\s\S]*?)<\/a>/gi;

  for (const match of html.matchAll(linkPattern)) {
    const href = match[1]!;
    const linkText = match[2]!.replace(/<[^>]+>/g, "").trim();

    // 目次 PDF はスキップ
    if (linkText.includes("目次")) continue;
    // 議員提出議案などの資料 PDF もスキップ
    if (linkText.includes("議案")) continue;
    // 委員会資料もスキップ
    if (linkText.includes("資料") && !linkText.includes("会議録")) continue;

    // 会議録 PDF のみ対象（「会議録」を含むリンク）
    if (!linkText.includes("会議録")) continue;

    // リンクテキストから日付を抽出
    const heldOn = parseDateText(linkText);
    if (!heldOn) continue;

    const pdfUrl = href.startsWith("http")
      ? href
      : `${BASE_ORIGIN}${href.startsWith("/") ? "" : "/"}${href}`;

    results.push({ pdfUrl, linkText, heldOn });
  }

  return results;
}

/**
 * 会議詳細ページから日付テキストを抽出する (フォールバック用)。
 * "日時　令和7年1月28日（火曜日）午前9時00分" のパターンにマッチ。
 */
export function parseDateFromDetailPage(html: string): string | null {
  // テキスト中の日時表記を検索
  const match = html.match(
    /日時[　\s]+(令和|平成)(元|\d+)年(\d+)月(\d+)日/,
  );
  if (!match) return null;
  return parseDateText(match[0]);
}

/**
 * 指定年の全会議エントリーを取得する。
 */
export async function fetchMeetingList(
  baseUrl: string,
  year: number,
): Promise<GeroMeetingEntry[]> {
  // Step 1: トップページから年度別インデックスのリンクを取得
  const topHtml = await fetchPage(baseUrl);
  if (!topHtml) return [];

  const indexPages = parseTopPage(topHtml);
  const eraTexts = toJapaneseEra(year);

  // 対象年度のインデックスページを見つける
  const targetIndex = indexPages.find((p) =>
    eraTexts.some((era) => p.label.includes(era)),
  );
  if (!targetIndex) return [];

  // Step 2: インデックスページから年度別会議録一覧ページの URL を取得
  const indexHtml = await fetchPage(targetIndex.url);
  if (!indexHtml) return [];

  const yearlyPages = parseIndexPage(indexHtml);
  if (yearlyPages.length === 0) return [];

  // Step 3: 年度別会議録一覧ページから各会議の詳細リンクを取得
  const yearlyHtml = await fetchPage(yearlyPages[0]!.url);
  if (!yearlyHtml) return [];

  return parseYearlyPage(yearlyHtml);
}
