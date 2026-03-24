/**
 * 茂木町議会 — list フェーズ
 *
 * 2 段階で PDF リンクを収集する:
 * 1. トップページ (nextpage.php?cd=17800&syurui=1) から会議別ページリンクを取得
 * 2. 会議別ページ (nextpage.php?cd={ID}&syurui=2) から PDF ダウンロード URL を収集
 *
 * リンクテキストのパターン:
 *   令和: "令和X年X月　定例会　会議録" / "令和X年X月　臨時会　会議録"
 *   平成: "H24.3 定例会" など
 */

import { BASE_ORIGIN, TOP_PAGE_URL, detectMeetingType, fetchPage, parseJapaneseDate } from "./shared";

export interface MotegiMeeting {
  /** PDF の完全 URL */
  pdfUrl: string;
  /** 会議タイトル（例: "令和6年12月　定例会　会議録"） */
  title: string;
  /** 開催日 YYYY-MM-DD（PDF から抽出、失敗時は null） */
  heldOn: string | null;
  /** 会議 ID（cd パラメータ） */
  meetingId: string;
  /** PDF ファイル名（外部 ID 用） */
  pdfFileName: string;
}

/**
 * トップページから会議別ページへのリンクを抽出する。
 * 対象: nextpage.php?cd={ID}&syurui=2 パターンのリンク
 */
export function parseTopPage(
  html: string
): { meetingId: string; title: string; meetingUrl: string }[] {
  const results: { meetingId: string; title: string; meetingUrl: string }[] = [];

  // nextpage.php?cd={ID}&syurui=2 パターンのリンクを抽出
  const linkRegex =
    /href="[^"]*nextpage\.php\?cd=(\d+)&(?:amp;)?syurui=2"[^>]*>([\s\S]*?)<\/a>/gi;

  for (const match of html.matchAll(linkRegex)) {
    const meetingId = match[1]!;
    const rawTitle = match[2]!
      .replace(/<[^>]+>/g, "")
      .replace(/&nbsp;/g, " ")
      .replace(/&amp;/g, "&")
      .replace(/\s+/g, " ")
      .trim();

    if (!rawTitle) continue;

    // 重複チェック
    if (results.some((r) => r.meetingId === meetingId)) continue;

    const meetingUrl = `${BASE_ORIGIN}/motegi/nextpage.php?cd=${meetingId}&syurui=2`;
    results.push({ meetingId, title: rawTitle, meetingUrl });
  }

  return results;
}

/**
 * 会議別ページから PDF ダウンロードリンクを抽出する。
 * 対象: /motegi/download/{ファイルID}.pdf パターンのリンク
 */
export function parseMeetingPage(
  html: string
): { pdfUrl: string; pdfFileName: string; heldOn: string | null }[] {
  const results: { pdfUrl: string; pdfFileName: string; heldOn: string | null }[] = [];

  // /motegi/download/{ファイルID}.pdf パターンのリンクを抽出
  const linkRegex =
    /href="([^"]*\/motegi\/download\/[^"]+\.pdf)"[^>]*>([\s\S]*?)<\/a>/gi;

  for (const match of html.matchAll(linkRegex)) {
    const href = match[1]!;
    const linkText = match[2]!
      .replace(/<[^>]+>/g, "")
      .replace(/&nbsp;/g, " ")
      .replace(/\s+/g, " ")
      .trim();

    // 絶対 URL を構築
    let pdfUrl: string;
    if (href.startsWith("http")) {
      pdfUrl = href;
    } else if (href.startsWith("/")) {
      pdfUrl = `${BASE_ORIGIN}${href}`;
    } else {
      pdfUrl = `${BASE_ORIGIN}/${href}`;
    }

    // ファイル名を抽出
    const fileNameMatch = pdfUrl.match(/\/([^/]+\.pdf)$/i);
    const pdfFileName = fileNameMatch ? fileNameMatch[1]! : pdfUrl;

    // リンクテキストから開催日を抽出（令和X年X月X日 パターン）
    let heldOn: string | null = null;
    if (linkText) {
      heldOn = parseJapaneseDate(linkText);
    }

    // 重複チェック
    if (results.some((r) => r.pdfUrl === pdfUrl)) continue;

    results.push({ pdfUrl, pdfFileName, heldOn });
  }

  return results;
}

/**
 * 指定年の全 PDF リンクを取得する。
 */
export async function fetchDocumentList(year: number): Promise<MotegiMeeting[]> {
  // Step 1: トップページから会議別ページのリンクを取得
  const topHtml = await fetchPage(TOP_PAGE_URL);
  if (!topHtml) return [];

  const meetingLinks = parseTopPage(topHtml);
  if (meetingLinks.length === 0) return [];

  const results: MotegiMeeting[] = [];

  for (const { meetingId, title, meetingUrl } of meetingLinks) {
    // 年度フィルタリング: タイトルから年を抽出
    const titleYear = extractYearFromTitle(title);
    if (titleYear !== null && titleYear !== year) continue;

    // Step 2: 会議別ページから PDF リンクを収集
    const meetingHtml = await fetchPage(meetingUrl);
    if (!meetingHtml) continue;

    const pdfs = parseMeetingPage(meetingHtml);
    for (const pdf of pdfs) {
      results.push({
        pdfUrl: pdf.pdfUrl,
        title,
        heldOn: pdf.heldOn,
        meetingId,
        pdfFileName: pdf.pdfFileName,
      });
    }
  }

  return results;
}

/**
 * タイトルテキストから西暦年を抽出する。
 * e.g., "令和6年12月　定例会　会議録" → 2024
 *       "令和元年6月　定例会　会議録" → 2019
 *       "H24.3 定例会" → 2012
 *       年が不明な場合は null
 */
function extractYearFromTitle(title: string): number | null {
  // 全角数字を半角に変換
  const normalized = title.replace(/[０-９]/g, (c) =>
    String.fromCharCode(c.charCodeAt(0) - 0xfee0)
  );

  // 令和・平成パターン
  const warekiMatch = normalized.match(/(令和|平成)(元|\d+)年/);
  if (warekiMatch) {
    const [, era, eraYearStr] = warekiMatch;
    const eraYear = eraYearStr === "元" ? 1 : parseInt(eraYearStr!, 10);
    if (era === "令和") return eraYear + 2018;
    if (era === "平成") return eraYear + 1988;
  }

  // H24.3 形式の平成短縮表記
  const shortMatch = normalized.match(/H(\d+)\./);
  if (shortMatch) {
    const eraYear = parseInt(shortMatch[1]!, 10);
    return eraYear + 1988;
  }

  return null;
}

/** 会議タイプを検出（re-export のため共有関数を使用） */
export { detectMeetingType };
