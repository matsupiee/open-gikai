/**
 * 岐阜県山県市議会 会議録 — list フェーズ
 *
 * 年度別ページから PDF リンクとメタ情報を収集する。
 *
 * 年度別ページ構造:
 *   <a href="/uploaded/attachment/{ファイルID}.pdf">第N回定例会会議録</a>
 *   など
 *
 * PDF 1ファイルに複数会議日（第N号）が含まれる。
 * list フェーズでは PDF 単位でリンクを収集し、
 * detail フェーズでテキスト解析後に個別会議日に分割する。
 */

import { BASE_ORIGIN, YEAR_PAGE_MAP, fetchPage } from "./shared";

export interface YamagataGifuMeeting {
  /** PDF の完全 URL */
  pdfUrl: string;
  /** 会議タイトル（例: "第1回定例会"） */
  title: string;
  /** 年度（西暦） */
  fiscalYear: number;
}

/**
 * 年度別ページの HTML から PDF リンクを抽出する。
 *
 * 対象リンク: href が /uploaded/attachment/{ID}.pdf の形式
 *
 * @param html 年度別ページの HTML
 * @param fiscalYear 年度（西暦）
 */
export function parseYearPage(html: string, fiscalYear: number): YamagataGifuMeeting[] {
  const results: YamagataGifuMeeting[] = [];

  // href が /uploaded/attachment/*.pdf の形式のリンクを抽出
  const linkPattern =
    /<a[^>]+href="(\/uploaded\/attachment\/[^"]+\.pdf)"[^>]*>([\s\S]*?)<\/a>/gi;

  for (const match of html.matchAll(linkPattern)) {
    const href = match[1]!;
    const rawText = match[2]!
      .replace(/<[^>]+>/g, "")
      .replace(/&nbsp;/g, " ")
      .replace(/&amp;/g, "&")
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">")
      .replace(/&quot;/g, '"')
      .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(Number(code)))
      .replace(/[\s　]+/g, " ")
      .trim();

    if (!rawText) continue;

    // 会議タイトルを抽出: "第N回定例会" / "第N回臨時会"
    const titleMatch = rawText.match(/第\d+回(?:定例会|臨時会)/);
    const title = titleMatch ? titleMatch[0] : rawText;

    const pdfUrl = `${BASE_ORIGIN}${href}`;

    results.push({
      pdfUrl,
      title,
      fiscalYear,
    });
  }

  return results;
}

/**
 * 指定年の全 PDF リンクを取得する。
 * 年度別ページ URL マップから対象年のページを特定して巡回する。
 *
 * 注意: 年度ページは「年度（4月始まり）」ベースだが、
 * 指定 year は「開催年（西暦）」。
 * 例えば 2024年（令和6年）の会議録には、
 * 令和6年の年度ページに含まれる会議と、
 * 令和5年度ページにある令和6年1〜3月開催の会議が含まれる可能性がある。
 * ここでは対象年のページ + 前年度ページを両方確認する。
 */
export async function fetchMeetingList(year: number): Promise<YamagataGifuMeeting[]> {
  const allMeetings: YamagataGifuMeeting[] = [];

  // 対象年と前年度のページを両方確認（1〜3月分が前年度ページにある場合）
  const targetYears = [year, year - 1];

  for (const targetYear of targetYears) {
    const pageUrl = YEAR_PAGE_MAP[targetYear];
    if (!pageUrl) continue;

    const html = await fetchPage(pageUrl);
    if (!html) continue;

    const meetings = parseYearPage(html, targetYear);
    allMeetings.push(...meetings);
  }

  // 重複 URL を除去
  const seen = new Set<string>();
  return allMeetings.filter((m) => {
    if (seen.has(m.pdfUrl)) return false;
    seen.add(m.pdfUrl);
    return true;
  });
}
