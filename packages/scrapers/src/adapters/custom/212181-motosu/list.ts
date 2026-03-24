/**
 * 本巣市議会 -- list フェーズ
 *
 * 年度カテゴリページ → 会議録詳細ページ → PDF リンクの 3 段階クロールを行う。
 *
 * 構造:
 *   年度カテゴリページ（例: /category/6-3-21-0-0-0-0-0-0-0.html）
 *     → 会議録詳細ページへのリンク（例: /1234567.html）
 *       → PDF リンク（例: ./cmsfiles/contents/{上位ID}/{7桁ID}/{ファイル名}.pdf）
 *
 * 注意:
 *   - リンクテキストが「N月N日（曜日）」形式のものだけを本文 PDF として収集する
 *   - 「付された案件」等のリンクテキストは除外する
 *   - リクエスト間に 1 秒の待機を入れる
 */

import {
  BASE_ORIGIN,
  YEAR_ID_MAP,
  detectMeetingType,
  extractDateFromText,
  fetchPage,
  toHalfWidth,
} from "./shared";

export interface MotosuPdfLink {
  /** PDF タイトル（例: "11月25日（月曜日）"） */
  title: string;
  /** PDF の絶対 URL */
  pdfUrl: string;
  /** 会議種別 */
  meetingType: string;
  /** 開催日 (YYYY-MM-DD) — リンクテキストから取得。取得不可の場合は null */
  heldOn: string | null;
  /** 所属する定例会/臨時会の見出し（例: "令和6年第4回定例会会議録"） */
  sessionTitle: string;
}

/**
 * href を絶対 URL に変換する。
 */
export function resolveUrl(href: string, baseUrl?: string): string {
  if (href.startsWith("http")) return href;
  if (href.startsWith("./")) {
    const base = baseUrl ?? BASE_ORIGIN;
    return `${base}/${href.slice(2)}`;
  }
  return `${BASE_ORIGIN}${href.startsWith("/") ? "" : "/"}${href}`;
}

/**
 * リンクテキストを正規化する（全角数字変換・余分な空白除去）。
 */
export function normalizeLinkText(text: string): string {
  return toHalfWidth(text.replace(/\s+/g, " ").trim());
}

/**
 * リンクテキストが会議録本文 PDF かどうか判定する。
 * 「N月N日（曜日）」形式のものが本文 PDF。
 * 「付された案件」「議案」等は除外する。
 */
export function isContentPdfLink(text: string): boolean {
  const normalized = normalizeLinkText(text);
  // 「N月N日（曜日 or 曜日略記）」パターンに一致するものを本文として判定
  // 例: 「11月25日（月）」「3月5日（水曜日）」
  if (/\d+月\d+日（.{1,4}）/.test(normalized)) return true;
  return false;
}

/**
 * 年度カテゴリページの HTML をパースして、会議録詳細ページへのリンクを収集する。
 */
export function parseCategoryPage(html: string): {
  url: string;
  sessionTitle: string;
  meetingType: string;
}[] {
  const sessions: { url: string; sessionTitle: string; meetingType: string }[] =
    [];

  // /{数字}.html 形式のリンクを収集（定例会・臨時会を含むリンクテキスト）
  const linkPattern =
    /<a\s[^>]*href="(https?:\/\/[^"]*\/\d+\.html|\/\d+\.html)"[^>]*>([\s\S]*?)<\/a>/gi;
  let lm: RegExpExecArray | null;
  while ((lm = linkPattern.exec(html)) !== null) {
    const href = lm[1]!;
    const linkText = toHalfWidth(
      lm[2]!.replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim(),
    );

    if (
      !linkText.includes("定例会") &&
      !linkText.includes("臨時会")
    )
      continue;

    const meetingType = detectMeetingType(linkText);

    sessions.push({
      url: resolveUrl(href),
      sessionTitle: linkText,
      meetingType,
    });
  }

  return sessions;
}

/**
 * 会議録詳細ページの HTML をパースして PDF リンクを収集する。
 * リンクテキストが「N月N日（曜日）」形式のものだけを収集する。
 */
export function parseDetailPage(
  html: string,
  sessionTitle: string,
  meetingType: string,
  detailPageUrl: string,
): MotosuPdfLink[] {
  const results: MotosuPdfLink[] = [];

  // ./cmsfiles/contents/{ID}/{ID}/{ファイル名}.pdf 形式のリンクを収集
  const pdfPattern =
    /<a\s[^>]*href="(\.[^"]+\.pdf)"[^>]*>([\s\S]*?)<\/a>/gi;
  let pm: RegExpExecArray | null;
  while ((pm = pdfPattern.exec(html)) !== null) {
    const href = pm[1]!;
    const rawText = pm[2]!.replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim();
    const title = normalizeLinkText(rawText);

    // 本文 PDF のみを収集
    if (!isContentPdfLink(title)) continue;
    if (!title) continue;

    // 詳細ページの URL をベースにして絶対 URL を構築
    const detailPageBase = detailPageUrl.replace(/\/[^/]+\.html$/, "");
    const pdfUrl = resolveUrl(href, detailPageBase);
    const heldOn = extractDateFromText(title);

    results.push({
      title,
      pdfUrl,
      meetingType,
      heldOn,
      sessionTitle,
    });
  }

  return results;
}

/**
 * 指定年の PDF リンクを収集する。
 * 年度カテゴリページ → 会議録詳細ページの 2 段階でクロールする。
 */
export async function fetchDocumentList(
  year: number,
): Promise<MotosuPdfLink[]> {
  const yearId = YEAR_ID_MAP[year];
  if (!yearId) return [];

  const categoryUrl = `${BASE_ORIGIN}/category/6-3-${yearId}-0-0-0-0-0-0-0.html`;
  const html = await fetchPage(categoryUrl);
  if (!html) return [];

  const sessions = parseCategoryPage(html);
  const allLinks: MotosuPdfLink[] = [];

  for (let i = 0; i < sessions.length; i++) {
    const { url, sessionTitle, meetingType } = sessions[i]!;
    const detailHtml = await fetchPage(url);
    if (detailHtml) {
      const links = parseDetailPage(detailHtml, sessionTitle, meetingType, url);
      allLinks.push(...links);
    }
    if (i < sessions.length - 1) {
      await new Promise((r) => setTimeout(r, 1000));
    }
  }

  return allLinks;
}
