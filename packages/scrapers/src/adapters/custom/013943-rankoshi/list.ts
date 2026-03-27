/**
 * 蘭越町議会 会議録 — list フェーズ
 *
 * 2 段階クロール:
 *   1. 一覧ページ (content=301) から年度別ページへのリンクを収集
 *   2. 各年度ページから会議種別・開催日・PDF URL を収集
 *
 * HTML 構造（一覧ページ）:
 *   <ul class="c-circleList">
 *     <li><a href="/administration/town/detail.html?content=867">令和８年　蘭越町議会会議録</a></li>
 *   </ul>
 *
 * HTML 構造（年度別ページ）:
 *   <div class="index_block _block cassette-item">
 *     <h1 class="c-secTtl">
 *       <span class="c-secTtl_label">令和６年蘭越町議会第４回定例会</span>
 *     </h1>
 *   </div>
 *   <div class="list_block _block cassette-item list02">
 *     <ul class="c-fileList">
 *       <li><a href="../../common/img/content/content_20250120_111334.pdf">１２月１２日　１日目(PDF／466KB)</a></li>
 *     </ul>
 *   </div>
 */

import { BASE_ORIGIN, LIST_PAGE_URL, eraToWesternYear, fetchPage, toHalfWidth } from "./shared";

export interface RankoshiMeeting {
  /** PDF の完全 URL */
  pdfUrl: string;
  /** 会議タイトル（例: "令和６年蘭越町議会第４回定例会"） */
  title: string;
  /** 開催日 YYYY-MM-DD または null（解析不能の場合） */
  heldOn: string | null;
  /** 西暦年（年度見出しから） */
  year: number;
}

/**
 * 一覧ページ HTML から年度別ページの URL を抽出する。
 * content=301 の ul.c-circleList 内の a[href] から収集する。
 *
 * @returns { contentId, year, url }[] の配列
 */
export function parseYearListPage(html: string): Array<{
  contentId: number;
  year: number;
  url: string;
}> {
  const results: Array<{ contentId: number; year: number; url: string }> = [];

  // ul.c-circleList 内の a タグを抽出
  const listMatch = html.match(/<ul[^>]*class="[^"]*c-circleList[^"]*"[^>]*>([\s\S]*?)<\/ul>/i);
  if (!listMatch) return results;

  const listContent = listMatch[1]!;
  const linkPattern = /<a[^>]+href="([^"]*detail\.html\?content=(\d+))"[^>]*>([\s\S]*?)<\/a>/gi;

  for (const match of listContent.matchAll(linkPattern)) {
    const href = match[1]!;
    const contentId = parseInt(match[2]!, 10);
    const linkText = match[3]!.replace(/<[^>]+>/g, "").trim();

    // 一覧ページ自身 (content=301) はスキップ
    if (contentId === 301) continue;

    const year = eraToWesternYear(linkText);
    if (!year) continue;

    const url = href.startsWith("http") ? href : `${BASE_ORIGIN}${href}`;
    results.push({ contentId, year, url });
  }

  return results;
}

/**
 * PDF リンクテキストから開催日を抽出する。
 *
 * パターン例:
 *   "１２月１２日　１日目(PDF／466KB)" → month=12, day=12
 *   "9月１７日　１日目(PDF／500KB)" → month=9, day=17
 */
export function parseDateFromLinkText(rawText: string, year: number): string | null {
  // 全角数字を半角に変換してからマッチ
  const normalized = toHalfWidth(rawText);
  const match = normalized.match(/(\d{1,2})月(\d{1,2})日/);
  if (!match) return null;

  const month = parseInt(match[1]!, 10);
  const day = parseInt(match[2]!, 10);

  if (month < 1 || month > 12 || day < 1 || day > 31) return null;

  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

/**
 * 年度別ページ HTML から会議録情報を抽出する。
 *
 * h1.c-secTtl span.c-secTtl_label から会議種別（タイトル）を取得し、
 * 直後の ul.c-fileList 内の PDF リンクと紐付ける。
 *
 * フォールバック: CSS クラスセレクターで結果が 0 件の場合、
 * 令和3年など旧ページで使われる plain <h2> + <ul> 構造を解析する。
 */
export function parseYearPage(html: string, pageYear: number): RankoshiMeeting[] {
  const results: RankoshiMeeting[] = [];

  // h1.c-secTtl 見出しと ul.c-fileList リストを位置で紐付けるために
  // 見出しと PDF リンクを順番通りに抽出する

  // 見出しと PDF リスト の出現位置を取得
  const headingPattern =
    /<span[^>]*class="[^"]*c-secTtl_label[^"]*"[^>]*>([\s\S]*?)<\/span>/gi;
  const headings: { title: string; position: number; year: number }[] = [];
  let hm: RegExpExecArray | null;
  while ((hm = headingPattern.exec(html)) !== null) {
    const rawTitle = hm[1]!.replace(/<[^>]+>/g, "").trim();
    const titleYear = eraToWesternYear(rawTitle) ?? pageYear;
    headings.push({ title: rawTitle, position: hm.index, year: titleYear });
  }

  if (headings.length === 0) {
    // フォールバック: plain <h2> + <ul> 構造（令和3年など旧ページ）
    return parseYearPageFallback(html, pageYear);
  }

  // ul.c-fileList 内の PDF リンクを取得
  const fileListPattern = /<ul[^>]*class="[^"]*c-fileList[^"]*"[^>]*>([\s\S]*?)<\/ul>/gi;
  let fm: RegExpExecArray | null;
  while ((fm = fileListPattern.exec(html)) !== null) {
    const listPosition = fm.index;
    const listContent = fm[1]!;

    // このリストの直前の見出しを探す
    let currentHeading: (typeof headings)[0] | null = null;
    for (const h of headings) {
      if (h.position < listPosition) {
        currentHeading = h;
      }
    }
    if (!currentHeading) continue;

    // ul 内の a タグを抽出
    const linkPattern = /<a[^>]+href="([^"]*\.pdf)"[^>]*>([\s\S]*?)<\/a>/gi;
    let am: RegExpExecArray | null;
    while ((am = linkPattern.exec(listContent)) !== null) {
      const href = am[1]!;
      const linkText = am[2]!.replace(/<[^>]+>/g, "").trim();

      // 相対パスを絶対 URL に変換
      // "../../common/img/content/content_YYYYMMDD_HHmmss.pdf"
      // → "https://www.town.rankoshi.hokkaido.jp/common/img/content/content_YYYYMMDD_HHmmss.pdf"
      let pdfUrl: string;
      if (href.startsWith("http")) {
        pdfUrl = href;
      } else {
        // 相対パスを正規化: ../../ や ../ プレフィックスを除去して絶対パスに
        const normalizedHref = href.replace(/^(\.\.\/)+/, "/");
        pdfUrl = `${BASE_ORIGIN}${normalizedHref.startsWith("/") ? "" : "/"}${normalizedHref}`;
      }

      const heldOn = parseDateFromLinkText(linkText, currentHeading.year);

      results.push({
        pdfUrl,
        title: currentHeading.title,
        heldOn,
        year: currentHeading.year,
      });
    }
  }

  return results;
}

/**
 * フォールバック: plain <h2> + <ul> 構造のページを解析する。
 *
 * 令和3年など旧ページでは CSS クラスを持たない <h2> と <ul> が使われる:
 *   <h2>令和３年蘭越町議会第１回定例会</h2>
 *   <ul>
 *     <li><a href="...pdf">...</a></li>
 *   </ul>
 */
function parseYearPageFallback(html: string, pageYear: number): RankoshiMeeting[] {
  const results: RankoshiMeeting[] = [];

  // plain <h2> 見出しを収集
  const headingPattern = /<h2[^>]*>([\s\S]*?)<\/h2>/gi;
  const headings: { title: string; position: number; year: number }[] = [];
  let hm: RegExpExecArray | null;
  while ((hm = headingPattern.exec(html)) !== null) {
    const rawTitle = hm[1]!.replace(/<[^>]+>/g, "").trim();
    if (!rawTitle) continue;
    const titleYear = eraToWesternYear(rawTitle) ?? pageYear;
    headings.push({ title: rawTitle, position: hm.index, year: titleYear });
  }

  if (headings.length === 0) return results;

  // plain <ul> 内の PDF リンクを取得
  const ulPattern = /<ul[^>]*>([\s\S]*?)<\/ul>/gi;
  let fm: RegExpExecArray | null;
  while ((fm = ulPattern.exec(html)) !== null) {
    const listPosition = fm.index;
    const listContent = fm[1]!;

    // このリストの直前の見出しを探す
    let currentHeading: (typeof headings)[0] | null = null;
    for (const h of headings) {
      if (h.position < listPosition) {
        currentHeading = h;
      }
    }
    if (!currentHeading) continue;

    // ul 内の PDF a タグを抽出
    const linkPattern = /<a[^>]+href="([^"]*\.pdf)"[^>]*>([\s\S]*?)<\/a>/gi;
    let am: RegExpExecArray | null;
    while ((am = linkPattern.exec(listContent)) !== null) {
      const href = am[1]!;
      const linkText = am[2]!.replace(/<[^>]+>/g, "").trim();

      let pdfUrl: string;
      if (href.startsWith("http")) {
        pdfUrl = href;
      } else {
        const normalizedHref = href.replace(/^(\.\.\/)+/, "/");
        pdfUrl = `${BASE_ORIGIN}${normalizedHref.startsWith("/") ? "" : "/"}${normalizedHref}`;
      }

      const heldOn = parseDateFromLinkText(linkText, currentHeading.year);

      results.push({
        pdfUrl,
        title: currentHeading.title,
        heldOn,
        year: currentHeading.year,
      });
    }
  }

  return results;
}

/**
 * 指定年の全 PDF リンクを取得する。
 *
 * 1. 一覧ページから対象年の年度別ページ URL を取得
 * 2. 年度別ページから PDF リンクを収集
 */
export async function fetchMeetingList(year: number): Promise<RankoshiMeeting[]> {
  const listHtml = await fetchPage(LIST_PAGE_URL);
  if (!listHtml) return [];

  const yearPages = parseYearListPage(listHtml);

  // 対象年に対応するページを取得（西暦年が一致するもの）
  const targetPages = yearPages.filter((p) => p.year === year);
  if (targetPages.length === 0) return [];

  const allMeetings: RankoshiMeeting[] = [];

  for (const yearPage of targetPages) {
    const pageHtml = await fetchPage(yearPage.url);
    if (!pageHtml) continue;

    const meetings = parseYearPage(pageHtml, yearPage.year);

    // 対象年のみフィルタ（heldOn から西暦年を確認）
    const filtered = meetings.filter((m) => {
      if (!m.heldOn) return true; // heldOn が null でも含める（detail で処理）
      const meetingYear = parseInt(m.heldOn.slice(0, 4), 10);
      return meetingYear === year;
    });

    allMeetings.push(...filtered);
  }

  return allMeetings;
}
