/**
 * 玖珠町議会 — list フェーズ
 *
 * 年度別一覧ページから議事録詳細ページへのリンクを取得し、
 * 詳細ページから PDF URL を収集する。
 *
 * ## フロー
 * 1. 年度 → ページ ID のマッピング（YEAR_PAGE_IDS）から対象年のページ ID を特定
 * 2. 年度別一覧ページ（/choseijoho/kusuchogikai/1/{pageId}.html）を取得し、
 *    議事録詳細ページ（/soshiki/gikaijimukyoku/...）へのリンクを抽出
 * 3. 詳細ページから h3 セクションヘッダー + PDF リンクを収集
 * 4. 各 PDF リンクについてタイトル・日付・会議種別を解析して返す
 */

import {
  BASE_ORIGIN,
  YEAR_PAGE_IDS,
  buildYearPageUrl,
  detectMeetingType,
  fetchPage,
  parseWarekiYear,
  delay,
} from "./shared";

export interface KusuSessionInfo {
  /** 会議タイトル（例: "令和6年第4回定例会 開会（11月29日）"） */
  title: string;
  /** 開催日 YYYY-MM-DD（解析できない場合は null） */
  heldOn: string | null;
  /** PDF の絶対 URL */
  pdfUrl: string;
  /** 会議種別 */
  meetingType: "plenary" | "extraordinary" | "committee";
  /** 詳細ページの URL（externalId 生成用） */
  detailPageUrl: string;
}

const INTER_REQUEST_DELAY_MS = 1500;

/**
 * 年度別一覧ページ HTML から議事録詳細ページへのリンクを抽出する。
 * `<a href="...">` タグ内の `/soshiki/gikaijimukyoku/` を含むリンクのみを対象とする。
 */
export function parseDetailPageLink(html: string): string | null {
  // <a href="..." または <a href='...' で始まるタグ内の soshiki/gikaijimukyoku/ パスを探す
  const m = html.match(
    /<a\s[^>]*href=["']([^"']*\/soshiki\/gikaijimukyoku\/[^"']+\.html)["'][^>]*>/,
  );
  if (!m?.[1]) return null;
  const href = m[1];
  if (href.startsWith("http")) return href;
  return `${BASE_ORIGIN}${href}`;
}

/**
 * 詳細ページの HTML から PDF リンク一覧を抽出する。
 * h3 セクションヘッダーを辿って会議名・日付を解析する。
 */
export function parsePdfLinksFromDetail(
  html: string,
  detailPageUrl: string,
): KusuSessionInfo[] {
  const results: KusuSessionInfo[] = [];

  // h3 タグとそれに続くコンテンツを分割して処理する
  // セクションを抽出: <h3>...</h3> から次の <h3> または終端まで
  const sectionRegex = /<h3[^>]*>([\s\S]*?)<\/h3>([\s\S]*?)(?=<h3|$)/gi;

  for (const sectionMatch of html.matchAll(sectionRegex)) {
    const rawHeading = sectionMatch[1] ?? "";
    const sectionBody = sectionMatch[2] ?? "";

    // HTML タグを除去してプレーンテキストにする
    const heading = rawHeading
      .replace(/<[^>]+>/g, "")
      .replace(/&nbsp;/g, " ")
      .replace(/&amp;/g, "&")
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">")
      .trim();

    if (!heading) continue;

    // セクションヘッダーから年度・定例会番号・会議種別を解析する
    // 例: "令和6年第4回定例会（令和6年11月29日～12月17日）"
    const sectionInfo = parseSectionHeading(heading);
    if (!sectionInfo) continue;

    // セクション内の PDF リンクを収集する
    const pdfPattern =
      /<a\s[^>]*href=["']([^"']*\.pdf)["'][^>]*>([\s\S]*?)<\/a>/gi;
    for (const pdfMatch of sectionBody.matchAll(pdfPattern)) {
      const rawHref = pdfMatch[1] ?? "";
      const rawText = pdfMatch[2] ?? "";

      if (!rawHref) continue;

      // 絶対 URL に変換（// で始まる場合は https: を付与）
      let pdfUrl: string;
      if (rawHref.startsWith("//")) {
        pdfUrl = `https:${rawHref}`;
      } else if (rawHref.startsWith("http")) {
        pdfUrl = rawHref;
      } else {
        pdfUrl = `${BASE_ORIGIN}${rawHref}`;
      }

      // リンクテキストからHTML除去
      const linkText = rawText
        .replace(/<[^>]+>/g, "")
        .replace(/&nbsp;/g, " ")
        .replace(/\(PDF[^)]*\)/g, "")
        .replace(/（PDF[^）]*）/g, "")
        .trim();

      if (!linkText) continue;

      // 一般質問表はスキップ（発言データを含まず、日付が取れない）
      // ※ 実際には日付なしでスキップするのではなく、日付を null で入れる
      const heldOn = extractDateFromLinkText(linkText, sectionInfo.year);

      const title = `${sectionInfo.sectionTitle} ${linkText}`;

      results.push({
        title,
        heldOn,
        pdfUrl,
        meetingType: sectionInfo.meetingType,
        detailPageUrl,
      });
    }
  }

  return results;
}

interface SectionInfo {
  /** 元のセクションヘッダーテキスト */
  sectionTitle: string;
  /** 西暦年 */
  year: number;
  /** 開始月（月が判明している場合、日付補完に使用） */
  month: number | null;
  /** 会議種別 */
  meetingType: "plenary" | "extraordinary" | "committee";
}

/**
 * h3 セクションヘッダーを解析してメタ情報を返す。
 * 例:
 * - "令和6年第4回定例会（令和6年11月29日～12月17日）"
 * - "令和6年第1回臨時会（令和6年1月25日）"
 * 解析できない場合は null を返す。
 */
export function parseSectionHeading(heading: string): SectionInfo | null {
  // 年号と年を取得
  const eraMatch = heading.match(/(令和|平成|昭和)(元|\d+)年/);
  if (!eraMatch) return null;

  const westernYear = parseWarekiYear(eraMatch[1]!, eraMatch[2]!);
  if (westernYear === null) return null;

  const meetingType = detectMeetingType(heading);

  // 開始月を取得（括弧内の日付範囲から: 例 "11月29日～12月17日" → 11月）
  let month: number | null = null;
  const dateRangeMatch = heading.match(/[（(](令和|平成|昭和)?[^（()]*?(\d{1,2})月\d{1,2}日/);
  if (dateRangeMatch?.[2]) {
    month = parseInt(dateRangeMatch[2], 10);
  }

  return {
    sectionTitle: heading,
    year: westernYear,
    month,
    meetingType,
  };
}

/**
 * リンクテキストから開催日 YYYY-MM-DD を抽出する。
 * 例:
 * - "開会（11月29日）" + year=2024 → "2024-11-29"
 * - "一般質問（12月5日）" + year=2024 → "2024-12-05"
 * - "一般質問表" （日付なし）→ null
 * 解析できない場合は null を返す。
 */
export function extractDateFromLinkText(
  linkText: string,
  year: number,
): string | null {
  // 括弧内の月日を取得: "（12月5日）" or "（12月5日・6日）"
  const m = linkText.match(/[（(](\d{1,2})月(\d{1,2})日/);
  if (!m) return null;

  const month = parseInt(m[1]!, 10);
  const day = parseInt(m[2]!, 10);

  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

/**
 * 指定年の会議一覧を取得する。
 */
export async function fetchSessionList(
  year: number,
): Promise<KusuSessionInfo[]> {
  // 対象年のページ ID を特定
  const entry = YEAR_PAGE_IDS.find((e) => e.year === year);
  if (!entry) return [];

  const yearPageUrl = buildYearPageUrl(entry.pageId);
  const yearPageHtml = await fetchPage(yearPageUrl);
  if (!yearPageHtml) {
    console.warn(`[444626-kusu] Failed to fetch year page: ${yearPageUrl}`);
    return [];
  }

  // 議事録詳細ページへのリンクを取得
  const detailPageUrl = parseDetailPageLink(yearPageHtml);
  if (!detailPageUrl) {
    console.warn(
      `[444626-kusu] No detail page link found in year page: ${yearPageUrl}`,
    );
    return [];
  }

  await delay(INTER_REQUEST_DELAY_MS);

  // 詳細ページを取得
  const detailPageHtml = await fetchPage(detailPageUrl);
  if (!detailPageHtml) {
    console.warn(
      `[444626-kusu] Failed to fetch detail page: ${detailPageUrl}`,
    );
    return [];
  }

  return parsePdfLinksFromDetail(detailPageHtml, detailPageUrl);
}
