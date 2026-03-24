/**
 * 御杖村議会 -- list フェーズ
 *
 * 単一ページから PDF リンクを収集する:
 * 1. 一覧ページ (336.html) から <a href="...pdf"> タグを全件取得
 * 2. リンクテキストに「会議録」を含むものを選別し「議決結果」を除外する
 * 3. href が //www... 形式（プロトコル相対 URL）の場合 https: を補完する
 *
 * 一覧ページ: https://www.vill.mitsue.nara.jp/kurashi/annai/gikaijimukyoku/1/1/336.html
 */

import {
  BASE_ORIGIN,
  LIST_PATH,
  eraToWesternYear,
  fetchPage,
  normalizeDigits,
} from "./shared";

export interface MitsueMeeting {
  pdfUrl: string;
  title: string;
  /** YYYY-MM-DD (PDF から抽出するため list 段階では null の場合あり) */
  heldOn: string | null;
}

/**
 * 一覧ページの HTML から会議録 PDF リンクを抽出する（テスト可能な純粋関数）。
 *
 * HTML 構造例:
 *   <li><a href="//www.vill.mitsue.nara.jp/material/files/group/1/R5-3kaigiroku.pdf">
 *     令和5年第1回定例会会議録
 *   </a></li>
 *
 * - href は //www... 形式（プロトコル相対 URL）
 * - リンクテキストに「議決結果」を含むものは除外する
 * - リンクテキストに「会議録」を含むものを対象とする
 */
export function parseListPage(html: string): MitsueMeeting[] {
  const results: MitsueMeeting[] = [];

  // <a href="...pdf"...>テキスト</a> を抽出
  const linkPattern = /<a[^>]+href="([^"]+\.pdf)"[^>]*>([\s\S]*?)<\/a>/gi;

  for (const match of html.matchAll(linkPattern)) {
    const rawHref = match[1]!;
    const rawText = match[2]!.replace(/<[^>]+>/g, "").trim();

    // 議決結果は除外
    if (rawText.includes("議決結果")) continue;

    // 会議録のみ対象
    if (!rawText.includes("会議録")) continue;

    // プロトコル相対 URL を正規化
    const url = rawHref.startsWith("//")
      ? `https:${rawHref}`
      : rawHref.startsWith("/")
        ? `${BASE_ORIGIN}${rawHref}`
        : rawHref;

    results.push({ pdfUrl: url, title: rawText, heldOn: null });
  }

  return results;
}

/**
 * 指定年の会議録 PDF リンク一覧を取得する。
 * 一覧ページは単一ページ（ページネーションなし）で全件掲載されている。
 * heldOn は PDF 本文から抽出するため、ここでは null のまま返す。
 */
export async function fetchDocumentList(
  _baseUrl: string,
  year: number
): Promise<MitsueMeeting[]> {
  const listUrl = `${BASE_ORIGIN}${LIST_PATH}`;
  const html = await fetchPage(listUrl);
  if (!html) return [];

  const all = parseListPage(html);

  // 年度フィルタリング: タイトルの和暦から西暦に変換して絞り込む
  // 例: "令和5年第1回定例会会議録" → 2023年
  // 全角数字にも対応: "令和６年第４回（１２月）定例会"
  // 平成29年 (2017年) ~ 令和8年 (2026年) が対象
  const filtered = all.filter((m) => {
    const normalized = normalizeDigits(m.title);
    const eraMatch = normalized.match(/(令和|平成|昭和)(元|\d+)年/);
    if (!eraMatch) return false;
    const westernYear = eraToWesternYear(eraMatch[0]);
    return westernYear === year;
  });

  return filtered;
}
