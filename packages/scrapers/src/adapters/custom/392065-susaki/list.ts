/**
 * 須崎市議会 — list フェーズ
 *
 * 年度 × カテゴリの組み合わせで一覧ページを POST 取得し、
 * 詳細ページ（giji_dtl.php）の hdnID を収集する。
 *
 * ページ構造:
 *   <a href="./giji_dtl.php?hdnKatugi=3000&hdnID=489">
 *     第491回11月臨時会・第492回11月臨時会・第493回12月定例会
 *   </a>
 */

import { BASE_URL, BASE_ORIGIN, CATEGORIES, YEAR_LIST, fetchListPage, type Category } from "./shared";

export interface SusakiListItem {
  /** 詳細ページの hdnID */
  hdnId: string;
  /** カテゴリコード（3000=本会議, 4000=委員会） */
  category: Category;
  /** 会議名（リンクテキスト） */
  meetingName: string;
  /** 詳細ページ URL */
  detailUrl: string;
}

/**
 * 一覧ページの HTML から詳細ページへのリンクを抽出する（テスト可能な純粋関数）。
 *
 * 対象: `./giji_dtl.php?hdnKatugi={category}&hdnID={id}` 形式のリンク
 */
export function parseListPage(html: string, category: Category): SusakiListItem[] {
  const results: SusakiListItem[] = [];
  const seen = new Set<string>();

  // giji_dtl.php リンクを検出
  const linkPattern =
    /<a[^>]+href="([^"]*giji_dtl\.php\?hdnKatugi=(\d+)&(?:amp;)?hdnID=(\d+))"[^>]*>([\s\S]*?)<\/a>/gi;

  for (const match of html.matchAll(linkPattern)) {
    const href = match[1]!.replace(/&amp;/g, "&");
    const hdnKatugi = match[2]!;
    const hdnId = match[3]!;
    const innerHtml = match[4]!;

    // カテゴリが一致するものだけ取得
    if (hdnKatugi !== category) continue;

    // 重複排除
    if (seen.has(hdnId)) continue;
    seen.add(hdnId);

    // リンクテキストを整形（HTML タグ除去・空白正規化）
    const meetingName = innerHtml
      .replace(/<[^>]+>/g, "")
      .replace(/&nbsp;/g, " ")
      .replace(/&amp;/g, "&")
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">")
      .replace(/[\s　]+/g, " ")
      .trim();

    // 詳細ページ URL を絶対 URL に変換
    let detailUrl: string;
    if (href.startsWith("http")) {
      detailUrl = href;
    } else if (href.startsWith("/")) {
      detailUrl = `${BASE_ORIGIN}${href}`;
    } else {
      // ./giji_dtl.php → https://www.city.susaki.lg.jp/gijiroku/giji_dtl.php
      const normalized = href.replace(/^\.\//, "");
      detailUrl = `${BASE_URL}/${normalized}`;
    }

    results.push({
      hdnId,
      category,
      meetingName,
      detailUrl,
    });
  }

  return results;
}

/**
 * 指定年の全カテゴリから会議一覧を取得する。
 *
 * POST リクエストで年度切り替えを行い、giji_dtl.php リンクを収集する。
 */
export async function fetchMeetingList(year: number): Promise<SusakiListItem[]> {
  const yearEntry = YEAR_LIST.find((y) => y.westernYear === year);
  if (!yearEntry) return [];

  const allItems: SusakiListItem[] = [];

  for (const category of CATEGORIES) {
    const html = await fetchListPage(category, yearEntry.gengou, yearEntry.year);
    if (!html) continue;

    const items = parseListPage(html, category);
    allItems.push(...items);
  }

  return allItems;
}
