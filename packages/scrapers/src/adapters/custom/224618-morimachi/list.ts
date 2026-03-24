/**
 * 森町議会（静岡県）— list フェーズ
 *
 * インデックスページから年度別ページの URL を収集し、
 * 各年度ページから PDF リンクを収集する。
 *
 * URL 構造:
 * - インデックス: https://www.town.morimachi.shizuoka.jp/gyosei/.../456.html
 * - 年度別:       https://www.town.morimachi.shizuoka.jp/gyosei/.../5/{ページID}.html
 * - PDF:          https://www.town.morimachi.shizuoka.jp/material/files/group/13/{日付コード}.pdf
 *
 * 年度別ページの HTML 構造:
 * - 各会議種別が見出しで区切られている
 * - 「令和X年X月定例会 本会議」等の見出しテキスト配下に PDF リンクが列挙される
 * - PDF リンクのテキスト: "令和X年X月X日 (PDFファイル: 498.6KB)"
 */

import {
  BASE_ORIGIN,
  INDEX_PATH,
  fetchPage,
  parseJapaneseDate,
} from "./shared";

export interface MorimachMeeting {
  pdfUrl: string;
  title: string;
  heldOn: string;
  section: string;
}

/**
 * インデックスページから年度別ページの URL 一覧を抽出する。
 *
 * リンクテキストが「【令和X年度】会議録」「【平成X年度】会議録」に
 * 一致するリンクを対象とする。
 */
export function parseIndexPage(html: string): string[] {
  const results: string[] = [];

  // .pageLink 内の <a> タグを抽出
  const linkRegex = /<a[^>]+href="([^"]*)"[^>]*>([\s\S]*?)<\/a>/gi;

  for (const match of html.matchAll(linkRegex)) {
    const href = match[1]!.trim();
    const text = match[2]!.replace(/<[^>]+>/g, "").trim();

    // 「【令和X年度】会議録」または「【平成X年度】会議録」にマッチするリンク
    if (/【(令和|平成)(元|\d+)年度】会議録/.test(text)) {
      let url: string;
      if (href.startsWith("//")) {
        url = `https:${href}`;
      } else if (href.startsWith("http")) {
        url = href;
      } else if (href.startsWith("/")) {
        url = `${BASE_ORIGIN}${href}`;
      } else {
        url = `${BASE_ORIGIN}/${href}`;
      }
      results.push(url);
    }
  }

  return results;
}

/**
 * 年度別ページの HTML から PDF リンクとメタ情報を抽出する。
 *
 * 見出しテキストから会議種別を取得し、各 PDF リンクに紐づける。
 * 各 PDF リンクのテキストには開催日が含まれる。
 *
 * 例:
 *   見出し: "令和6年12月定例会 本会議"
 *   リンク: "令和6年12月4日 (PDFファイル: 498.6KB)"
 */
export function parseYearPage(
  html: string,
  targetYear: number
): MorimachMeeting[] {
  const results: MorimachMeeting[] = [];

  let currentSection = "";

  // h2, h3, a[href$=".pdf"] を順に走査する
  const tagRegex =
    /<(h2|h3|h4)[^>]*>([\s\S]*?)<\/\1>|<a[^>]+href="([^"]*\.pdf)"[^>]*>([\s\S]*?)<\/a>/gi;

  for (const match of html.matchAll(tagRegex)) {
    const tag = match[1]?.toLowerCase();
    const tagContent = match[2]?.replace(/<[^>]+>/g, "").trim();

    if ((tag === "h2" || tag === "h3" || tag === "h4") && tagContent) {
      // 会議種別の見出し（「令和X年X月定例会 本会議」等）
      if (/(令和|平成|本会議|定例会|臨時会)/.test(tagContent)) {
        currentSection = tagContent;
      }
      continue;
    }

    // PDF リンクの処理
    const href = match[3];
    const linkText = match[4]?.replace(/<[^>]+>/g, "").trim();

    if (!href || !linkText) continue;

    // テキストから開催日を抽出
    const heldOn = parseJapaneseDate(linkText);
    if (!heldOn) continue;

    // 年度フィルタリング: heldOn の年 or 年度（4〜翌3月）でフィルタ
    const heldYear = Number(heldOn.slice(0, 4));
    const heldMonth = Number(heldOn.slice(5, 7));
    // 年度: 4月以降は同年度、1〜3月は前年度
    const fiscalYear = heldMonth >= 4 ? heldYear : heldYear - 1;

    if (fiscalYear !== targetYear) continue;

    // section の決定（見出しテキスト優先、なければ PDF ファイル名から推測）
    const section = currentSection || "本会議";

    // title の生成（見出しテキストから年度情報を除いたもの）
    const title = currentSection || `${heldOn.slice(0, 7)} 本会議`;

    // URL を正規化
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
      title,
      heldOn,
      section,
    });
  }

  return results;
}

/**
 * 指定年度の全 PDF リンクを取得する。
 *
 * 1. インデックスページから年度別ページの URL を収集
 * 2. 各年度ページから PDF リンクを収集
 */
export async function fetchDocumentList(
  _baseUrl: string,
  year: number
): Promise<MorimachMeeting[]> {
  const indexUrl = `${BASE_ORIGIN}${INDEX_PATH}`;
  const indexHtml = await fetchPage(indexUrl);
  if (!indexHtml) return [];

  const yearPageUrls = parseIndexPage(indexHtml);

  const results: MorimachMeeting[] = [];

  for (const yearPageUrl of yearPageUrls) {
    const html = await fetchPage(yearPageUrl);
    if (!html) continue;

    const meetings = parseYearPage(html, year);
    results.push(...meetings);
  }

  return results;
}
