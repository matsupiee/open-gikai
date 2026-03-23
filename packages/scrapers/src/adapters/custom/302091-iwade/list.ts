/**
 * 岩出市議会 会議録 — list フェーズ
 *
 * トップページから全定例会ページへのリンクを収集し、
 * 各定例会ページから全体版 PDF のリンクを抽出する。
 */

import { BASE_URL, fetchPage } from "./shared";

export interface IwadeSession {
  /** 定例会ページの URL */
  sessionUrl: string;
  /** 定例会タイトル（例: 「令和7年第1回定例会（3月議会）」） */
  sessionTitle: string;
  /** 全体版 PDF の URL */
  pdfUrl: string;
  /** 日程別 PDF の開催日文字列（ファイル名から取得。例: "R7.2.28"） */
  dateHint: string | null;
}

/**
 * トップページ HTML から定例会ページへのリンクを抽出する。
 *
 * @returns { href: string; text: string }[] のリスト
 */
export function parseTopPage(html: string): Array<{ href: string; text: string }> {
  const results: Array<{ href: string; text: string }> = [];
  // .html で終わるリンクを抽出
  const linkRegex = /<a[^>]+href="([^"]+\.html)"[^>]*>([^<]+)<\/a>/gi;
  for (const match of html.matchAll(linkRegex)) {
    const href = match[1]?.trim();
    const text = match[2]?.trim();
    if (!href || !text) continue;
    results.push({ href, text });
  }
  return results;
}

/**
 * 定例会ページ HTML から全体版 PDF のリンクを抽出する。
 *
 * 「全体分」を含むリンクテキストのみ対象。
 * リンク内に img タグが含まれる場合があるため、aタグ全体を取得して
 * テキストコンテンツを HTML タグ除去して確認する。
 */
export function parseSessionPage(html: string): string | null {
  // aタグ全体（href + 内部コンテンツ）を取得
  const linkRegex = /<a\s[^>]*href="([^"]+\.pdf)"[^>]*>([\s\S]*?)<\/a>/gi;
  for (const match of html.matchAll(linkRegex)) {
    const href = match[1]?.trim();
    const innerHtml = match[2] ?? "";
    if (!href) continue;

    // 内部 HTML からテキストを抽出（タグを除去）
    const text = innerHtml.replace(/<[^>]+>/g, "").trim();
    if (text.includes("全体分") || text.includes("全体")) {
      return href;
    }
  }
  return null;
}

/**
 * 指定年に該当する定例会セッションの一覧を取得する。
 */
export async function fetchSessionList(year: number): Promise<IwadeSession[]> {
  const html = await fetchPage(BASE_URL);
  if (!html) return [];

  const links = parseTopPage(html);
  const sessions: IwadeSession[] = [];

  for (const { href, text } of links) {
    // href は相対パス（例: "R7-1.html", "2024-0612-R6-1.html"）
    const sessionUrl = new URL(href, BASE_URL).toString();

    // リンクテキストから年を推定して絞り込む
    const sessionYear = estimateYear(text, href);
    if (sessionYear !== null && sessionYear !== year) continue;

    // 定例会ページから全体版 PDF リンクを取得
    const sessionHtml = await fetchPage(sessionUrl);
    if (!sessionHtml) continue;

    const pdfRelPath = parseSessionPage(sessionHtml);
    if (!pdfRelPath) continue;

    const pdfUrl = new URL(pdfRelPath, sessionUrl).toString();

    sessions.push({
      sessionUrl,
      sessionTitle: text,
      pdfUrl,
      dateHint: null,
    });
  }

  return sessions;
}

/**
 * リンクテキストまたは href から年を推定する。
 *
 * - 「令和7年」→ 2025
 * - 「令和6年」→ 2024
 * - 「令和元年」→ 2019
 * - 「平成31年」→ 2019
 * - href に "2024-" などの年が含まれる場合
 *
 * @returns 西暦年。推定不可の場合は null
 */
export function estimateYear(text: string, href: string): number | null {
  // リンクテキストから元号年を抽出
  const reiwaMatch = text.match(/令和(\d+|元)年/);
  if (reiwaMatch) {
    const n = reiwaMatch[1] === "元" ? 1 : parseInt(reiwaMatch[1] ?? "0", 10);
    return 2018 + n;
  }

  const heiseiMatch = text.match(/平成(\d+)年/);
  if (heiseiMatch) {
    const n = parseInt(heiseiMatch[1] ?? "0", 10);
    return 1988 + n;
  }

  // href から西暦年を抽出（例: "2024-0612-R6-1.html"）
  const hrefYearMatch = href.match(/^(\d{4})-/);
  if (hrefYearMatch) {
    return parseInt(hrefYearMatch[1] ?? "0", 10);
  }

  // href から元号を抽出（例: "R7-1.html", "R2-rinji2.html"）
  const reiwaHrefMatch = href.match(/[Rr](\d+)-/);
  if (reiwaHrefMatch) {
    const n = parseInt(reiwaHrefMatch[1] ?? "0", 10);
    return 2018 + n;
  }

  return null;
}
