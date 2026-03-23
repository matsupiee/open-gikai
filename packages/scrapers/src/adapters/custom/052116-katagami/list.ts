/**
 * 潟上市議会 会議録 — list フェーズ
 *
 * 5つの年代別ページを巡回し、PDF リンクとメタ情報を収集する。
 *
 * ページ構造（table/th/td ベース）:
 *   <table>
 *     <caption>令和6年会議録</caption>
 *     <tbody>
 *       <tr>
 *         <th>4 第3回定例会</th>
 *         <td>
 *           <p>・<a href="//www.city.katagami.lg.jp/material/files/group/13/xxx.pdf">
 *             1日目（令和6年9月4日）(PDFファイル:399.5KB)
 *           </a></p>
 *         </td>
 *       </tr>
 *     </tbody>
 *   </table>
 */

import {
  BASE_ORIGIN,
  YEAR_PAGE_IDS,
  fetchPage,
  parseDateFromLinkText,
  detectMeetingType,
} from "./shared";

export interface KatagamiMeeting {
  /** PDF の完全 URL */
  pdfUrl: string;
  /** 会議タイトル（例: "第3回定例会 1日目"） */
  title: string;
  /** 開催日 YYYY-MM-DD */
  heldOn: string;
}

/**
 * 年代別ページの HTML から PDF リンクとメタ情報を抽出する。
 *
 * <table> 内の <th> から会議種別、<td> 内の <a> から PDF URL と日付を取得する。
 * プロトコル相対 URL（//www.city.katagami.lg.jp/...）に https: を付与する。
 */
export function parseYearPage(html: string): KatagamiMeeting[] {
  const results: KatagamiMeeting[] = [];

  // table ブロックを抽出
  const tableRegex = /<table[\s\S]*?<\/table>/gi;

  for (const tableMatch of html.matchAll(tableRegex)) {
    const tableHtml = tableMatch[0]!;

    // caption から年度を取得（使用はしないが存在確認用）
    const captionMatch = tableHtml.match(/<caption[^>]*>([\s\S]*?)<\/caption>/i);
    if (!captionMatch) continue;

    // tr ブロックを抽出
    const trRegex = /<tr[^>]*>([\s\S]*?)<\/tr>/gi;

    for (const trMatch of tableHtml.matchAll(trRegex)) {
      const trHtml = trMatch[1]!;

      // th から会議種別見出しを取得
      const thMatch = trHtml.match(/<th[^>]*>([\s\S]*?)<\/th>/i);
      if (!thMatch) continue;

      const thText = thMatch[1]!
        .replace(/<[^>]+>/g, "")
        .replace(/&nbsp;/g, " ")
        .replace(/[\s　]+/g, " ")
        .trim();

      // 会議種別を抽出（例: "4 第3回定例会" → "第3回定例会"）
      const sessionMatch = thText.match(/(?:第\d+回)?(?:定例会|臨時会|(?:予算|予算決算)?特別委員会|委員会)/);
      const sessionTitle = sessionMatch ? sessionMatch[0] : thText;

      // td から PDF リンクを抽出
      const tdMatch = trHtml.match(/<td[^>]*>([\s\S]*?)<\/td>/i);
      if (!tdMatch) continue;

      const tdHtml = tdMatch[1]!;

      // <a> タグから href とリンクテキストを抽出
      const linkRegex = /<a[^>]+href="([^"]+\.pdf)"[^>]*>([\s\S]*?)<\/a>/gi;

      for (const linkMatch of tdHtml.matchAll(linkRegex)) {
        const href = linkMatch[1]!;
        const rawText = linkMatch[2]!
          .replace(/<[^>]+>/g, "")
          .replace(/&nbsp;/g, " ")
          .replace(/&amp;/g, "&")
          .replace(/&lt;/g, "<")
          .replace(/&gt;/g, ">")
          .replace(/&quot;/g, '"')
          .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(Number(code)))
          .trim();

        if (!rawText) continue;

        // 開催日を解析
        const heldOn = parseDateFromLinkText(rawText);
        if (!heldOn) continue;

        // PDF の完全 URL を組み立て（プロトコル相対 URL に https: を付与）
        const pdfUrl = href.startsWith("//")
          ? `https:${href}`
          : href.startsWith("http")
            ? href
            : `${BASE_ORIGIN}${href}`;

        // リンクテキストから日次情報を抽出（例: "1日目", "予算決算特別委員会1日目"）
        // ファイルサイズ情報を除去
        const cleanText = rawText.replace(/\(PDFファイル:[^)]+\)/g, "").trim();
        // （日付）部分を除去
        const labelText = cleanText.replace(/[（(][^）)]*[）)]/g, "").trim();

        const title = labelText
          ? `${sessionTitle} ${labelText}`.trim()
          : sessionTitle;

        // 会議種別を title 全体から判定（委員会リンクも含む）
        const meetingKind = detectMeetingType(title);
        void meetingKind; // 後でindex.tsで使用

        results.push({
          pdfUrl,
          title,
          heldOn,
        });
      }
    }
  }

  return results;
}

/**
 * 指定年の全 PDF リンクを取得する。
 * 5つの年代別ページを巡回し、対象年の会議録のみを返す。
 */
export async function fetchMeetingList(
  year: number,
): Promise<KatagamiMeeting[]> {
  const allMeetings: KatagamiMeeting[] = [];

  for (const pageId of YEAR_PAGE_IDS) {
    const url = `${BASE_ORIGIN}/gyosei/gyoseijoho/shigikai/kaigiroku/${pageId}.html`;
    const html = await fetchPage(url);
    if (!html) continue;

    const meetings = parseYearPage(html);
    allMeetings.push(...meetings);
  }

  // 対象年でフィルタ
  return allMeetings.filter((m) => {
    const meetingYear = parseInt(m.heldOn.slice(0, 4), 10);
    return meetingYear === year;
  });
}
