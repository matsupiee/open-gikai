/**
 * 生坂村議会 -- list フェーズ
 *
 * teireikai.html の 1 ページから全 PDF リンクを収集する。
 *
 * 実際のHTML構造:
 * - 令和3年〜（新形式）:
 *   <h3>令和7年</h3>
 *   <strong>6月定例会</strong>
 *   <ul><li><a href="gijiroku/teireikai07.06.pdf">会議録</a></li></ul>
 *
 * - 令和2年以前（旧形式）:
 *   <h3>令和2年</h3>
 *   <a href="gijiroku/teireikai02.01.pdf">1月臨時会</a>
 *   （フラット構造・リンクテキストに会議名）
 */

import { BASE_ORIGIN, LIST_URL, detectMeetingType, fetchPage, parseWarekiYear } from "./shared";

export interface IkusakaPdfRecord {
  /** 会議タイトル（例: "令和7年6月定例会"） */
  title: string;
  /** PDF の絶対 URL */
  pdfUrl: string;
  /** 会議種別 */
  meetingType: string;
  /** 西暦年 */
  year: number;
}

/**
 * 相対パスの PDF URL を絶対 URL に変換する。
 */
function toAbsoluteUrl(href: string): string {
  if (href.startsWith("http")) return href;
  // href が "gijiroku/..." の形式の場合
  return `${BASE_ORIGIN}/gikai/${href.replace(/^\//, "")}`;
}

/**
 * teireikai.html の HTML から PDF レコード一覧をパースする。
 *
 * h3 タグで年度ブロックを特定し、その後のリンクを収集する。
 *
 * 新形式（令和3年〜）:
 *   h3 の後に <strong>会議名</strong> + <ul><li><a href="gijiroku/...pdf">会議録</a></li></ul>
 *
 * 旧形式（令和2年以前）:
 *   h3 の後に直接 <a href="gijiroku/...pdf">会議名</a> のフラット構造
 */
export function parseListPage(html: string): IkusakaPdfRecord[] {
  const records: IkusakaPdfRecord[] = [];

  // h3 タグで年度ブロックに分割
  const h3Regex = /<h3[^>]*>([\s\S]*?)<\/h3>([\s\S]*?)(?=<h3[^>]*>|$)/gi;

  for (const sectionMatch of html.matchAll(h3Regex)) {
    const yearRaw = sectionMatch[1]!
      .replace(/<[^>]+>/g, "")
      .replace(/\s+/g, "")
      .trim();
    const sectionHtml = sectionMatch[2]!;

    // 年度テキストを正規化（全角数字 → 半角）
    const yearText = yearRaw.replace(/[０-９]/g, (c) =>
      String.fromCharCode(c.charCodeAt(0) - 0xfee0),
    );

    const year = parseWarekiYear(yearText);
    if (!year) continue;

    // gijiroku/ を含む PDF リンクを全て抽出
    const pdfLinkRegex = /<a\s[^>]*href="([^"]*gijiroku\/[^"]*\.pdf)"[^>]*>([\s\S]*?)<\/a>/gi;
    const pdfLinks = [...sectionHtml.matchAll(pdfLinkRegex)];

    if (pdfLinks.length === 0) continue;

    // 新形式の判定: <strong> タグが存在する場合
    const hasStrong = /<strong[^>]*>/.test(sectionHtml);

    if (hasStrong) {
      // 新形式: <strong>会議名</strong> の後に PDF リンクが続く
      // strong タグと PDF リンクをセクション内でペアリングする
      // strong タグで区切ってブロックを作成
      const strongBlockRegex = /<strong[^>]*>([\s\S]*?)<\/strong>([\s\S]*?)(?=<strong[^>]*>|$)/gi;
      for (const blockMatch of sectionHtml.matchAll(strongBlockRegex)) {
        const session = blockMatch[1]!
          .replace(/<[^>]+>/g, "")
          .replace(/\s+/g, "")
          .trim();
        if (!session) continue;

        const blockHtml = blockMatch[2]!;
        const blockPdfRegex = /<a\s[^>]*href="([^"]*gijiroku\/[^"]*\.pdf)"[^>]*>/gi;
        for (const linkMatch of blockHtml.matchAll(blockPdfRegex)) {
          const href = linkMatch[1]!;
          const pdfUrl = toAbsoluteUrl(href);
          const title = `${yearText}${session}`;
          records.push({
            title,
            pdfUrl,
            meetingType: detectMeetingType(session),
            year,
          });
        }
      }
    } else {
      // 旧形式: リンクテキストが会議名
      for (const linkMatch of pdfLinks) {
        const href = linkMatch[1]!;
        const linkText = linkMatch[2]!
          .replace(/<[^>]+>/g, "")
          .replace(/\s+/g, "")
          .trim();
        if (!linkText) continue;

        const pdfUrl = toAbsoluteUrl(href);
        const title = `${yearText}${linkText}`;
        records.push({
          title,
          pdfUrl,
          meetingType: detectMeetingType(linkText),
          year,
        });
      }
    }
  }

  return records;
}

/**
 * teireikai.html を取得して指定年の PDF レコード一覧を返す。
 */
export async function fetchPdfList(year: number): Promise<IkusakaPdfRecord[]> {
  const html = await fetchPage(LIST_URL);
  if (!html) return [];

  const allRecords = parseListPage(html);
  return allRecords.filter((r) => r.year === year);
}
