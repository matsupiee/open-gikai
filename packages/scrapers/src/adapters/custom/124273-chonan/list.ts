/**
 * 長南町議会 -- list フェーズ
 *
 * 2段階で PDF リンクを収集する:
 * 1. 会議録一覧ページから対象年度のページ URL を取得
 * 2. 年度別ページから PDF リンクとメタ情報を抽出
 *
 * サイト構造:
 * - 一覧: <ul><li><a href=".../{記事ID}/">令和X年 会議録</a></li>...</ul>
 * - 年度別: <h3>令和X年第Y回定例会</h3> の下に PDF リンク
 * - PDF リンクテキスト: "令和X年第Y回定例会第Z号　M月D日" or "目次"
 */

import { BASE_ORIGIN, fetchPage, toJapaneseEra } from "./shared";

export interface ChonanMeeting {
  pdfUrl: string;
  title: string;
  heldOn: string;
  section: string;
}

/**
 * 会議録一覧ページから年度別ページのリンクを抽出する。
 */
export function parseTopPage(
  html: string
): { label: string; url: string }[] {
  const results: { label: string; url: string }[] = [];

  // WordPress サイト: <a href="https://.../{記事ID}/">令和X年 会議録</a>
  // or <a href="/chousei/gikai/会議録/{記事ID}/">令和X年 会議録</a>
  const linkRegex =
    /<a[^>]+href="([^"]*)"[^>]*>([^<]*会議録[^<]*)<\/a>/gi;

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
 * 和暦の開催日テキストから YYYY-MM-DD を返す。
 * e.g., "令和6年12月3日" → "2024-12-03"
 * 全角数字にも対応。
 */
export function parseDateText(text: string): string | null {
  // 全角数字を半角に変換
  const normalized = text.replace(/[０-９]/g, (c) =>
    String.fromCharCode(c.charCodeAt(0) - 0xfee0)
  );

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

/**
 * リンクテキストから会議タイトルを抽出する。
 * e.g., "令和６年第４回定例会第１号　12月3日" → section="令和6年第4回定例会"
 */
export function parseLinkText(linkText: string): {
  section: string;
  issueNumber: string;
  month: number;
  day: number;
} | null {
  // 全角数字を半角に変換
  const normalized = linkText.replace(/[０-９]/g, (c) =>
    String.fromCharCode(c.charCodeAt(0) - 0xfee0)
  );

  const match = normalized.match(
    /((?:令和|平成)\d+年第\d+回(?:定例会|臨時会))第(\d+)号[\s　]+(\d+)月(\d+)日/
  );
  if (!match) return null;

  return {
    section: match[1]!,
    issueNumber: match[2]!,
    month: parseInt(match[3]!, 10),
    day: parseInt(match[4]!, 10),
  };
}

/**
 * 年度別ページの HTML から PDF リンクを抽出する（テスト可能な純粋関数）。
 *
 * 構造:
 * - <h3>令和６年第４回定例会</h3> でセクション分け
 * - <a href="https://...pdf">令和６年第４回定例会第１号　12月3日</a> で PDF リンク
 * - "目次" リンクはスキップ
 */
export function parseYearPage(
  html: string,
  _pageUrl: string
): ChonanMeeting[] {
  const results: ChonanMeeting[] = [];

  // セクション見出しの位置を収集 (<h3>令和X年第Y回定例会</h3>)
  const sections: { index: number; name: string }[] = [];
  const sectionPattern =
    /<h[234][^>]*>([^<]*(?:定例会|臨時会)[^<]*)<\/h[234]>/gi;
  for (const match of html.matchAll(sectionPattern)) {
    sections.push({
      index: match.index!,
      name: match[1]!.trim(),
    });
  }

  sections.sort((a, b) => a.index - b.index);

  // PDF リンクを抽出
  const linkPattern =
    /<a[^>]+href="([^"]+\.pdf)"[^>]*>([\s\S]*?)<\/a>/gi;

  for (const match of html.matchAll(linkPattern)) {
    const linkIndex = match.index!;
    const href = match[1]!;
    const linkText = match[2]!.replace(/<[^>]+>/g, "").trim();

    // "目次" リンクはスキップ
    if (linkText === "目次") continue;

    // 現在のセクションを特定
    let currentSection = "";
    for (const section of sections) {
      if (section.index < linkIndex) {
        currentSection = section.name;
      }
    }

    // リンクテキストから日付情報を抽出
    const parsed = parseLinkText(linkText);
    if (!parsed) {
      // parseLinkText でマッチしない場合はリンクテキストから直接日付を試みる
      const heldOn = parseDateText(linkText);
      if (!heldOn) continue;

      const pdfUrl = href.startsWith("http")
        ? href
        : `${BASE_ORIGIN}${href.startsWith("/") ? "" : "/"}${href}`;

      results.push({
        pdfUrl,
        title: currentSection ? `${currentSection} ${linkText}` : linkText,
        heldOn,
        section: currentSection,
      });
      continue;
    }

    // 年度を heldOn から決定するためセクション名の和暦をパース
    const eraMatch = parsed.section.match(/(令和|平成)(\d+)年/);
    if (!eraMatch) continue;

    const eraYear = parseInt(eraMatch[2]!, 10);
    const westernYear =
      eraMatch[1] === "令和" ? eraYear + 2018 : eraYear + 1988;
    const heldOn = `${westernYear}-${String(parsed.month).padStart(2, "0")}-${String(parsed.day).padStart(2, "0")}`;

    // PDF の完全 URL を構築
    const pdfUrl = href.startsWith("http")
      ? href
      : `${BASE_ORIGIN}${href.startsWith("/") ? "" : "/"}${href}`;

    const title = `${parsed.section}第${parsed.issueNumber}号`;

    results.push({ pdfUrl, title, heldOn, section: parsed.section });
  }

  return results;
}

/**
 * 指定年の全 PDF リンクを取得する。
 */
export async function fetchMeetingList(
  baseUrl: string,
  year: number
): Promise<ChonanMeeting[]> {
  // baseUrl は議会トップ（/chousei/gikai/）を指すため、会議録サブページへ遷移
  const kaigirokuUrl = baseUrl.replace(/\/?$/, "/%e4%bc%9a%e8%ad%b0%e9%8c%b2/");

  // Step 1: 会議録一覧ページから年度別ページのリンクを取得
  const topHtml = await fetchPage(kaigirokuUrl);
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
