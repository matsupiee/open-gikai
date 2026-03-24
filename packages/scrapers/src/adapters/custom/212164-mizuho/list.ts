/**
 * 瑞穂市議会 -- list フェーズ
 *
 * 年度ページ → 会議ページ → PDF リンクの 3 段階クロールを行う。
 *
 * 構造:
 *   年度ページ（例: /13295.htm）
 *     → 会議ページへのリンク（例: /13611.htm「第４回定例会（11月28日〜12月20日）」）
 *       → PDF リンク（例: /secure/{数字}/{ファイル名}.pdf）
 *
 * 注意:
 *   - 「目次」PDF は本文を含まないためスキップする
 *   - リクエスト間に 1 秒の待機を入れる
 */

import {
  BASE_ORIGIN,
  YEAR_PAGE_MAP,
  detectMeetingType,
  extractDateFromText,
  fetchPage,
  toHalfWidth,
} from "./shared";

export interface MizuhoPdfLink {
  /** PDF タイトル（例: "初日（11月28日）"） */
  title: string;
  /** PDF の絶対 URL */
  pdfUrl: string;
  /** 会議種別 */
  meetingType: string;
  /** 開催日 (YYYY-MM-DD) — リンクテキストから取得。取得不可の場合は null */
  heldOn: string | null;
  /** 所属する定例会/臨時会の見出し（例: "第4回定例会"） */
  sessionTitle: string;
}

/**
 * href を絶対 URL に変換する。
 */
export function resolveUrl(href: string): string {
  if (href.startsWith("http")) return href;
  return `${BASE_ORIGIN}${href.startsWith("/") ? "" : "/"}${href}`;
}

/**
 * リンクテキストを正規化する（全角数字変換・余分な空白除去）。
 */
export function normalizeLinkText(text: string): string {
  return toHalfWidth(text.replace(/\s+/g, " ").trim());
}

/**
 * 年度ページの HTML をパースして、会議ページへのリンクを収集する。
 * <a href="/XXXXX.htm"> 形式のリンクで「定例会」「臨時会」を含むものを収集する。
 */
export function parseYearPage(html: string): {
  url: string;
  sessionTitle: string;
  meetingType: string;
}[] {
  const sessions: { url: string; sessionTitle: string; meetingType: string }[] =
    [];

  // /XXXXX.htm 形式のリンクを収集（定例会・臨時会を含むリンクテキスト）
  const linkPattern =
    /<a\s[^>]*href="(\/\d+\.htm)"[^>]*>([\s\S]*?)<\/a>/gi;
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

    const sessionTitle = extractSessionTitle(linkText);
    const meetingType = detectMeetingType(linkText);

    sessions.push({
      url: resolveUrl(href),
      sessionTitle,
      meetingType,
    });
  }

  return sessions;
}

/**
 * 見出しテキストからセッションタイトルを抽出する。
 * 「第４回定例会（11月28日〜12月20日）」→「第4回定例会」
 */
export function extractSessionTitle(heading: string): string {
  const normalized = toHalfWidth(heading.trim());
  const match = normalized.match(/^(第\d+回(?:定例会|臨時会))/);
  return match ? match[1]! : normalized;
}

/**
 * 会議ページの HTML をパースして PDF リンクを収集する。
 * /secure/.../*.pdf 形式のリンクを収集する。
 * 「目次」を含むリンクテキストはスキップする。
 */
export function parseSessionPage(
  html: string,
  sessionTitle: string,
  meetingType: string,
): MizuhoPdfLink[] {
  const results: MizuhoPdfLink[] = [];

  // /secure/.../*.pdf 形式の PDF リンクを収集
  const pdfPattern =
    /<a\s[^>]*href="(\/secure\/[^"]+\.pdf)"[^>]*>([\s\S]*?)<\/a>/gi;
  let pm: RegExpExecArray | null;
  while ((pm = pdfPattern.exec(html)) !== null) {
    const href = pm[1]!;
    const linkText = pm[2]!.replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim();
    const title = normalizeLinkText(linkText);

    // 目次 PDF はスキップ
    if (title.includes("目次")) continue;
    if (!title) continue;

    const pdfUrl = resolveUrl(href);
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
 * 年度ページ → 会議ページの 2 段階でクロールする。
 */
export async function fetchDocumentList(
  year: number,
): Promise<MizuhoPdfLink[]> {
  const pageUrl = YEAR_PAGE_MAP[year];
  if (!pageUrl) return [];

  const html = await fetchPage(pageUrl);
  if (!html) return [];

  const sessions = parseYearPage(html);
  const allLinks: MizuhoPdfLink[] = [];

  for (let i = 0; i < sessions.length; i++) {
    const { url, sessionTitle, meetingType } = sessions[i]!;
    const sessionHtml = await fetchPage(url);
    if (sessionHtml) {
      const links = parseSessionPage(sessionHtml, sessionTitle, meetingType);
      allLinks.push(...links);
    }
    if (i < sessions.length - 1) {
      await new Promise((r) => setTimeout(r, 1000));
    }
  }

  return allLinks;
}
