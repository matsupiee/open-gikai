/**
 * 神津島村議会 — list フェーズ
 *
 * WordPress カテゴリ一覧ページ (/category/gikai/) を全ページ巡回し、
 * 「会議録」を含む投稿ページの URL・タイトル・年を収集する。
 *
 * HTML 構造:
 *   <h2 class="entry-title"><a href="https://www.vill.kouzushima.tokyo.jp/2024-1119/">
 *     神津島村議会定例会会議録(令和6年第3回)
 *   </a></h2>
 */

import { CATEGORY_BASE_URL, fetchPage, parseEraYear } from "./shared";

export interface KozushimaMeeting {
  /** 個別ページの URL */
  pageUrl: string;
  /** 投稿タイトル */
  title: string;
  /** 投稿タイトルから抽出した西暦年 */
  year: number;
}

/**
 * カテゴリ一覧ページの HTML から会議録リンクを抽出する（テスト可能な純粋関数）。
 *
 * タイトルに「会議録」を含む投稿のみ対象。
 */
export function parseListPage(html: string): KozushimaMeeting[] {
  const results: KozushimaMeeting[] = [];

  // <a href="...">タイトル</a> のパターンを抽出
  // WordPress のエントリータイトルリンクを対象とする
  const linkPattern =
    /<a[^>]+href="(https:\/\/www\.vill\.kouzushima\.tokyo\.jp\/\d{4}-\d{4}\/)"[^>]*>([\s\S]*?)<\/a>/gi;

  for (const match of html.matchAll(linkPattern)) {
    const pageUrl = match[1]!;
    const rawTitle = match[2]!
      .replace(/<[^>]+>/g, "")
      .replace(/&nbsp;/g, " ")
      .replace(/&amp;/g, "&")
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">")
      .replace(/&quot;/g, '"')
      .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(Number(code)))
      .replace(/\s+/g, " ")
      .trim();

    if (!rawTitle.includes("会議録")) continue;

    const year = parseEraYear(rawTitle);
    if (!year) continue;

    // 重複チェック
    if (results.some((r) => r.pageUrl === pageUrl)) continue;

    results.push({ pageUrl, title: rawTitle, year });
  }

  return results;
}

/**
 * カテゴリ一覧ページに次のページが存在するか確認する。
 */
export function hasNextPage(html: string): boolean {
  // WordPress のページネーション: rel="next" リンクの存在確認
  return /<a[^>]+rel="next"[^>]*>/.test(html) ||
    /class="[^"]*next[^"]*"/.test(html) ||
    /<a[^>]+href="[^"]+\/page\/\d+\/"[^>]*>/.test(html);
}

/**
 * 指定年の会議録一覧を取得する。
 * カテゴリ一覧を全ページ巡回し、指定年に該当する会議録のみ返す。
 */
export async function fetchMeetingList(
  year: number
): Promise<KozushimaMeeting[]> {
  const allMeetings: KozushimaMeeting[] = [];
  let page = 1;
  let foundOlderYear = false;

  while (!foundOlderYear) {
    const url =
      page === 1
        ? CATEGORY_BASE_URL
        : `${CATEGORY_BASE_URL}page/${page}/`;

    const html = await fetchPage(url);
    if (!html) break;

    const meetings = parseListPage(html);
    if (meetings.length === 0) break;

    for (const m of meetings) {
      if (m.year === year) {
        if (!allMeetings.some((existing) => existing.pageUrl === m.pageUrl)) {
          allMeetings.push(m);
        }
      } else if (m.year < year) {
        // 年降順なので、対象年より古い年が出たら終了
        foundOlderYear = true;
      }
    }

    if (!hasNextPage(html)) break;
    page++;
  }

  return allMeetings;
}
