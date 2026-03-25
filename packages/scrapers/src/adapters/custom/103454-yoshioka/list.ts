/**
 * 吉岡町議会 会議録 — list フェーズ
 *
 * 取得フロー:
 * 1. トップページ /gikai/kaigiroku/ を取得（最新年データ + 過去年リンク）
 * 2. 指定年のページ（bn_{year}.html）を取得
 * 3. <h3> 見出しから会議名を抽出
 * 4. <li> 内の日付テキストと PDF リンクを抽出
 *
 * HTML 構造:
 *   <h3>令和6年第4回定例会</h3>
 *   <ul>
 *     <li>2024年12月02日(月曜日)〜12月12日(木曜日)
 *       <a href="/gikai/kaigi/pdf/xxx.pdf">会議録(PDF:2.0 MB)</a>
 *     </li>
 *   </ul>
 */

import {
  TOP_LIST_URL,
  buildYearPageUrl,
  fetchPage,
  toAbsoluteUrl,
  extractYearFromTitle,
  parseDateFromText,
} from "./shared";

export interface YoshiokaMeeting {
  /** 会議タイトル (e.g., "令和6年第4回定例会") */
  title: string;
  /** PDF の絶対 URL */
  pdfUrl: string;
  /** 開催日 YYYY-MM-DD（解析できない場合は null） */
  heldOn: string | null;
  /** ソース URL（ページの URL） */
  sourceUrl: string;
}

/**
 * 年別ページ HTML から会議録エントリを抽出する。
 * cheerio を使わず正規表現でパースする。
 */
export function parseYearPage(html: string, pageUrl: string): YoshiokaMeeting[] {
  const meetings: YoshiokaMeeting[] = [];

  // <h3>〜</h3> でセクションを分割する
  // h3 以降に続く ul/li ブロックを関連付けて処理する
  const h3Regex = /<h3[^>]*>([\s\S]*?)<\/h3>/gi;
  const h3Matches = Array.from(html.matchAll(h3Regex));

  for (let i = 0; i < h3Matches.length; i++) {
    const h3Match = h3Matches[i]!;
    const title = h3Match[1]!
      .replace(/<[^>]+>/g, "")
      .replace(/\s+/g, " ")
      .trim();
    if (!title) continue;

    // この h3 の終端から次の h3 の開始（またはHTML終端）までの範囲を取得
    const h3End = h3Match.index! + h3Match[0].length;
    const nextH3Start = h3Matches[i + 1]?.index ?? html.length;
    const sectionHtml = html.slice(h3End, nextH3Start);

    // セクション内の PDF リンクを探す（<li> または <a> タグ）
    const pdfHrefMatch = sectionHtml.match(/href="([^"]+\.pdf)"/i);
    if (!pdfHrefMatch) continue;

    const href = pdfHrefMatch[1]!;
    const pdfUrl = toAbsoluteUrl(href);

    // セクション内から日付を抽出（<p> タグや <li> テキストを含む全テキスト）
    const sectionText = sectionHtml.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
    const heldOn = parseDateFromText(sectionText);

    meetings.push({
      title,
      pdfUrl,
      heldOn,
      sourceUrl: pageUrl,
    });
  }

  return meetings;
}

/**
 * トップページから過去年リンク（bn_{year}.html）を抽出する。
 * 返り値: 年 → URL のマップ
 */
export function parseYearLinks(html: string): Map<number, string> {
  const yearLinks = new Map<number, string>();

  // bn_{year}.html パターンのリンクを探す
  const linkRegex = /href="([^"]*bn_(\d{4})\.html)"/gi;
  for (const match of html.matchAll(linkRegex)) {
    const href = match[1]!;
    const year = parseInt(match[2]!, 10);
    if (year >= 2000 && year <= 2100) {
      const url = toAbsoluteUrl(href);
      yearLinks.set(year, url);
    }
  }

  return yearLinks;
}

/**
 * 指定年の全会議録一覧を取得する。
 */
export async function fetchMeetingList(year: number): Promise<YoshiokaMeeting[]> {
  // トップページを取得して最新年と過去年リンクを確認
  const topHtml = await fetchPage(TOP_LIST_URL);
  if (!topHtml) return [];

  // 過去年リンクを収集して最新年を特定
  const yearLinks = parseYearLinks(topHtml);
  const linkedYears = Array.from(yearLinks.keys());
  // 最新年はリンクがないので、リンクされている年の最大 + 1 とする
  const latestYear = linkedYears.length > 0 ? Math.max(...linkedYears) + 1 : new Date().getFullYear();

  // 対象年のページ URL を決定
  let pageUrl: string;
  let pageHtml: string | null;

  if (year === latestYear) {
    pageUrl = TOP_LIST_URL;
    pageHtml = topHtml;
  } else {
    pageUrl = yearLinks.get(year) ?? buildYearPageUrl(year, latestYear);
    pageHtml = await fetchPage(pageUrl);
  }

  if (!pageHtml) return [];

  // 年別ページから会議録を抽出
  const meetings = parseYearPage(pageHtml, pageUrl);

  // 指定年のものだけを返す（ページに別年のデータが混在する場合に備えてフィルタリング）
  return meetings.filter((m) => {
    const titleYear = extractYearFromTitle(m.title);
    return titleYear === year || titleYear === null; // year が特定できない場合は含める
  });
}
