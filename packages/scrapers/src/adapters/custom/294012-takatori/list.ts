/**
 * 高取町議会 -- list フェーズ
 *
 * 1. トップページ（frmCd=1-1-5-0-0）から全会議の contents_detail.php リンクを取得
 * 2. 各詳細ページにアクセスして PDF リンクを収集
 *
 * トップページ: https://www.town.takatori.nara.jp/category_list.php?frmCd=1-1-5-0-0
 */

import {
  BASE_ORIGIN,
  LIST_URL,
  detectMeetingType,
  fetchPage,
  frmCdToYear,
  normalizeDigits,
} from "./shared";

export interface TakatoriMeeting {
  /** 会議名（例: "第4回定例会"） */
  title: string;
  /** frmId（詳細ページの識別子） */
  frmId: string;
  /** frmCd（年度コード入り、例: "1-1-5-5-0"） */
  frmCd: string;
  /** 詳細ページ URL */
  detailUrl: string;
  /** 西暦年（frmCd から算出） */
  year: number;
}

export interface TakatoriPdfInfo {
  /** PDF の絶対 URL */
  pdfUrl: string;
  /** リンクテキスト（例: "本会議　12月8日"） */
  label: string;
}

export interface TakatoriSession {
  /** 会議名 */
  title: string;
  /** 会議種別 */
  meetingType: string;
  /** 西暦年 */
  year: number;
  /** frmId */
  frmId: string;
  /** PDF 情報リスト */
  pdfs: TakatoriPdfInfo[];
}

/**
 * トップページの HTML から会議リンクを抽出する（テスト可能な純粋関数）。
 *
 * HTML 構造例:
 *   <a href="contents_detail.php?co=cat&frmId=2539&frmCd=1-1-5-5-0">第4回定例会</a>
 */
export function parseMeetingLinks(html: string): TakatoriMeeting[] {
  const meetings: TakatoriMeeting[] = [];
  const seen = new Set<string>();

  const pattern =
    /href="([^"]*contents_detail\.php\?[^"]*frmId=(\d+)[^"]*frmCd=([\d-]+)[^"]*)">([^<]+)/gi;

  for (const match of html.matchAll(pattern)) {
    const rawHref = match[1]!;
    const frmId = match[2]!;
    const frmCd = match[3]!;
    const rawTitle = match[4]!.trim();

    // 重複チェック
    if (seen.has(frmId)) continue;
    seen.add(frmId);

    const year = frmCdToYear(frmCd);
    if (!year) continue;

    // 絶対 URL に変換
    const detailUrl = rawHref.startsWith("http")
      ? rawHref
      : `${BASE_ORIGIN}/${rawHref.replace(/^\//, "")}`;

    meetings.push({
      title: rawTitle,
      frmId,
      frmCd,
      detailUrl,
      year,
    });
  }

  return meetings;
}

/**
 * 詳細ページの HTML から PDF リンクを抽出する（テスト可能な純粋関数）。
 *
 * HTML 構造例:
 *   <a href="/cmsfiles/contents/0000002/2539/1.pdf">本会議　2月24日</a>
 */
export function parsePdfLinks(html: string, baseUrl: string): TakatoriPdfInfo[] {
  const pdfs: TakatoriPdfInfo[] = [];
  const seen = new Set<string>();

  // PDF リンクパターン（href が .pdf で終わる）
  const pattern = /href="([^"]+\.pdf)"[^>]*>([^<]*)</gi;

  for (const match of html.matchAll(pattern)) {
    const rawHref = match[1]!;
    const label = match[2]!.trim();

    // 絶対 URL に変換
    let pdfUrl: string;
    if (rawHref.startsWith("http")) {
      pdfUrl = rawHref;
    } else if (rawHref.startsWith("/")) {
      pdfUrl = `${BASE_ORIGIN}${rawHref}`;
    } else {
      pdfUrl = new URL(rawHref, baseUrl).href;
    }

    if (seen.has(pdfUrl)) continue;
    seen.add(pdfUrl);

    pdfs.push({ pdfUrl, label });
  }

  return pdfs;
}

/**
 * 指定年の会議録 PDF セッション一覧を取得する。
 */
export async function fetchSessionList(
  year: number,
): Promise<TakatoriSession[]> {
  const html = await fetchPage(LIST_URL);
  if (!html) return [];

  const meetings = parseMeetingLinks(html);

  // 対象年のみフィルタリング
  const filtered = meetings.filter((m) => m.year === year);

  const sessions: TakatoriSession[] = [];

  for (const meeting of filtered) {
    // レート制限: 1〜2 秒待機
    await new Promise((resolve) => setTimeout(resolve, 1000));

    const detailHtml = await fetchPage(meeting.detailUrl);
    if (!detailHtml) continue;

    const pdfs = parsePdfLinks(detailHtml, meeting.detailUrl);
    if (pdfs.length === 0) continue;

    // 会議名から年度のプレフィックスを除去（タイトルにそのまま使用）
    const title = normalizeDigits(meeting.title);

    sessions.push({
      title,
      meetingType: detectMeetingType(title),
      year: meeting.year,
      frmId: meeting.frmId,
      pdfs,
    });
  }

  return sessions;
}
