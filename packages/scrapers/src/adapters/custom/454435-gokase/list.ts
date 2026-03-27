/**
 * 五ヶ瀬町議会 — list フェーズ
 *
 * 2段階で PDF リンクを収集する:
 * 1. トップページ (index.html) から年度別ページ URL を取得
 * 2. 年度別ページから PDF リンクとメタ情報を抽出
 *
 * HTML 構造:
 * - トップページ: ul.level1col2 > li.page > a で年度別ページへのリンク
 * - 年度別ページ: a.icon2 / a.pdf で PDF リンク（旧形式・新形式混在）
 *
 * リンクテキスト例: "令和6年第1回(3月)定例会会議録 (PDFファイル: 1.7MB)"
 */

import { BASE_ORIGIN, BASE_PATH, fetchPage, toJapaneseEra } from "./shared";

export interface GokaseMeeting {
  pdfUrl: string;
  title: string;
  heldOn: string;
  section: string;
}

/**
 * トップページから年度別ページのリンクを抽出する。
 */
export function parseTopPage(
  html: string
): { label: string; url: string }[] {
  const results: { label: string; url: string }[] = [];

  // ul.level1col2 内の li.page > a からリンクを抽出
  // 数値ID形式: /kaigiroku/1849.html, H形式: /kaigiroku/H29kaigiroku.html
  const linkRegex =
    /<a[^>]+href="([^"]*\/kaigiroku\/[^"]+\.html)"[^>]*>([^<]+)<\/a>/g;

  for (const match of html.matchAll(linkRegex)) {
    const href = match[1]!;
    const label = match[2]!.trim();

    if (!label.includes("会議録")) continue;

    let url: string;
    if (href.startsWith("http")) {
      url = href;
    } else if (href.startsWith("//")) {
      url = `https:${href}`;
    } else if (href.startsWith("/")) {
      url = `${BASE_ORIGIN}${href}`;
    } else {
      // 相対パスの場合
      url = `${BASE_ORIGIN}${BASE_PATH}/${href.replace(/^\.\//, "")}`;
    }

    results.push({ label, url });
  }

  return results;
}

/**
 * リンクテキストからメタ情報を抽出する。
 * e.g., "令和6年第1回(3月)定例会会議録 (PDFファイル: 1.7MB)"
 * → { eraYear: "令和6", num: "1", month: "3", type: "定例会" }
 */
export function parseMetaFromLinkText(text: string): {
  heldOn: string;
  section: string;
  title: string;
} | null {
  // パターン: {元号}{年}年第{回数}回({月}月){定例会|臨時会}会議録
  const match = text.match(
    /(令和|平成)(元|\d+)年第(\d+)回[（(](\d+)月[）)](定例会|臨時会)会議録/
  );
  if (!match) return null;

  const [, era, eraYearRaw, num, month, meetingType] = match;
  const eraYear = eraYearRaw === "元" ? 1 : Number(eraYearRaw);

  let westernYear: number;
  if (era === "令和") westernYear = eraYear + 2018;
  else if (era === "平成") westernYear = eraYear + 1988;
  else return null;

  // heldOn: 月情報を使って YYYY-MM-01 とする（日は不明なので1日固定）
  const heldOn = `${westernYear}-${String(Number(month)).padStart(2, "0")}-01`;

  const section = `第${num}回${meetingType}`;
  const title = `${era}${eraYearRaw === "元" ? "元" : eraYearRaw}年${section}`;

  return { heldOn, section, title };
}

/**
 * 年度別ページの HTML から PDF リンクを抽出する（テスト可能な純粋関数）。
 *
 * 旧形式: div.wysiwyg 内の a.icon2[href$=".pdf"]
 * 新形式: p.file-link-item a.pdf[href$=".pdf"]
 */
export function parseYearPage(html: string): GokaseMeeting[] {
  const results: GokaseMeeting[] = [];

  // 統合セレクタ: a.icon2 と a.pdf の両方に対応
  const linkRegex =
    /<a[^>]+href="([^"]+\.pdf)"[^>]*>([\s\S]*?)<\/a>/gi;

  for (const match of html.matchAll(linkRegex)) {
    const href = match[1]!;
    const linkText = match[2]!.replace(/<[^>]+>/g, "").trim();

    const meta = parseMetaFromLinkText(linkText);
    if (!meta) continue;

    // プロトコル相対 URL を https に変換
    let pdfUrl: string;
    if (href.startsWith("//")) {
      pdfUrl = `https:${href}`;
    } else if (href.startsWith("http")) {
      pdfUrl = href;
    } else if (href.startsWith("/")) {
      pdfUrl = `${BASE_ORIGIN}${href}`;
    } else {
      pdfUrl = `${BASE_ORIGIN}/${href}`;
    }

    results.push({
      pdfUrl,
      title: meta.title,
      heldOn: meta.heldOn,
      section: meta.section,
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
): Promise<GokaseMeeting[]> {
  // Step 1: トップページから年度別ページのリンクを取得
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

  return parseYearPage(yearHtml);
}
