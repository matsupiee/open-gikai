/**
 * 紀北町議会 -- list フェーズ
 *
 * 1. 年度別投稿 URL をハードコードから取得（または令和4年用 URL を使用）
 * 2. 各投稿ページから PDF リンクを抽出
 * 3. 参考資料（会期日程・議事日程・応招・不応招）は除外
 * 4. リンクテキストから会議タイトル・会議種別・開催月を推定
 *
 * 開催日の日付は PDF テキストから取得するため、list フェーズでは
 * heldOn を持たず、月情報のみ提供する。
 */

import {
  BASE_ORIGIN,
  YEAR_POST_URLS,
  REIWA4_POST_URL,
  detectMeetingType,
  isSkipTarget,
  fetchPage,
  delay,
} from "./shared";

export interface KihokuPdfRecord {
  /** 会議タイトル（リンクテキストをクリーンアップしたもの） */
  title: string;
  /** 会議種別 */
  meetingType: string;
  /** PDF の絶対 URL */
  pdfUrl: string;
  /** 対象年 */
  year: number;
  /** 投稿ページ URL（externalId 生成に使用） */
  postUrl: string;
}

const INTER_PAGE_DELAY_MS = 1500;

/**
 * 指定年の全 PDF レコードを収集する。
 */
export async function fetchPdfList(
  _baseUrl: string,
  year: number
): Promise<KihokuPdfRecord[]> {
  const postUrls: string[] = [];

  // 令和4年（2022年）は別途 URL
  if (year === 2022) {
    postUrls.push(REIWA4_POST_URL);
  }

  const mainUrl = YEAR_POST_URLS[year];
  if (mainUrl) {
    postUrls.push(mainUrl);
  }

  if (postUrls.length === 0) return [];

  const allRecords: KihokuPdfRecord[] = [];

  for (const postUrl of postUrls) {
    await delay(INTER_PAGE_DELAY_MS);
    const html = await fetchPage(postUrl);
    if (!html) continue;

    const records = extractPdfLinks(html, year, postUrl);
    allRecords.push(...records);
  }

  return allRecords;
}

/**
 * 投稿ページ HTML から PDF リンクを抽出する。
 *
 * テスト用に export する。
 */
export function extractPdfLinks(
  html: string,
  year: number,
  postUrl: string
): KihokuPdfRecord[] {
  const records: KihokuPdfRecord[] = [];

  const pdfPattern = /<a\s[^>]*href="([^"]*\.pdf)"[^>]*>([^<]+)<\/a>/gi;

  let m: RegExpExecArray | null;
  while ((m = pdfPattern.exec(html)) !== null) {
    const href = m[1]!;
    const rawText = m[2]!.replace(/\s+/g, " ").trim();

    // 参考資料をスキップ
    if (isSkipTarget(rawText)) continue;

    // リンクテキストからカギカッコを除去してタイトルを整形
    const title = rawText.replace(/^「/, "").replace(/」$/, "").trim();
    if (!title) continue;

    // PDF 絶対 URL を構築
    let absoluteUrl: string;
    try {
      absoluteUrl = new URL(href, postUrl).toString();
    } catch {
      // 相対パスでも BASE_ORIGIN ベースで解決を試みる
      absoluteUrl = new URL(href, BASE_ORIGIN).toString();
    }

    const meetingType = detectMeetingType(title);

    records.push({
      title,
      meetingType,
      pdfUrl: absoluteUrl,
      year,
      postUrl,
    });
  }

  return records;
}
