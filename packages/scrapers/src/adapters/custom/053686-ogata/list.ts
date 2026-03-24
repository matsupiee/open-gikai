/**
 * 大潟村議会 -- list フェーズ
 *
 * 2段階で PDF リンクを収集する:
 * 1. 一覧ページ（/genre/parliament/minutes）から対象年度の会議リンクを取得
 * 2. 各詳細ページから PDF URL を抽出
 */

import { BASE_ORIGIN, LIST_URL, fetchPage, toJapaneseEraTexts } from "./shared";

export interface OgataMeeting {
  /** 詳細ページの URL */
  detailUrl: string;
  /** リンクテキスト（例: "令和6年第8回（12月）定例会　会議録"） */
  title: string;
  /** 本会議の PDF URL（目次以外） */
  pdfUrl: string;
  /** 委員会の PDF URL リスト */
  committeePdfUrls: string[];
  /** 会議を一意に識別する文字列（詳細ページ URL から抽出） */
  meetingId: string;
}

/**
 * 一覧ページ HTML から会議リンクを抽出する。
 *
 * リンクパターン:
 *   https://www.vill.ogata.akita.jp/archive/p{YYYYMMDDHHmmss}
 *   https://www.vill.ogata.akita.jp/archive/p{YYYYMMDDHHmmss}-{N}（重複回避サフィックス付き）
 *   https://www.vill.ogata.akita.jp/archive/contents-{番号}（旧形式）
 *   /archive/... （相対パス形式）
 *
 * 対象年度の会議のみを返す。
 */
export function parseListPage(
  html: string,
  year: number,
): { title: string; url: string }[] {
  const results: { title: string; url: string }[] = [];
  const eraTexts = toJapaneseEraTexts(year);

  // /archive/ または BASE_ORIGIN/archive/ へのリンクを全て抽出
  const archivePattern = `(?:${BASE_ORIGIN})?/archive/[^"]+`;
  const linkRegex = new RegExp(
    `<a[^>]+href="(${archivePattern})"[^>]*>([\\s\\S]*?)<\\/a>`,
    "g",
  );

  for (const match of html.matchAll(linkRegex)) {
    const href = match[1]!;
    const rawText = match[2]!.replace(/<[^>]+>/g, "").trim();
    // 会議録テキストを正規化（全角スペースも半角スペースに）
    const title = rawText.replace(/[\s　]+/g, " ").replace(/\s+/g, " ").trim();

    // 対象年度のリンクかチェック
    if (!eraTexts.some((era) => title.includes(era))) continue;
    // 会議録リンクのみ（定例会・臨時会を含む）
    if (!title.includes("定例会") && !title.includes("臨時会")) continue;

    // 絶対 URL に変換
    const url = href.startsWith("http") ? href : `${BASE_ORIGIN}${href}`;
    results.push({ title, url });
  }

  return results;
}

/**
 * 詳細ページ HTML から PDF URL を抽出する。
 *
 * 目次 PDF（ファイル名に「目次」を含む）はスキップする。
 * 本会議 PDF と委員会 PDF を区別して返す。
 */
export function parseDetailPage(
  html: string,
): { mainPdfUrl: string | null; committeePdfUrls: string[] } {
  let mainPdfUrl: string | null = null;
  const committeePdfUrls: string[] = [];

  // /uploads/public/archive_ で始まる PDF リンクを全て抽出
  const pdfRegex =
    /<a[^>]+href="(\/uploads\/public\/archive_[^"]+\.pdf)"[^>]*>([\s\S]*?)<\/a>/gi;

  for (const match of html.matchAll(pdfRegex)) {
    const href = match[1]!;
    const linkText = match[2]!.replace(/<[^>]+>/g, "").trim();
    const filename = href.split("/").pop() ?? "";

    // URL デコードしてファイル名を得る
    let decodedFilename: string;
    try {
      decodedFilename = decodeURIComponent(filename);
    } catch {
      decodedFilename = filename;
    }

    // 目次 PDF はスキップ
    if (decodedFilename.includes("目次") || linkText.includes("目次")) continue;

    const pdfUrl = `${BASE_ORIGIN}${href}`;

    // 委員会 PDF かどうかを判定（ファイル名に委員会名を含む）
    if (
      decodedFilename.includes("委員会") ||
      linkText.includes("委員会") ||
      decodedFilename.includes("特別委員") ||
      linkText.includes("特別委員")
    ) {
      committeePdfUrls.push(pdfUrl);
    } else {
      // 本会議 PDF（最初のものを採用）
      if (!mainPdfUrl) {
        mainPdfUrl = pdfUrl;
      }
    }
  }

  return { mainPdfUrl, committeePdfUrls };
}

/**
 * 詳細ページ URL から meetingId を抽出する。
 * 例: "https://...ogata.akita.jp/archive/p20250310144400" -> "p20250310144400"
 */
export function extractMeetingId(detailUrl: string): string {
  const m = detailUrl.match(/\/archive\/(.+)$/);
  return m ? m[1]! : detailUrl;
}

/**
 * 指定年の全会議の PDF リンクを取得する。
 */
export async function fetchMeetingList(
  baseUrl: string,
  year: number,
): Promise<OgataMeeting[]> {
  // 一覧ページを取得（baseUrl は municipalities テーブルの url カラム）
  const listUrl = baseUrl || LIST_URL;
  const listHtml = await fetchPage(listUrl);
  if (!listHtml) return [];

  const meetingLinks = parseListPage(listHtml, year);
  if (meetingLinks.length === 0) return [];

  const meetings: OgataMeeting[] = [];

  for (let i = 0; i < meetingLinks.length; i++) {
    const link = meetingLinks[i]!;
    const detailHtml = await fetchPage(link.url);
    if (!detailHtml) continue;

    const { mainPdfUrl, committeePdfUrls } = parseDetailPage(detailHtml);
    if (!mainPdfUrl) continue;

    meetings.push({
      detailUrl: link.url,
      title: link.title,
      pdfUrl: mainPdfUrl,
      committeePdfUrls,
      meetingId: extractMeetingId(link.url),
    });

    // レート制限: 最後の1件ではスリープしない
    if (i < meetingLinks.length - 1) {
      await new Promise((r) => setTimeout(r, 1000));
    }
  }

  return meetings;
}
