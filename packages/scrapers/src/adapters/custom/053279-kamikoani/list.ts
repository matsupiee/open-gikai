/**
 * 上小阿仁村議会 — list フェーズ
 *
 * 4 つの一覧ページ（/info/663, /info/302, /info/288, /info/301）から
 * PDF リンクを収集する。
 *
 * HTML 構造:
 *   <th class="editor_th">
 *     <div>令和７年第８回定例会</div>
 *     <div>（令和７年１２月９日～１１日）</div>
 *   </th>
 *   <td class="editor_td">
 *     <div><a href="...R7-8-1.pdf">①開会～行政報告</a></div>
 *     ...
 *   </td>
 */

import { BASE_ORIGIN, LIST_PAGE_URLS, fetchPage, getEraYears, parseHeldOn } from "./shared";

export interface KamikoaniPdf {
  /** PDF の完全 URL */
  pdfUrl: string;
  /** 会議タイトル（例: "令和７年第８回定例会"） */
  meetingTitle: string;
  /** PDF 内の区分（例: "①開会～行政報告"） */
  partTitle: string;
  /** 開催日 YYYY-MM-DD（一覧ページの日付から取得） */
  heldOn: string;
}

/**
 * 一覧ページの HTML から会議ごとの PDF リンクを抽出する。
 *
 * テーブルの <th class="editor_th"> に会議名と日付、
 * <td class="editor_td"> に PDF リンクが格納されている。
 */
export function parseListPage(html: string): KamikoaniPdf[] {
  const results: KamikoaniPdf[] = [];

  // th + td のペアを抽出する
  // th には会議名と日付、td には PDF リンクが含まれる
  const rowRegex =
    /<th[^>]*class="editor_th"[^>]*>([\s\S]*?)<\/th>\s*<td[^>]*class="editor_td"[^>]*>([\s\S]*?)<\/td>/gi;

  for (const rowMatch of html.matchAll(rowRegex)) {
    const thContent = rowMatch[1] ?? "";
    const tdContent = rowMatch[2] ?? "";

    // thContent から会議名を抽出（<div>会議名</div>）
    const titleMatch = thContent.match(
      /<div[^>]*>(令和|平成)[^<]*(?:定例会|臨時会)[^<]*<\/div>/i
    );
    if (!titleMatch) continue;
    const meetingTitle = titleMatch[0]
      .replace(/<[^>]+>/g, "")
      .replace(/\s+/g, " ")
      .trim();

    // thContent から開催日を抽出（<div>（令和7年12月9日...）</div>）
    const dateMatch = thContent.match(/<div[^>]*>[（(]([^）)]+)[）)]<\/div>/);
    const dateText = dateMatch?.[1] ?? "";
    const heldOn = parseHeldOn(dateText);
    if (!heldOn) continue;

    // tdContent から PDF リンクを抽出
    const linkRegex = /<a[^>]+href="([^"]+\.pdf)"[^>]*>([^<]+)<\/a>/gi;
    for (const linkMatch of tdContent.matchAll(linkRegex)) {
      const href = linkMatch[1] ?? "";
      const partTitle = linkMatch[2]?.trim() ?? "";
      if (!href || !partTitle) continue;

      // 絶対 URL に変換
      let pdfUrl: string;
      if (href.startsWith("http")) {
        pdfUrl = href;
      } else if (href.startsWith("/")) {
        pdfUrl = `${BASE_ORIGIN}${href}`;
      } else {
        pdfUrl = `${BASE_ORIGIN}/${href}`;
      }

      results.push({ pdfUrl, meetingTitle, partTitle, heldOn });
    }
  }

  return results;
}

/**
 * 指定年の全 PDF リンクを 4 つの一覧ページから収集する。
 */
export async function fetchPdfList(year: number): Promise<KamikoaniPdf[]> {
  const eraYears = getEraYears(year);
  const allPdfs: KamikoaniPdf[] = [];

  for (const pageUrl of LIST_PAGE_URLS) {
    const html = await fetchPage(pageUrl);
    if (!html) continue;

    const pdfs = parseListPage(html);

    // 対象年度の会議のみを抽出
    // タイトルに全角数字が含まれるため、比較前に半角に正規化する
    for (const pdf of pdfs) {
      const normalizedTitle = pdf.meetingTitle.replace(/[０-９]/g, (c) =>
        String.fromCharCode(c.charCodeAt(0) - 0xfee0)
      );
      const matchesYear = eraYears.some((ey) => normalizedTitle.includes(ey));
      if (matchesYear) {
        allPdfs.push(pdf);
      }
    }
  }

  return allPdfs;
}
