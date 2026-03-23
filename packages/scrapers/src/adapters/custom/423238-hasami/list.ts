/**
 * 波佐見町議会 -- list フェーズ
 *
 * 会議録一覧ページ (4358.html) から全 PDF リンクを収集する。
 *
 * 一覧ページは単一ページ（ページネーションなし）で、
 * 全年度の会議録が1ページに掲載されている。
 *
 * 構造:
 *   年度見出しが <td> 等で「令和5年」「平成30年」のように表示され、
 *   PDF リンクは <a href="https://www.town.hasami.lg.jp/kiji003879/...pdf"> の形式。
 *   リンクテキストに「第N回定例会」「第N回臨時会 M月」等の会議名が記載される。
 *
 * 開催日はページ上に掲載されていないため、PDF 本文から抽出する（detail フェーズで実施）。
 */

import {
  convertHeadingToWesternYear,
  detectMeetingType,
  fetchPage,
  toHalfWidth,
} from "./shared";

export interface HasamiPdfLink {
  /** 会議タイトル（例: "第1回定例会"） */
  title: string;
  /** PDF の絶対 URL */
  pdfUrl: string;
  /** 会議種別 */
  meetingType: string;
  /** 年の見出しから取得した西暦年 */
  headingYear: number;
}

/**
 * リンクテキストから会議タイトルを正規化する。
 * 全角数字を半角に変換し、ファイルサイズ表記・&nbsp; を除去して余分な空白を除去する。
 */
export function normalizeLinkText(text: string): string {
  // img タグを除去
  const cleaned = text.replace(/<[^>]+>/g, "");
  // &nbsp; を除去
  const noNbsp = cleaned.replace(/&nbsp;/g, " ");
  // ファイルサイズ表記を除去: （PDF：1.08メガバイト）, （PDF：534.7キロバイト）
  const noSize = noNbsp.replace(/[（(]PDF[：:][^）)]*[）)]/g, "");
  return toHalfWidth(noSize.replace(/\s+/g, " ").trim());
}

/**
 * 一覧ページ HTML から PDF リンクをパースする。
 *
 * 年度見出しは <th scope="row"> 要素内に
 * <p>令</p><p>和</p><p>5</p><p>年</p> のように分割されて記述されている。
 * HTML タグを除去してからテキストを結合し、和暦年を検出する。
 *
 * PDF リンクは kiji003879 パスを含む絶対 URL の <a> タグで提供される。
 */
export function parseListPage(html: string): HasamiPdfLink[] {
  const results: HasamiPdfLink[] = [];

  // <th scope="row"> 要素から年度見出しを抽出する
  const thPattern = /<th\s+scope="row">([\s\S]*?)<\/th>/gi;
  const headings: { year: number; position: number }[] = [];
  let tm: RegExpExecArray | null;
  while ((tm = thPattern.exec(html)) !== null) {
    const innerText = toHalfWidth(tm[1]!.replace(/<[^>]+>/g, "").replace(/\s+/g, ""));
    const year = convertHeadingToWesternYear(innerText);
    if (year) {
      headings.push({ year, position: tm.index });
    }
  }

  // PDF リンクを収集（kiji003879 パスを含む .pdf リンク）
  const linkPattern =
    /<a\s[^>]*href="([^"]*kiji003879[^"]*\.pdf)"[^>]*>([\s\S]*?)<\/a>/gi;
  let lm: RegExpExecArray | null;
  while ((lm = linkPattern.exec(html)) !== null) {
    const pdfUrl = lm[1]!;
    const linkText = lm[2]!;
    const linkPosition = lm.index;

    const title = normalizeLinkText(linkText);
    if (!title) continue;

    // このリンクの直前の年度見出しを見つける
    let currentYear: number | null = null;
    for (const h of headings) {
      if (h.position < linkPosition) {
        currentYear = h.year;
      }
    }
    if (!currentYear) continue;

    // 絶対 URL に変換
    const absoluteUrl = pdfUrl.startsWith("http")
      ? pdfUrl
      : `https://www.town.hasami.lg.jp${pdfUrl.startsWith("/") ? "" : "/"}${pdfUrl}`;

    const meetingType = detectMeetingType(title);

    results.push({
      title,
      pdfUrl: absoluteUrl,
      meetingType,
      headingYear: currentYear,
    });
  }

  return results;
}

/**
 * 指定年の PDF リンクを収集する。
 *
 * baseUrl を取得し、全 PDF リンクをパースした後、
 * 対象年のものだけをフィルタリングして返す。
 */
export async function fetchDocumentList(
  baseUrl: string,
  year: number,
): Promise<HasamiPdfLink[]> {
  const html = await fetchPage(baseUrl);
  if (!html) return [];

  const allLinks = parseListPage(html);
  return allLinks.filter((link) => link.headingYear === year);
}
