/**
 * 大鰐町議会 — list フェーズ
 *
 * 年度別ページ（R{N}teireikairinjikai.html）の HTML から
 * <h2> タグで区切られた会議セクションを解析し、
 * リンクテキストに「会議録」を含む PDF の URL を収集する。
 *
 * 構造:
 *   h2: "令和{N}年第{回}回定例会（令和{N}年{月}月）"
 *   ol > li > a[href="files/{filename}.pdf"]: "会議録（一般質問）.pdf"
 */

import { BASE_URL, buildYearPageUrl, fetchPage, parseDateFromH2 } from "./shared";

export interface OwaniMeeting {
  /** 会議タイトル（h2 テキスト） */
  title: string;
  /** 開催日 YYYY-MM-DD */
  heldOn: string;
  /** 会議録 PDF の絶対 URL */
  pdfUrl: string;
  /** ファイル名（拡張子なし）— externalId の一部に使用 */
  fileKey: string;
  /** 年度別ページの URL（sourceUrl として使用） */
  yearPageUrl: string;
}

/**
 * 年度別ページの HTML から会議録 PDF リンクを抽出する（純粋関数）。
 *
 * 1. <h2> タグを起点に会議セクションを分割
 * 2. 各セクションの <ol> 内の <a> タグから「会議録」を含むリンクを抽出
 */
export function parseYearPage(
  html: string,
  yearPageUrl: string,
): OwaniMeeting[] {
  const results: OwaniMeeting[] = [];

  // h2 の位置とテキストを収集
  const h2Pattern = /<h2[^>]*>([\s\S]*?)<\/h2>/gi;
  const h2Entries: { index: number; text: string }[] = [];
  for (const match of html.matchAll(h2Pattern)) {
    const text = match[1]!.replace(/<[^>]+>/g, "").trim();
    h2Entries.push({ index: match.index!, text });
  }

  if (h2Entries.length === 0) return [];

  // 各 h2 セクション（h2 から次の h2 まで）を処理
  for (let i = 0; i < h2Entries.length; i++) {
    const h2 = h2Entries[i]!;
    const sectionEnd =
      i + 1 < h2Entries.length ? h2Entries[i + 1]!.index : html.length;
    const sectionHtml = html.slice(h2.index, sectionEnd);

    const heldOn = parseDateFromH2(h2.text);
    if (!heldOn) continue;

    // <ol> 内の <a> タグから「会議録」を含むリンクを抽出
    const linkPattern =
      /<a[^>]+href="([^"]*\.pdf)"[^>]*>([\s\S]*?)<\/a>/gi;

    for (const linkMatch of sectionHtml.matchAll(linkPattern)) {
      const href = linkMatch[1]!;
      const linkText = linkMatch[2]!.replace(/<[^>]+>/g, "").trim();

      // 「会議録」を含むリンクのみを対象にする
      if (!linkText.includes("会議録")) continue;

      // 絶対 URL を構築
      let pdfUrl: string;
      if (href.startsWith("http")) {
        pdfUrl = href;
      } else if (href.startsWith("/")) {
        pdfUrl = `http://www.town.owani.lg.jp${href}`;
      } else {
        pdfUrl = `${BASE_URL}${href}`;
      }

      // ファイルキーを抽出（拡張子なし）
      const fileKeyMatch = href.match(/([^/]+)\.pdf$/i);
      const fileKey = fileKeyMatch ? fileKeyMatch[1]! : href;

      results.push({
        title: h2.text,
        heldOn,
        pdfUrl,
        fileKey,
        yearPageUrl,
      });
    }
  }

  return results;
}

/**
 * 指定年度の全会議録 PDF リンクを取得する。
 */
export async function fetchMeetingList(
  year: number,
): Promise<OwaniMeeting[]> {
  const url = buildYearPageUrl(year);
  const html = await fetchPage(url);
  if (!html) {
    console.warn(`[023621-owani] 年度別ページ取得失敗: ${url}`);
    return [];
  }

  return parseYearPage(html, url);
}
