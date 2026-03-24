/**
 * 鋸南町議会 -- list フェーズ
 *
 * 年度別一覧ページから PDF リンクを収集する。
 * 構造: 年度ページ → PDFリンク（/uploaded/attachment/{ID}.pdf）
 */

import {
  BASE_ORIGIN,
  buildYearPageUrl,
  detectMeetingType,
  fetchPage,
} from "./shared";

export interface KyonanPdfRecord {
  /** 会議タイトル（例: "令和７年第１回定例会会議録"） */
  title: string;
  /** PDF の絶対 URL */
  pdfUrl: string;
  /** 会議種別 */
  meetingType: string;
  /** 年度ページの URL */
  yearPageUrl: string;
}

/**
 * 年度別一覧ページ HTML から PDF リンクを抽出する。
 * href が /uploaded/attachment/*.pdf の形式にマッチするリンクを取得。
 */
export function parseYearPage(html: string, yearPageUrl: string): KyonanPdfRecord[] {
  const records: KyonanPdfRecord[] = [];
  const seen = new Set<string>();

  const pattern =
    /<a\s[^>]*href="([^"]*\/uploaded\/attachment\/[^"]*\.pdf)"[^>]*>([\s\S]*?)<\/a>/gi;

  let m: RegExpExecArray | null;
  while ((m = pattern.exec(html)) !== null) {
    const href = m[1]!;
    const linkText = m[2]!.replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim();

    if (!linkText) continue;

    const pdfUrl = href.startsWith("http")
      ? href
      : href.startsWith("//")
        ? `https:${href}`
        : `${BASE_ORIGIN}${href.startsWith("/") ? "" : "/"}${href}`;

    if (seen.has(pdfUrl)) continue;
    seen.add(pdfUrl);

    // リンクテキストからファイルサイズ情報を除去（例: "令和７年第１回定例会会議録（PDF：1.2MB）"）
    const title = linkText
      .replace(/[（(]\s*PDF[：:][^）)]*[）)]/gi, "")
      .trim();

    if (!title) continue;

    records.push({
      title,
      pdfUrl,
      meetingType: detectMeetingType(title),
      yearPageUrl,
    });
  }

  return records;
}

/**
 * 指定年度の PDF レコード一覧を取得する。
 */
export async function fetchPdfList(year: number): Promise<KyonanPdfRecord[]> {
  const yearPageUrl = buildYearPageUrl(year);
  if (!yearPageUrl) {
    console.warn(`[124630-kyonan] 年度 ${year} の URL が未登録`);
    return [];
  }

  const html = await fetchPage(yearPageUrl);
  if (!html) return [];

  return parseYearPage(html, yearPageUrl);
}
