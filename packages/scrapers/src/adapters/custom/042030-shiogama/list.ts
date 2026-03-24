/**
 * 塩竈市議会（宮城県）会議録 — list フェーズ
 *
 * 4つの一覧ページから PDF リンクとメタ情報を収集する。
 *
 * 対象ページ:
 *   1. /soshiki/2/2578.html — 定例会・予算特別委員会・決算特別委員会
 *   2. /soshiki/2/6884.html — 各常任委員会
 *   3. /soshiki/2/47219.html — 全員協議会
 *   4. /soshiki/2/30644.html — 長期総合計画特別委員会
 *
 * HTML 構造:
 *   <h2>令和7年</h2>
 *   <h3>定例会</h3>
 *   <ul>
 *     <li><a href="/uploaded/attachment/27759.pdf">令和7年第4回定例会</a></li>
 *   </ul>
 */

import {
  BASE_ORIGIN,
  LIST_PAGE_URLS,
  fetchPage,
  parseDateFromText,
  eraToWesternYear,
  parseYearOnlyFromText,
} from "./shared";

/** 1会議録エントリ */
export interface ShiogamaMeeting {
  /** PDF の完全 URL */
  pdfUrl: string;
  /** リンクテキスト（例: "令和7年第4回定例会"） */
  title: string;
  /** 年見出し（h2）テキスト（例: "令和7年"） */
  yearHeading: string;
  /** 会議種別見出し（h3）テキスト（例: "定例会"） */
  typeHeading: string;
  /**
   * 開催日 YYYY-MM-DD。
   * 日付情報がある場合のみ設定。委員会は日付付きリンクが多い。
   * 定例会など日付なしの場合は null。
   */
  heldOn: string | null;
  /** 西暦年（ヒューリスティックから推定） */
  year: number;
}

/**
 * HTML エンティティをデコードする。
 */
function decodeEntities(text: string): string {
  return text
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(Number(code)));
}

/**
 * HTML タグを除去してプレーンテキストを返す。
 */
function stripTags(html: string): string {
  return html.replace(/<[^>]+>/g, "").trim();
}

/**
 * 一覧ページの HTML から PDF リンクを抽出する。
 *
 * h2 → 年見出し、h3 → 会議種別見出しを追跡しながら
 * PDF リンク（href が .pdf で終わる <a> タグ）を収集する。
 */
export function parsePdfLinks(html: string): ShiogamaMeeting[] {
  const results: ShiogamaMeeting[] = [];

  // h2, h3, a[href$=".pdf"] を順番に抽出するため、タグの出現位置を取得する
  const tagPattern =
    /<(h2|h3)[^>]*>([\s\S]*?)<\/\1>|<a[^>]+href="([^"]*\.pdf)"[^>]*>([\s\S]*?)<\/a>/gi;

  let currentYearHeading = "";
  let currentTypeHeading = "";
  let currentYear: number | null = null;

  for (const match of html.matchAll(tagPattern)) {
    const tagName = match[1]?.toLowerCase();
    const tagContent = match[2];
    const pdfHref = match[3];
    const linkText = match[4];

    if (tagName === "h2" && tagContent !== undefined) {
      const text = decodeEntities(stripTags(tagContent));
      // 年号見出しかどうかチェック
      const year = eraToWesternYear(text);
      if (year !== null) {
        currentYearHeading = text;
        currentYear = year;
        currentTypeHeading = ""; // h2 が変わったら h3 をリセット
      }
    } else if (tagName === "h3" && tagContent !== undefined) {
      currentTypeHeading = decodeEntities(stripTags(tagContent));
    } else if (pdfHref !== undefined && linkText !== undefined) {
      if (!currentYear) continue;

      const rawText = decodeEntities(stripTags(linkText));
      if (!rawText) continue;

      const pdfUrl = pdfHref.startsWith("http")
        ? pdfHref
        : `${BASE_ORIGIN}${pdfHref}`;

      // 日付情報を抽出（委員会リンクには日付あり、定例会リンクには日付なし）
      const heldOn = parseDateFromText(rawText);

      // 年が解析できなかった場合は現在の h2 から推定
      const year = heldOn
        ? parseInt(heldOn.slice(0, 4), 10)
        : (parseYearOnlyFromText(rawText) ?? currentYear);

      results.push({
        pdfUrl,
        title: rawText,
        yearHeading: currentYearHeading,
        typeHeading: currentTypeHeading,
        heldOn,
        year,
      });
    }
  }

  return results;
}

/**
 * 指定年の全会議録エントリを取得する。
 * 4つの一覧ページを巡回して PDF リンクを収集する。
 */
export async function fetchMeetingList(
  year: number,
): Promise<ShiogamaMeeting[]> {
  const allMeetings: ShiogamaMeeting[] = [];

  for (const url of LIST_PAGE_URLS) {
    const html = await fetchPage(url);
    if (!html) continue;

    const meetings = parsePdfLinks(html);
    const filtered = meetings.filter((m) => m.year === year);
    allMeetings.push(...filtered);
  }

  return allMeetings;
}

/**
 * リンクテキストから対象年を推定する。
 * list フェーズのフィルタリング用。
 */
export function inferYearFromLinkText(text: string): number | null {
  return eraToWesternYear(text);
}
