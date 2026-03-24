/**
 * 真狩村議会 会議録 — list フェーズ
 *
 * 単一の一覧ページ https://www.vill.makkari.lg.jp/songikai/kaigiroku/ から
 * PDF リンクとメタ情報を収集する。
 *
 * HTML 構造:
 *   <h2 class="mk-title large">2025年（令和7年）会議録</h2>
 *   <ul>
 *     <li>
 *       <a href="/resources/output/contents/file/release/1506/{ID}/{ファイル名}.pdf"
 *          title="令和7年第1回臨時会(1月28日）">
 *         令和7年第1回臨時会(1月28日）
 *       </a>
 *     </li>
 *   </ul>
 *
 * リンクテキストパターン:
 *   "令和7年第1回臨時会(1月28日）"
 *   "令和7年第1回定例会　1日目(3月10日）"
 */

import { BASE_ORIGIN, LIST_PAGE_URL, eraToWesternYear, fetchPage } from "./shared";

export interface MakkariMeeting {
  /** PDF の完全 URL */
  pdfUrl: string;
  /** 会議タイトル */
  title: string;
  /** 開催日 YYYY-MM-DD または null（解析不能の場合） */
  heldOn: string | null;
}

/**
 * リンクテキストから開催日と会議タイトルを解析する。
 *
 * パターン例:
 *   "令和7年第1回臨時会(1月28日）"
 *     → heldOn=2025-01-28, title="令和7年第1回臨時会"
 *   "令和7年第1回定例会　1日目(3月10日）"
 *     → heldOn=2025-03-10, title="令和7年第1回定例会　1日目"
 *   "令和6年第3回定例会　3日目（9月11日）"
 *     → heldOn=2024-09-11, title="令和6年第3回定例会　3日目"
 */
export function parseLinkText(rawText: string): {
  title: string;
  heldOn: string | null;
} {
  const text = rawText.trim();

  // 日付部分を括弧内から抽出: "(月日)" or "（月日）"
  const dateMatch = text.match(/[（(](\d{1,2})月(\d{1,2})日[)）]/);
  if (!dateMatch) {
    return { title: text, heldOn: null };
  }

  const month = parseInt(dateMatch[1]!, 10);
  const day = parseInt(dateMatch[2]!, 10);

  // 和暦年から西暦年を取得
  const eraMatch = text.match(/(令和|平成)(元|\d+)年/);
  if (!eraMatch) {
    return { title: text, heldOn: null };
  }

  const year = eraToWesternYear(`${eraMatch[1]}${eraMatch[2]}年`);
  if (!year) {
    return { title: text, heldOn: null };
  }

  const heldOn = `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;

  // タイトルは括弧 + 日付の手前まで
  const titleEnd = text.search(/[（(]\d{1,2}月\d{1,2}日[)）]/);
  const title = text.slice(0, titleEnd).trim();

  return { title, heldOn };
}

/**
 * 一覧ページ HTML から PDF リンクを抽出する。
 */
export function parseListPage(html: string): MakkariMeeting[] {
  const results: MakkariMeeting[] = [];

  // PDF リンクを抽出: href が .pdf で終わるリンク
  const linkPattern =
    /<a[^>]+href="([^"]*\.pdf)"[^>]*>([\s\S]*?)<\/a>/gi;

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
      .trim();

    if (!rawText) continue;

    const { title, heldOn } = parseLinkText(rawText);

    // PDF の完全 URL を組み立て
    let pdfUrl: string;
    if (href.startsWith("http")) {
      pdfUrl = href;
    } else {
      pdfUrl = `${BASE_ORIGIN}${href}`;
    }

    results.push({ pdfUrl, title, heldOn });
  }

  return results;
}

/**
 * 指定年の全 PDF リンクを取得する。
 */
export async function fetchMeetingList(year: number): Promise<MakkariMeeting[]> {
  const html = await fetchPage(LIST_PAGE_URL);
  if (!html) return [];

  const allMeetings = parseListPage(html);

  // 対象年でフィルタ（heldOn が null のものは除外）
  return allMeetings.filter((m) => {
    if (!m.heldOn) return false;
    const meetingYear = parseInt(m.heldOn.slice(0, 4), 10);
    return meetingYear === year;
  });
}
