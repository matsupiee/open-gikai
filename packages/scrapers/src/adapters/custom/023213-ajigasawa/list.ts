/**
 * 鰺ヶ沢町議会 — list フェーズ
 *
 * 単一ページ gikai-kaigiroku.html から全 PDF リンクを収集する。
 * h2 で年度別に見出しが分かれ、各見出しの下に PDF リンクが並ぶ。
 */

import { LIST_URL, fetchPage, toReiwaYear } from "./shared";

export interface AjigasawaMeeting {
  /** PDF の絶対 URL */
  pdfUrl: string;
  /** 会議タイトル（リンクテキストから PDF サイズ情報を除去したもの） */
  title: string;
  /** 開催日 YYYY-MM-DD（開催期間がある場合は初日） */
  heldOn: string;
  /** PDF ファイル名（拡張子なし） */
  fileKey: string;
}

/**
 * リンクテキストから開催日を抽出して YYYY-MM-DD を返す。
 *
 * 対応パターン:
 *   令和8年第1回臨時会本会議（令和8年2月12日）
 *   令和7年第4回定例会本会議（令和7年12月9日から12月12日）
 *   令和7年第1回定例会本会議（令和7年2月28日から3月10日まで）
 */
export function parseDateFromLinkText(text: string): string | null {
  const match = text.match(/令和(元|\d+)年(\d+)月(\d+)日/);
  if (!match) return null;

  const reiwaYear = match[1] === "元" ? 1 : parseInt(match[1]!, 10);
  const month = parseInt(match[2]!, 10);
  const day = parseInt(match[3]!, 10);
  const westernYear = reiwaYear + 2018;

  return `${westernYear}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

/**
 * 一覧ページ HTML から PDF リンクを抽出する（テスト可能な純粋関数）。
 *
 * @param html - 一覧ページの HTML
 * @param year - 対象西暦年（指定年の会議録のみ返す）
 */
export function parseListPage(
  html: string,
  year: number,
): AjigasawaMeeting[] {
  const results: AjigasawaMeeting[] = [];
  const reiwaYear = toReiwaYear(year);

  // h2 見出しの位置を収集して年度セクションの範囲を特定する
  const h2Pattern = /<h2>([^<]*)<\/h2>/g;
  const sections: { index: number; reiwaYear: number | null }[] = [];

  for (const match of html.matchAll(h2Pattern)) {
    const headingText = match[1]!;
    const yearMatch = headingText.match(/令和(元|\d+)年/);
    sections.push({
      index: match.index!,
      reiwaYear: yearMatch
        ? yearMatch[1] === "元"
          ? 1
          : parseInt(yearMatch[1]!, 10)
        : null,
    });
  }

  // PDF リンクを抽出
  const linkPattern =
    /<a[^>]+href="([^"]*\.pdf)"[^>]*>([\s\S]*?)<\/a>/gi;

  for (const match of html.matchAll(linkPattern)) {
    const linkIndex = match.index!;
    const href = match[1]!;
    const linkText = match[2]!.replace(/<[^>]+>/g, "").trim();

    // このリンクが属する h2 セクションの年度を特定する
    let sectionReiwaYear: number | null = null;
    for (const section of sections) {
      if (section.index < linkIndex) {
        sectionReiwaYear = section.reiwaYear;
      }
    }

    // 対象年度でなければスキップ
    if (sectionReiwaYear !== reiwaYear) continue;

    // 開催日を抽出
    const heldOn = parseDateFromLinkText(linkText);
    if (!heldOn) continue;

    // PDF の絶対 URL を構築
    const pdfUrl = href.startsWith("http")
      ? href
      : `https://www.town.ajigasawa.lg.jp/about_town/gikai/${href}`;

    // ファイルキーを抽出
    const fileKeyMatch = href.match(/([^/]+)\.pdf$/i);
    const fileKey = fileKeyMatch ? fileKeyMatch[1]! : href;

    // タイトルを構築: PDF サイズ情報を除去
    const title = linkText
      .replace(/（PDF[：:][^）]*）/, "")
      .trim();

    results.push({ pdfUrl, title, heldOn, fileKey });
  }

  return results;
}

/**
 * 指定年の全 PDF リンクを取得する。
 */
export async function fetchMeetingList(
  year: number,
): Promise<AjigasawaMeeting[]> {
  const html = await fetchPage(LIST_URL);
  if (!html) return [];

  return parseListPage(html, year);
}
