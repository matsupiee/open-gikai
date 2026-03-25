/**
 * 諸塚村議会 — list フェーズ
 *
 * 2つの一覧ページから議会だより PDF リンクを収集する:
 * 1. 最新号ページ: https://www.vill.morotsuka.miyazaki.jp/sonsei/gikai/908.html
 * 2. 過去号一覧ページ: https://www.vill.morotsuka.miyazaki.jp/soshiki/1008/1/166.html
 *
 * 各ページの <a> タグから `/material/files/group/9/` を含む PDF リンクを抽出する。
 * リンクテキストから号数（No.XXX）と発行年月を対応付ける。
 *
 * 発行頻度: 年4回（1月・5月・8月・11月）
 */

import {
  BASE_ORIGIN,
  convertJapaneseEra,
  fetchPage,
} from "./shared";

/** 最新号ページ URL */
export const LATEST_URL = `${BASE_ORIGIN}/sonsei/gikai/908.html`;
/** 過去号一覧ページ URL */
export const ARCHIVE_URL = `${BASE_ORIGIN}/soshiki/1008/1/166.html`;

export interface MorotsukaMeeting {
  pdfUrl: string;
  title: string;
  /** 発行年: YYYY */
  year: number;
  /** 発行月: 1-12 */
  month: number;
}

/**
 * リンクテキストから発行年月を抽出する。
 *
 * 対応パターン:
 *   "2024諸塚村議会だより(11月号)No.183号"  ← 実際の形式（西暦年プレフィックス）
 *   "2024諸塚村議会だより（8月号）No.182"
 *   "議会だよりNo.187（令和7年1月号）"       ← 和暦パターン
 *   "議会だよりNo.153（2017年5月号）"        ← 西暦年月パターン
 */
export function parseLinkText(text: string): {
  issueNumber: number | null;
  year: number | null;
  month: number | null;
} {
  // 号数を抽出（No.XXX または No．XXX）
  const noMatch = text.match(/No[.．](\d+)/i);
  const issueNumber = noMatch ? parseInt(noMatch[1]!, 10) : null;

  // 和暦年月パターン: （令和7年1月号）
  const eraMatch = text.match(/(令和|平成|昭和)(元|\d+)年(\d+)月号/);
  if (eraMatch) {
    const year = convertJapaneseEra(eraMatch[1]!, eraMatch[2]!);
    const month = year ? parseInt(eraMatch[3]!, 10) : null;
    return { issueNumber, year: year ?? null, month };
  }

  // 西暦年月パターン: 2024年5月号 または 2024年(5月号)
  const westernFullMatch = text.match(/(\d{4})年(\d+)月号/);
  if (westernFullMatch) {
    const year = parseInt(westernFullMatch[1]!, 10);
    const month = parseInt(westernFullMatch[2]!, 10);
    return { issueNumber, year, month };
  }

  // 西暦年プレフィックス + (月号) パターン: "2024諸塚村議会だより(11月号)"
  // 先頭の4桁が西暦年、(N月号) または （N月号） が月
  const prefixYearMatch = text.match(/^(\d{4})[^\d]/);
  const monthInParenMatch = text.match(/[（(](\d+)月号[）)]/);
  if (prefixYearMatch && monthInParenMatch) {
    const year = parseInt(prefixYearMatch[1]!, 10);
    const month = parseInt(monthInParenMatch[1]!, 10);
    if (year >= 1990 && year <= 2100 && month >= 1 && month <= 12) {
      return { issueNumber, year, month };
    }
  }

  return { issueNumber, year: null, month: null };
}

/**
 * 一覧ページ HTML から議会だより PDF リンクを抽出する（テスト可能な純粋関数）。
 *
 * `/material/files/group/9/` を含む PDF リンクのみ対象とする。
 */
export function parseListPage(html: string): MorotsukaMeeting[] {
  const results: MorotsukaMeeting[] = [];
  const seen = new Set<string>();

  // <a href="...pdf">テキスト</a> パターンを抽出
  const linkRegex =
    /<a[^>]+href="([^"]*\/material\/files\/group\/9\/[^"]+\.pdf)"[^>]*>([\s\S]*?)<\/a>/gi;

  for (const match of html.matchAll(linkRegex)) {
    const href = match[1]!;
    const rawText = match[2]!.replace(/<[^>]+>/g, "").trim();

    if (!rawText) continue;

    // 重複チェック（同一 PDF リンクが複数ページにある場合）
    if (seen.has(href)) continue;
    seen.add(href);

    const { issueNumber, year, month } = parseLinkText(rawText);
    if (!year || !month) continue;

    // PDF の完全 URL を構築
    const pdfUrl = href.startsWith("http")
      ? href
      : href.startsWith("//")
        ? `https:${href}`
        : `${BASE_ORIGIN}${href.startsWith("/") ? "" : "/"}${href}`;

    const issueLabel = issueNumber !== null ? `No.${issueNumber}` : "";
    const title = `諸塚村議会だより${issueLabel}（${year}年${month}月号）`;

    results.push({
      pdfUrl,
      title,
      year,
      month,
    });
  }

  return results;
}

/**
 * 指定年の議会だより PDF リンク一覧を取得する。
 * 最新号ページと過去号一覧ページの両方を巡回する。
 */
export async function fetchDocumentList(
  year: number,
): Promise<MorotsukaMeeting[]> {
  const [latestHtml, archiveHtml] = await Promise.all([
    fetchPage(LATEST_URL),
    fetchPage(ARCHIVE_URL),
  ]);

  const allMeetings: MorotsukaMeeting[] = [];
  const seenUrls = new Set<string>();

  for (const html of [latestHtml, archiveHtml]) {
    if (!html) continue;
    for (const meeting of parseListPage(html)) {
      if (!seenUrls.has(meeting.pdfUrl)) {
        seenUrls.add(meeting.pdfUrl);
        allMeetings.push(meeting);
      }
    }
  }

  return allMeetings.filter((m) => m.year === year);
}
