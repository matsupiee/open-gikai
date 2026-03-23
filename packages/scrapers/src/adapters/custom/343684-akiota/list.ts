/**
 * 安芸太田町議会 — list フェーズ
 *
 * 1. 一覧ページ list26-80.html から年度別ページ URL を取得
 * 2. 対象年度ページから h2 セクションと PDF リンクを抽出
 *
 * PDF リンクテキストからメタ情報（元号・回次・会議種別・日付）を正規表現で抽出する。
 */

import {
  buildYearPageUrl,
  buildPdfUrl,
  detectMeetingType,
  fetchPage,
  delay,
} from "./shared";

export interface AkiotaSessionInfo {
  /** 会議タイトル（例: "令和7年第1回安芸太田町議会定例会会議録（2月21日）"） */
  title: string;
  /** 開催日 YYYY-MM-DD */
  heldOn: string;
  /** PDF の絶対 URL */
  pdfUrl: string;
  /** 会議種別 */
  meetingType: string;
}

const INTER_PAGE_DELAY_MS = 1500;

/**
 * 一覧ページ HTML から年度ページリンクを抽出する。
 */
export interface YearPageLink {
  /** 西暦年度 */
  year: number;
  /** 年度ページの絶対 URL */
  url: string;
  /** ページ ID */
  pageId: string;
}

export function parseYearPageLinks(html: string): YearPageLink[] {
  const links: YearPageLink[] = [];
  const seen = new Set<string>();

  // a タグから年度ページを抽出（/site/gikai/{pageId}.html パターン）
  const pattern =
    /<a\s[^>]*href="\/site\/gikai\/(\d+)\.html"[^>]*>([^<]+)<\/a>/gi;

  let m: RegExpExecArray | null;
  while ((m = pattern.exec(html)) !== null) {
    const pageId = m[1]!;
    const linkText = m[2]!.trim();

    if (seen.has(pageId)) continue;
    seen.add(pageId);

    // リンクテキストから年を抽出（例: "令和7年　定例会・臨時会の会議録"）
    const yearMatch = linkText.match(/(令和|平成)(\d+|元)年/);
    if (!yearMatch) continue;

    // 会議録関連のリンクのみ対象
    if (!linkText.includes("会議録")) continue;

    const era = yearMatch[1]!;
    const num = yearMatch[2] === "元" ? 1 : parseInt(yearMatch[2]!, 10);
    const year = era === "令和" ? 2018 + num : 1988 + num;

    links.push({
      year,
      url: buildYearPageUrl(pageId),
      pageId,
    });
  }

  return links;
}

/**
 * 年度ページ HTML から PDF リンクを抽出する。
 *
 * h2 タグで会議種別のセクションが分かれ、
 * 各セクション内の div.file_pdf に PDF リンクが並ぶ。
 */
export function parsePdfLinks(html: string): AkiotaSessionInfo[] {
  const records: AkiotaSessionInfo[] = [];

  // h2 と div.file_pdf のペアを抽出するため、h2 位置をまず収集
  const h2Pattern = /<h2[^>]*>([\s\S]*?)<\/h2>/gi;
  const h2Positions: { index: number; text: string }[] = [];

  let h2Match: RegExpExecArray | null;
  while ((h2Match = h2Pattern.exec(html)) !== null) {
    const text = h2Match[1]!.replace(/<[^>]+>/g, "").trim();
    h2Positions.push({ index: h2Match.index, text });
  }

  // PDF リンクを全件抽出し、直前の h2 セクションと紐付ける
  const pdfPattern =
    /<a\s[^>]*href="(\/uploaded\/life\/[^"]+\.pdf)"[^>]*>([^<]+)<\/a>/gi;

  let pdfMatch: RegExpExecArray | null;
  while ((pdfMatch = pdfPattern.exec(html)) !== null) {
    const pdfPath = pdfMatch[1]!;
    const linkText = pdfMatch[2]!.trim();

    // メタ情報を正規表現で抽出
    const metaPattern =
      /^(令和|平成)(\d+)年第(\d+)回安芸太田町議会(定例会|臨時会)会議録（(\d+)月(\d+)日）/;
    const meta = linkText.match(metaPattern);
    if (!meta) continue;

    const era = meta[1]!;
    const eraYear = parseInt(meta[2]!, 10);
    const meetingKind = meta[4]!;
    const month = parseInt(meta[5]!, 10);
    const day = parseInt(meta[6]!, 10);

    const year = era === "令和" ? 2018 + eraYear : 1988 + eraYear;
    const heldOn = `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;

    const meetingType = detectMeetingType(meetingKind);

    // タイトルから [PDFファイル/...] を除去
    const title = linkText.replace(/\s*\[PDF.*$/i, "").trim();

    records.push({
      title,
      heldOn,
      pdfUrl: buildPdfUrl(pdfPath),
      meetingType,
    });
  }

  return records;
}

/**
 * 指定年度の全セッション日 PDF を収集する。
 * 一覧ページ → 年度ページ → PDF リンク の順に辿る。
 */
export async function fetchSessionList(
  baseUrl: string,
  year: number,
): Promise<AkiotaSessionInfo[]> {
  // Step 1: 一覧ページから年度ページ URL を取得
  const indexUrl = `${baseUrl.replace(/\/$/, "")}`;
  const indexHtml = await fetchPage(indexUrl);
  if (!indexHtml) return [];

  const yearPages = parseYearPageLinks(indexHtml);
  const yearPage = yearPages.find((p) => p.year === year);
  if (!yearPage) return [];

  await delay(INTER_PAGE_DELAY_MS);

  // Step 2: 年度ページから PDF リンクを抽出
  const yearHtml = await fetchPage(yearPage.url);
  if (!yearHtml) return [];

  return parsePdfLinks(yearHtml);
}
