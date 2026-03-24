/**
 * 枕崎市議会 会議録 — list フェーズ
 *
 * 年度別ページから PDF リンクとメタ情報を収集する。
 *
 * 年度別ページ構造:
 *   <a href="/uploaded/attachment/{id}.pdf">第N回定例会（N月N日〜N月N日）</a>
 *
 * attachmentId は連番のため、必ず年度別ページから収集する。
 */

import {
  BASE_ORIGIN,
  buildYearPageUrl,
  fetchPage,
  parseJapaneseDate,
  detectMeetingType,
  YEAR_PAGE_IDS,
} from "./shared";

export interface MakurazakiMeeting {
  /** PDF の完全 URL */
  pdfUrl: string;
  /** 会議タイトル（例: "第2回定例会"） */
  title: string;
  /** 開催日 YYYY-MM-DD。解析できない場合は null */
  heldOn: string | null;
  /** 会議タイプ */
  meetingType: string;
}

/**
 * 年度別ページの HTML から PDF リンクとメタ情報を抽出する。
 *
 * href が /uploaded/attachment/*.pdf 形式のリンクを収集する。
 * リンクテキストから会議名・開催日を取得する。
 */
export function parseYearPage(html: string): MakurazakiMeeting[] {
  const results: MakurazakiMeeting[] = [];

  // /uploaded/attachment/{id}.pdf へのリンクを抽出
  const linkPattern =
    /<a[^>]+href="(\/uploaded\/attachment\/\d+\.pdf)"[^>]*>([\s\S]*?)<\/a>/gi;

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
      .replace(/\s+/g, " ")
      .trim();

    if (!rawText) continue;

    const pdfUrl = `${BASE_ORIGIN}${href}`;

    // 会議タイトルを抽出: "第N回定例会" / "第N回臨時会" / "予算特別委員会" / "決算特別委員会"
    const titleMatch = rawText.match(
      /(?:第\d+回(?:定例会|臨時会)|予算特別委員会|決算特別委員会|全員協議会)/,
    );
    const title = titleMatch ? titleMatch[0] : rawText.split(/[（(]/)[0]?.trim() ?? rawText;

    // 開催日を抽出: "令和6年2月8日" / "令和6年3月1日〜3月27日"（開始日を使用）
    const heldOn = parseJapaneseDate(rawText);

    results.push({
      pdfUrl,
      title,
      heldOn,
      meetingType: detectMeetingType(title),
    });
  }

  return results;
}

/**
 * 指定年の全 PDF リンクを取得する。
 * YEAR_PAGE_IDS から対象年のページ ID を取得し、年度別ページを巡回する。
 */
export async function fetchMeetingList(year: number): Promise<MakurazakiMeeting[]> {
  // 対象年の page ID を探す
  const entry = YEAR_PAGE_IDS.find((e) => e.year === year);
  if (!entry) {
    return [];
  }

  const pageUrl = buildYearPageUrl(entry.pageId);
  const html = await fetchPage(pageUrl);
  if (!html) {
    console.warn(`[462047-makurazaki] Failed to fetch year page: ${pageUrl}`);
    return [];
  }

  return parseYearPage(html);
}
