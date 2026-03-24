/**
 * 松崎町議会（静岡県） — list フェーズ
 *
 * 全件一覧ページ（3ページ）をクロールして各会議録詳細ページの URL を収集し、
 * 詳細ページから PDF リンク・会議名・開催日を抽出する。
 *
 * 詳細ページには 2 種類の粒度が混在する:
 * - 年度まとめ型（令和4年以降）: 1 ページに複数 PDF
 * - 会議単位型（令和3年以前）: 1 ページに 1 PDF
 *
 * list フェーズでは PDF ごとに 1 レコードを返す。
 */

import {
  BASE_ORIGIN,
  detectMeetingType,
  parseWarekiYear,
  buildDateString,
  fetchPage,
  delay,
} from "./shared";

export interface MatsuzakiSessionInfo {
  /** 会議タイトル（例: "令和６年 第１回定例会"） */
  title: string;
  /** 開催日 YYYY-MM-DD（解析できない場合は null） */
  heldOn: string | null;
  /** PDF の絶対 URL */
  pdfUrl: string;
  /** 会議種別 */
  meetingType: string;
  /** 詳細ページ ID（/docs/{ID}/） */
  docId: string;
}

const INTER_PAGE_DELAY_MS = 1500;

/** 全件一覧ページ URL（3 ページ） */
const LIST_PAGE_URLS = [
  `${BASE_ORIGIN}/categories/guide/chogikai/kaigiroku/more@docs.html`,
  `${BASE_ORIGIN}/categories/guide/chogikai/kaigiroku/more@docs.p2.html`,
  `${BASE_ORIGIN}/categories/guide/chogikai/kaigiroku/more@docs.p3.html`,
];

/**
 * 全件一覧ページ HTML から詳細ページの ID リストを抽出する。
 * リンク形式: <a href="/docs/{ID}/">タイトル</a>
 */
export function parseDocIds(html: string): Array<{ docId: string; title: string }> {
  const results: Array<{ docId: string; title: string }> = [];
  const seen = new Set<string>();

  const pattern = /<a\s[^>]*href="\/docs\/(\d+)\/?[^"]*"[^>]*>([^<]+)<\/a>/gi;

  let m: RegExpExecArray | null;
  while ((m = pattern.exec(html)) !== null) {
    const docId = m[1]!;
    const title = m[2]!.replace(/\s+/g, " ").trim();

    // 会議録関連のリンクのみ対象（議事録、会議録）
    if (!title.includes("会議録") && !title.includes("議事録")) continue;

    if (seen.has(docId)) continue;
    seen.add(docId);

    results.push({ docId, title });
  }

  return results;
}

/**
 * 詳細ページ HTML から PDF リンク情報を抽出する。
 *
 * 年度まとめ型の例:
 *   <a href="/docs/5619/file_contents/20240119r01kaigiroku.pdf">
 *     第１回臨時会（2024年1月19日）
 *   </a>
 *
 * 会議単位型の例:
 *   <a href="/docs/1234/file_contents/h29t1kaigiroku.pdf">
 *     h29t1kaigiroku.pdf
 *   </a>
 *
 * 詳細ページタイトルも併用してフォールバックする。
 */
export interface PdfRecord {
  /** PDF の絶対 URL */
  pdfUrl: string;
  /** リンクテキスト */
  linkText: string;
}

export function extractPdfLinks(html: string, docId: string): PdfRecord[] {
  const results: PdfRecord[] = [];
  const seen = new Set<string>();

  // /docs/{ID}/file_contents/*.pdf パターン
  const pattern = /<a\s[^>]*href="([^"]*\/docs\/\d+\/file_contents\/[^"]+\.pdf)"[^>]*>([^<]*)<\/a>/gi;

  let m: RegExpExecArray | null;
  while ((m = pattern.exec(html)) !== null) {
    const href = m[1]!.trim();
    const linkText = m[2]!.trim();

    // 絶対 URL に変換
    const pdfUrl = href.startsWith("http") ? href : `${BASE_ORIGIN}${href}`;

    if (seen.has(pdfUrl)) continue;
    seen.add(pdfUrl);

    results.push({ pdfUrl, linkText });
  }

  // 相対パス形式もサポート: href="file_contents/xxx.pdf"
  const relPattern = /<a\s[^>]*href="(file_contents\/[^"]+\.pdf)"[^>]*>([^<]*)<\/a>/gi;
  while ((m = relPattern.exec(html)) !== null) {
    const href = m[1]!.trim();
    const linkText = m[2]!.trim();
    const pdfUrl = `${BASE_ORIGIN}/docs/${docId}/${href}`;

    if (seen.has(pdfUrl)) continue;
    seen.add(pdfUrl);

    results.push({ pdfUrl, linkText });
  }

  return results;
}

/**
 * 詳細ページ HTML からページタイトルを抽出する。
 * 例: <h2 class="article-body-title">令和６年松崎町議会会議録</h2>
 */
export function parsePageTitle(html: string): string | null {
  const m = html.match(/<h[1-3][^>]*class="[^"]*(?:title|heading)[^"]*"[^>]*>([^<]+)<\/h[1-3]>/i);
  if (m) return m[1]!.trim();

  // <title> タグからフォールバック
  const titleM = html.match(/<title>([^<]+)<\/title>/i);
  if (titleM) return titleM[1]!.trim();

  return null;
}

/**
 * 詳細ページから PDF セッション情報を解析する。
 *
 * 年度まとめ型: リンクテキストから会議名・開催日を取得
 * 会議単位型: ページタイトルから会議名・開催日を取得
 */
export function parseDetailPage(
  html: string,
  docId: string,
  pageTitle: string
): MatsuzakiSessionInfo[] {
  const pdfLinks = extractPdfLinks(html, docId);
  if (pdfLinks.length === 0) return [];

  const results: MatsuzakiSessionInfo[] = [];
  const pageYear = parseWarekiYear(pageTitle);

  for (const { pdfUrl, linkText } of pdfLinks) {
    // リンクテキストから会議名・開催日を取得（年度まとめ型）
    // 例: "第１回臨時会（2024年1月19日）" または "第１回定例会（令和6年3月6日〜13日）"
    const sessionFromLink = parseSessionFromLinkText(linkText, pdfUrl, pageTitle);
    if (sessionFromLink) {
      results.push(sessionFromLink);
      continue;
    }

    // リンクテキストから取得できない場合、ページタイトルをタイトルとして使用（会議単位型）
    const heldOn = pageYear ? extractDateFromText(pageTitle, pageYear) : null;
    results.push({
      title: pageTitle,
      heldOn,
      pdfUrl,
      meetingType: detectMeetingType(pageTitle),
      docId,
    });
  }

  return results;
}

/**
 * リンクテキストからセッション情報を解析する。
 *
 * パターン例:
 * - "第１回臨時会（2024年1月19日）"
 * - "第１回定例会（2024年3月6日〜13日）"
 * - "第２回定例会（令和6年6月4日〜6日）"
 */
function parseSessionFromLinkText(
  linkText: string,
  pdfUrl: string,
  pageTitle: string
): MatsuzakiSessionInfo | null {
  // 会議名を正規化（全角数字など含む）
  const sessionNameMatch = linkText.match(/第[０-９\d]+回(定例会|臨時会|委員会)/);
  if (!sessionNameMatch) return null;

  const sessionName = sessionNameMatch[0]!;
  const meetingType = detectMeetingType(sessionName);

  // 開催日の抽出
  let heldOn: string | null = null;

  // パターン1: 西暦 "（2024年1月19日）" または "（2024年3月6日〜13日）"
  const seirekiMatch = linkText.match(/（(\d{4})年(\d{1,2})月(\d{1,2})日/);
  if (seirekiMatch) {
    const year = parseInt(seirekiMatch[1]!, 10);
    const month = parseInt(seirekiMatch[2]!, 10);
    const day = parseInt(seirekiMatch[3]!, 10);
    heldOn = `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
  }

  // パターン2: 和暦 "（令和6年6月4日〜6日）"
  if (!heldOn) {
    const wareki = linkText.match(/（(令和|平成)(元|\d+)年(\d{1,2})月(\d{1,2})日/);
    if (wareki) {
      const era = wareki[1]!;
      const yearNum = wareki[2]!;
      const n = yearNum === "元" ? 1 : parseInt(yearNum, 10);
      const year = era === "令和" ? 2018 + n : 1988 + n;
      const month = parseInt(wareki[3]!, 10);
      const day = parseInt(wareki[4]!, 10);
      heldOn = `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    }
  }

  // 年度情報をページタイトルから補完してタイトルを組み立てる
  const pageYear = parseWarekiYear(pageTitle);
  const titlePrefix = pageYear ? `${pageYear}年` : "";
  const title = `${titlePrefix} ${sessionName}`.trim();

  // docId をページタイトルから取得（ここでは pdfUrl から抽出）
  const docIdMatch = pdfUrl.match(/\/docs\/(\d+)\//);
  const docId = docIdMatch?.[1] ?? "";

  return {
    title,
    heldOn,
    pdfUrl,
    meetingType,
    docId,
  };
}

/**
 * テキストから開催日を抽出する補助関数。
 * 例: "平成29年松崎町議会第1回定例会議事録" → "1月" が見つからない場合は null
 */
function extractDateFromText(text: string, year: number): string | null {
  // 月日パターン
  const md = text.match(/(\d{1,2})月(\d{1,2})日/);
  if (md) {
    return buildDateString(year, `${md[1]}月${md[2]}日`);
  }
  return null;
}

/**
 * 指定年の全セッションを収集する。
 *
 * 1. 全件一覧の 3 ページから詳細ページ ID を収集
 * 2. 各詳細ページから PDF リンクを抽出
 * 3. 対象年のセッションのみフィルタリング
 */
export async function fetchSessionList(year: number): Promise<MatsuzakiSessionInfo[]> {
  // Step 1: 全件一覧から詳細ページ ID を収集
  const allDocEntries: Array<{ docId: string; title: string }> = [];
  const seenDocIds = new Set<string>();

  for (const listUrl of LIST_PAGE_URLS) {
    const html = await fetchPage(listUrl);
    if (!html) continue;

    const entries = parseDocIds(html);
    for (const entry of entries) {
      if (!seenDocIds.has(entry.docId)) {
        seenDocIds.add(entry.docId);
        allDocEntries.push(entry);
      }
    }

    await delay(INTER_PAGE_DELAY_MS);
  }

  // Step 2: 各詳細ページから PDF を収集し、対象年でフィルタリング
  const allSessions: MatsuzakiSessionInfo[] = [];

  for (const { docId, title: listTitle } of allDocEntries) {
    // ページタイトルから西暦年を取得してフィルタリング
    const entryYear = parseWarekiYear(listTitle);
    if (entryYear !== null && entryYear !== year) continue;

    await delay(INTER_PAGE_DELAY_MS);

    const detailUrl = `${BASE_ORIGIN}/docs/${docId}/`;
    const html = await fetchPage(detailUrl);
    if (!html) continue;

    const pageTitle = parsePageTitle(html) ?? listTitle;
    const sessions = parseDetailPage(html, docId, pageTitle);

    // PDF 個別に年フィルタリング
    for (const session of sessions) {
      if (session.heldOn) {
        const sessionYear = parseInt(session.heldOn.slice(0, 4), 10);
        if (sessionYear === year) {
          allSessions.push(session);
        }
      } else {
        // heldOn が不明な場合、entryYear が一致していれば追加
        if (entryYear === year) {
          allSessions.push(session);
        }
      }
    }
  }

  return allSessions;
}
