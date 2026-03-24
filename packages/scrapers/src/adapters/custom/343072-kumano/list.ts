/**
 * 熊野町議会（広島県） — list フェーズ
 *
 * 年度別記事ページから PDF リンクを収集し、
 * 目次 PDF を除いたセッションごとの情報を返す。
 *
 * fetchDetail は MeetingData | null を1件返すため、
 * list フェーズで PDF ごとに1レコードを返す。
 */

import {
  BASE_ORIGIN,
  YEAR_CONTENT_URLS,
  detectMeetingType,
  parseWarekiYear,
  buildDateString,
  fetchPage,
  delay,
} from "./shared";

export interface KumanoSessionInfo {
  /** 会議タイトル（例: "令和6年第1回熊野町議会定例会（3月5日）"） */
  title: string;
  /** 開催日 YYYY-MM-DD（解析できない場合は null） */
  heldOn: string | null;
  /** PDF の絶対 URL */
  pdfUrl: string;
  /** 会議種別 */
  meetingType: "plenary" | "extraordinary" | "committee";
}

const INTER_PAGE_DELAY_MS = 1500;

/**
 * 指定年の年度記事ページから PDF セッション情報を収集する。
 * 目次 PDF はスキップする。
 */
export async function fetchSessionList(
  year: number
): Promise<KumanoSessionInfo[]> {
  const entry = YEAR_CONTENT_URLS.find((e) => e.year === year);
  if (!entry) return [];

  const url = `${BASE_ORIGIN}${entry.contentUrl}`;
  const html = await fetchPage(url);
  if (!html) return [];

  await delay(INTER_PAGE_DELAY_MS);

  return parsePdfLinks(html);
}

// --- HTML パーサー（テスト用に export） ---

export interface PdfLinkInfo {
  /** PDF の絶対 URL */
  pdfUrl: string;
  /** リンクテキスト */
  linkText: string;
}

/**
 * 記事ページ HTML から PDF リンク情報を抽出する。
 */
export function extractPdfLinks(html: string): PdfLinkInfo[] {
  const results: PdfLinkInfo[] = [];

  // PDF リンクパターン: href が .pdf で終わるリンク
  const pdfPattern = /<a\s[^>]*href="([^"]*\.pdf)"[^>]*>([^<]*)<\/a>/gi;

  let m: RegExpExecArray | null;
  while ((m = pdfPattern.exec(html)) !== null) {
    const href = m[1]!.trim();
    const rawText = m[2]!.trim();

    if (!href || !rawText) continue;

    // "(PDF文書：XXX)" や "(PDFファイル：XXX)" 等のファイルサイズ表記を除去
    const text = rawText.replace(/\(PDF[^)]*\)/g, "").trim();

    if (!text) continue;

    // 絶対 URL に変換
    const pdfUrl = href.startsWith("http") ? href : `${BASE_ORIGIN}${href}`;

    results.push({ pdfUrl, linkText: text });
  }

  return results;
}

/**
 * PDF リンクテキストからメタ情報を解析し、セッション情報を返す。
 * 目次 PDF（リンクテキストに「目次」を含む）はスキップする。
 */
export function parsePdfLinks(html: string): KumanoSessionInfo[] {
  const pdfLinks = extractPdfLinks(html);
  const results: KumanoSessionInfo[] = [];

  for (const { pdfUrl, linkText } of pdfLinks) {
    // 目次 PDF はスキップ
    if (linkText.includes("目次")) continue;

    const session = parseLinkText(linkText, pdfUrl);
    if (session) {
      results.push(session);
    }
  }

  return results;
}

/**
 * リンクテキストからセッション情報を解析する。
 *
 * パターン1: "令和6年第1回熊野町議会定例会（3月5日）"
 * パターン2: "令和6年予算特別委員会"
 * パターン3: "令和6年第1回熊野町議会全員協議会（1月25日）"
 */
export function parseLinkText(
  linkText: string,
  pdfUrl: string
): KumanoSessionInfo | null {
  // パターン1・3: 定例会・臨時会・全員協議会（日付括弧付き）
  const meetingWithDate =
    /^(令和|平成)(\d+|元)年第(\d+)回熊野町議会(定例会|臨時会|全員協議会)（(.+?)）$/.exec(
      linkText
    );
  if (meetingWithDate) {
    const era = meetingWithDate[1]!;
    const yearNum = meetingWithDate[2]!;
    const n = yearNum === "元" ? 1 : parseInt(yearNum, 10);
    const westernYear = era === "令和" ? 2018 + n : 1988 + n;
    const meetingKind = meetingWithDate[4]!;
    const dateOrLabel = meetingWithDate[5]!;

    const meetingType = detectMeetingType(meetingKind);
    const heldOn = buildDateString(westernYear, dateOrLabel);

    return {
      title: linkText,
      heldOn,
      pdfUrl,
      meetingType,
    };
  }

  // パターン2: 特別委員会（日付括弧なし）
  // 例: "令和6年予算特別委員会" (末尾に全角スペース等が来ることもある)
  const committeePattern =
    /^(令和|平成)(\d+|元)年(予算特別委員会|決算特別委員会)[\s　]*$/.exec(linkText);
  if (committeePattern) {
    const westernYear = parseWarekiYear(linkText);

    return {
      title: linkText.trim(),
      heldOn: westernYear ? `${westernYear}-01-01` : null,
      pdfUrl,
      meetingType: "committee",
    };
  }

  return null;
}
