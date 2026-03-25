/**
 * 田子町議会 — list フェーズ
 *
 * 2段階で PDF リンクを収集する:
 * 1. 一覧ページ (/index.cfm/13,0,45,190,html) から年度別ページの URL を取得
 * 2. 年度別ページから h3 セクション（定例会/臨時会）ごとに PDF リンクを抽出
 *
 * HTML 構造:
 *   一覧ページ: div#page_body ul li > a[href="/index.cfm/13,{ID},45,190,html"]
 *   年度別ページ: h3 で会議区分 → ul li > a[href="/_resources/content/...pdf"]
 */

import { BASE_ORIGIN, LIST_URL, fetchPage, parseEraYear } from "./shared";

export interface TakkoMeeting {
  pdfUrl: string;
  title: string;
  year: number;
  meetingSection: string;
}

/**
 * 一覧ページから年度別ページのリンクを抽出する（テスト可能な純粋関数）。
 *
 * HTML 構造:
 *   <ul>
 *     <li><a href="/index.cfm/13,13166,45,190,html">議案審議結果一覧（令和8年分）</a></li>
 *     <li><a href="/index.cfm/13,11939,45,190,html">議案審議結果一覧（令和7年分）</a></li>
 *   </ul>
 */
export function parseIndexPage(
  html: string
): { label: string; url: string }[] {
  const results: { label: string; url: string }[] = [];
  const seen = new Set<string>();

  // ColdFusion CMS の年度別ページへのリンクを取得
  // パターン: /index.cfm/13,{ID},45,190,html
  const linkRegex =
    /<a[^>]+href="(\/index\.cfm\/13,\d+,45,190,html)"[^>]*>([\s\S]*?)<\/a>/gi;

  for (const match of html.matchAll(linkRegex)) {
    const href = match[1]!;
    const label = match[2]!.replace(/<[^>]+>/g, "").trim();

    // 「議案審議結果一覧」を含むリンクのみ対象
    if (!label.includes("議案審議結果一覧")) continue;

    const url = `${BASE_ORIGIN}${href}`;

    if (seen.has(url)) continue;
    seen.add(url);

    results.push({ label, url });
  }

  return results;
}

/**
 * 年度別ページから PDF リンクを抽出する（テスト可能な純粋関数）。
 *
 * HTML 構造:
 *   <div id="page_body">
 *     <h3>〇定例会</h3>
 *     <ul>
 *       <li><a href="/_resources/content/{ID}/{タイムスタンプ}.pdf">第１回定例会</a></li>
 *     </ul>
 *     <h3>〇臨時会</h3>
 *     <ul>
 *       <li><a href="/_resources/content/{ID}/{タイムスタンプ}.pdf">第１回臨時会</a></li>
 *     </ul>
 *   </div>
 */
export function parseYearPage(html: string, year: number): TakkoMeeting[] {
  const results: TakkoMeeting[] = [];

  // h3 タグで区切られたセクションを解析
  // h3 からの内容を取得
  const sectionRegex =
    /<h3[^>]*>([\s\S]*?)<\/h3>([\s\S]*?)(?=<h3|<\/div>|$)/gi;

  for (const sectionMatch of html.matchAll(sectionRegex)) {
    const sectionTitle = sectionMatch[1]!.replace(/<[^>]+>/g, "").trim();
    const sectionContent = sectionMatch[2]!;

    // 定例会または臨時会のみ対象
    if (!sectionTitle.includes("定例会") && !sectionTitle.includes("臨時会"))
      continue;

    // PDF リンクを抽出
    const linkRegex =
      /<a[^>]+href="(\/_resources\/content\/[^"]+\.pdf[^"]*)"[^>]*>([\s\S]*?)<\/a>/gi;

    for (const linkMatch of sectionContent.matchAll(linkRegex)) {
      const href = linkMatch[1]!.trim().replace(/[\s　]+$/, "");
      const linkText = linkMatch[2]!.replace(/<[^>]+>/g, "").trim();

      if (!linkText) continue;

      const pdfUrl = `${BASE_ORIGIN}${href}`;
      const title = `${linkText}`;

      results.push({
        pdfUrl,
        title,
        year,
        meetingSection: sectionTitle,
      });
    }
  }

  return results;
}

/**
 * 指定年の会議録一覧を取得する。
 */
export async function fetchMeetingList(
  _baseUrl: string,
  year: number
): Promise<TakkoMeeting[]> {
  // 固定の LIST_URL を使用する
  const indexHtml = await fetchPage(LIST_URL);
  if (!indexHtml) return [];

  const yearPages = parseIndexPage(indexHtml);

  // 対象年度のラベルを探す（令和N年 or 平成N年）
  const targetPage = yearPages.find((p) => {
    const pageYear = parseEraYear(p.label);
    return pageYear === year;
  });

  if (!targetPage) return [];

  const yearHtml = await fetchPage(targetPage.url);
  if (!yearHtml) return [];

  return parseYearPage(yearHtml, year);
}
