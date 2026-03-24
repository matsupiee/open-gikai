/**
 * 加美町議会 -- list フェーズ
 *
 * 1. 議事録トップページから全年度ページの URL を収集
 * 2. 指定年に該当する年度ページから PDF リンクを抽出
 *
 * 各 PDF リンクが 1 件の MeetingData に対応するため、
 * list フェーズでは PDF ごとに 1 レコードを返す。
 */

import {
  BASE_ORIGIN,
  INDEX_URL,
  detectMeetingType,
  parseWarekiYear,
  fetchPage,
  delay,
} from "./shared";

export interface KamiPdfRecord {
  /** 会議タイトル（例: "第1回定例会 第1日（令和6年3月5日）"） */
  title: string;
  /** 開催日 YYYY-MM-DD */
  heldOn: string;
  /** PDF の絶対 URL */
  pdfUrl: string;
  /** 会議種別 */
  meetingType: string;
  /** 年度ページの ID */
  yearPageId: string;
}

const INTER_PAGE_DELAY_MS = 1500;

/** 議事録トップページから全年度ページリンクを抽出する */
export function parseYearPageLinks(html: string): Array<{
  pageId: string;
  url: string;
  yearText: string;
}> {
  const links: Array<{ pageId: string; url: string; yearText: string }> = [];
  const seen = new Set<string>();

  // href="https://www.town.kami.miyagi.jp/choseijoho/kamimachigikai/gijiroku/{ID}.html"
  const pattern =
    /<a[^>]*href="(?:https?:)?\/\/www\.town\.kami\.miyagi\.jp(\/choseijoho\/kamimachigikai\/gijiroku\/(\d+)\.html)"[^>]*>([^<]+)<\/a>/gi;

  let m: RegExpExecArray | null;
  while ((m = pattern.exec(html)) !== null) {
    const path = m[1]!;
    const pageId = m[2]!;
    const text = m[3]!.replace(/\s+/g, " ").trim();

    // 議会議事録リンクのみ対象
    if (!text.includes("議事録")) continue;

    if (seen.has(pageId)) continue;
    seen.add(pageId);

    links.push({
      pageId,
      url: `${BASE_ORIGIN}${path}`,
      yearText: text,
    });
  }

  return links;
}

/**
 * 年度ページの HTML から PDF レコードを抽出する。
 *
 * テーブル構造:
 *   <table>
 *     <caption>定例会</caption>  (または <caption><p>臨時会</p></caption>)
 *     <thead><tr><th>会議名</th><th>ファイル</th></tr></thead>
 *     <tbody>
 *       <tr>
 *         <td>第1回定例会 第1日（令和6年3月5日）</td>
 *         <td><a href="//www.town.kami.miyagi.jp/material/files/group/42/r06-01t-01-0305.pdf">会議録(...)</a></td>
 *       </tr>
 *     </tbody>
 *   </table>
 */
export function extractPdfRecords(
  html: string,
  yearPageId: string,
  seirekiYear: number
): KamiPdfRecord[] {
  const records: KamiPdfRecord[] = [];

  // table ごとに処理
  const tablePattern = /<table[^>]*>([\s\S]*?)<\/table>/gi;
  let tableMatch: RegExpExecArray | null;

  while ((tableMatch = tablePattern.exec(html)) !== null) {
    const tableContent = tableMatch[1]!;

    // caption からセクション名を取得
    const captionMatch = tableContent.match(/<caption[^>]*>([\s\S]*?)<\/caption>/i);
    const captionText = captionMatch
      ? captionMatch[1]!.replace(/<[^>]+>/g, "").trim()
      : "";

    // tbody の各 tr を処理
    const tbodyMatch = tableContent.match(/<tbody[^>]*>([\s\S]*?)<\/tbody>/i);
    if (!tbodyMatch) continue;

    const tbody = tbodyMatch[1]!;
    const rowPattern = /<tr[^>]*>([\s\S]*?)<\/tr>/gi;
    let rowMatch: RegExpExecArray | null;

    while ((rowMatch = rowPattern.exec(tbody)) !== null) {
      const row = rowMatch[1]!;

      // td 要素を抽出
      const cells = [...row.matchAll(/<td[^>]*>([\s\S]*?)<\/td>/gi)];
      if (cells.length < 2) continue;

      const titleCell = cells[0]![1]!
        .replace(/<[^>]+>/g, "")
        .replace(/&nbsp;/g, " ")
        .replace(/&amp;/g, "&")
        .trim();
      const fileCell = cells[1]![1]!;

      if (!titleCell) continue;

      // PDF リンクを抽出
      const pdfMatch = fileCell.match(/href="(\/\/[^"]+\.pdf)"/i);
      if (!pdfMatch) continue;

      const pdfHref = pdfMatch[1]!;
      const pdfUrl = `https:${pdfHref}`;

      // 開催日を解析: "第1回定例会 第1日（令和6年3月5日）" から "3月5日" を抽出
      const dateMatch = titleCell.match(/[（(](?:令和|平成)\d+年(\d+)月(\d+)日[）)]/);
      if (!dateMatch) continue;

      const month = parseInt(dateMatch[1]!, 10);
      const day = parseInt(dateMatch[2]!, 10);
      const heldOn = `${seirekiYear}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;

      // 会議種別を判定（captionまたはtitleから）
      const meetingType = detectMeetingType(captionText || titleCell);

      records.push({
        title: titleCell,
        heldOn,
        pdfUrl,
        meetingType,
        yearPageId,
      });
    }
  }

  return records;
}

/**
 * 指定年の全 PDF レコードを収集する。
 */
export async function fetchPdfList(
  _baseUrl: string,
  year: number
): Promise<KamiPdfRecord[]> {
  const allRecords: KamiPdfRecord[] = [];

  // Step 1: トップページから全年度ページリンクを収集
  const indexHtml = await fetchPage(INDEX_URL);
  if (!indexHtml) return [];

  const yearLinks = parseYearPageLinks(indexHtml);

  // Step 2: 指定年に対応するリンクを特定
  const targetLinks = yearLinks.filter((link) => {
    const y = parseWarekiYear(link.yearText);
    return y !== null && y === year;
  });

  // Step 3: 各年度ページから PDF リンクを抽出
  for (const link of targetLinks) {
    await delay(INTER_PAGE_DELAY_MS);

    const html = await fetchPage(link.url);
    if (!html) continue;

    const records = extractPdfRecords(html, link.pageId, year);
    allRecords.push(...records);
  }

  return allRecords;
}
