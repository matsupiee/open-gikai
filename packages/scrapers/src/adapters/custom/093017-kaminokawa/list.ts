/**
 * 上三川町議会 — list フェーズ
 *
 * 3 段階で PDF リンクを収集する:
 * 1. トップページ (genre2-0-001.html) から年度別ジャンル ID を取得
 * 2. 年度別一覧ページ (genre3-0-001.html) から会議詳細ページ URL を収集
 * 3. 会議詳細ページ (info-{ページID}-0.html) のテーブルから日付と PDF URL を抽出
 *
 * PDF ファイル名はランダムハッシュ値のため、テーブルの「日にち」列から開催日を特定する。
 */

import {
  BASE_ORIGIN,
  TOP_PAGE_URL,
  YEAR_TO_GENRE_ID,
  fetchPage,
  parseJapaneseDate,
  parseMonthDay,
  parseWesternYear,
} from "./shared";

export interface KaminokawaMeeting {
  /** PDF の完全 URL */
  pdfUrl: string;
  /** 会議タイトル（例: "令和6(2024)年第6回議会定例会(12月)会議録"） */
  title: string;
  /** 開催日 YYYY-MM-DD */
  heldOn: string;
  /** 審議内容（テーブルの「審議内容」列） */
  description: string;
  /** 外部 ID 用ハッシュ（PDF ファイル名から） */
  pdfHash: string;
}

/**
 * トップページ (genre2-0-001.html) から年度別ジャンル ID を抽出する。
 * 対象: genre3-0-001.html へのリンクと、そのリンクが含まれる文脈の和暦テキスト
 *
 * li ブロック単位で解析し、各ブロック内の年度と genre3 リンクを紐づける。
 */
export function parseTopPage(html: string): { genreId: string; year: number }[] {
  const results: { genreId: string; year: number }[] = [];

  // li ブロック単位で genre3-0-001.html リンクと年度を対応付ける
  const liRegex = /<li[^>]*>([\s\S]*?)<\/li>/gi;
  for (const liMatch of html.matchAll(liRegex)) {
    const liContent = liMatch[1]!;

    const linkMatch = liContent.match(/href="\/(\d{4})\/genre3-0-001\.html"/);
    if (!linkMatch) continue;

    const genreId = linkMatch[1]!;
    const year = parseWesternYear(liContent);
    if (!year) continue;

    // 重複チェック
    if (results.some((r) => r.genreId === genreId)) continue;
    results.push({ genreId, year });
  }

  // li 内で見つからなかった場合は、リンク前後の近傍テキストから取得を試みる
  if (results.length === 0) {
    const linkRegex = /href="\/(\d{4})\/genre3-0-001\.html"/g;
    for (const match of html.matchAll(linkRegex)) {
      const genreId = match[1]!;
      if (results.some((r) => r.genreId === genreId)) continue;

      // リンク直前 100 文字以内から年度を取得
      const before = html.slice(Math.max(0, match.index! - 100), match.index!);
      const year = parseWesternYear(before);
      if (!year) continue;

      results.push({ genreId, year });
    }
  }

  return results;
}

/**
 * 年度別一覧ページ (genre3-0-001.html) から会議詳細ページへのリンクを抽出する。
 * 対象: info-{ページID}-0.html へのリンク
 */
export function parseYearlyListPage(
  html: string,
  _genreId: string
): { infoUrl: string; title: string }[] {
  const results: { infoUrl: string; title: string }[] = [];

  // info-{ページID}-0.html へのリンクを抽出
  // href パターン例: "../0361/info-0000003630-0.html" または "/0361/info-0000003630-0.html"
  const linkRegex =
    /href="([^"]*\/(\d{4})\/info-\d+-0\.html)"[^>]*>([\s\S]*?)<\/a>/g;

  for (const match of html.matchAll(linkRegex)) {
    const href = match[1]!;
    const rawTitle = match[3]!
      .replace(/<[^>]+>/g, "")
      .replace(/&nbsp;/g, " ")
      .replace(/&amp;/g, "&")
      .replace(/\s+/g, " ")
      .trim();

    if (!rawTitle) continue;

    // 会議録タイトルパターンにマッチするものだけ
    if (!rawTitle.includes("会議録")) continue;

    // 絶対 URL を構築
    let infoUrl: string;
    if (href.startsWith("http")) {
      infoUrl = href;
    } else if (href.startsWith("/")) {
      infoUrl = `${BASE_ORIGIN}${href}`;
    } else {
      // "../0361/info-..." のような相対パスを解決
      infoUrl = `${BASE_ORIGIN}/${href.replace(/^\.\.\//, "")}`;
    }

    // 重複チェック
    if (results.some((r) => r.infoUrl === infoUrl)) continue;
    results.push({ infoUrl, title: rawTitle });
  }

  return results;
}

/**
 * 会議詳細ページ (info-{ページID}-0.html) のテーブルから PDF リンクを抽出する。
 *
 * テーブル構造:
 * | 日にち | 曜日 | 審議内容 |
 * 「日にち」列に PDF へのリンクが含まれる。
 *
 * 「日にち」セルの日付テキストは "MM月DD日(pdf...)" 形式なので、
 * 会議タイトルから取得した西暦年と組み合わせて YYYY-MM-DD を生成する。
 * タイトルに年が含まれない場合は和暦テキストを直接パースする。
 */
export function parseInfoPage(
  html: string,
  title: string
): { pdfUrl: string; heldOn: string; description: string; pdfHash: string }[] {
  const results: {
    pdfUrl: string;
    heldOn: string;
    description: string;
    pdfHash: string;
  }[] = [];

  // タイトルから年を取得（例: "令和6(2024)年第6回..." → 2024）
  const titleYear = parseWesternYear(title);

  // テーブル行を抽出
  const rowRegex = /<tr[^>]*>([\s\S]*?)<\/tr>/gi;

  for (const rowMatch of html.matchAll(rowRegex)) {
    const rowContent = rowMatch[1]!;

    // PDF URL を含む行のみ対象
    // 実際の href 形式: "../manage/contents/upload/{hash}.pdf"
    const pdfMatch = rowContent.match(
      /href="([^"]*manage\/contents\/upload\/([a-f0-9]+)\.pdf)"/i
    );
    if (!pdfMatch) continue;

    const pdfPath = pdfMatch[1]!;
    const pdfHash = pdfMatch[2]!;

    // PDF URL を構築（相対パス "../../" や "/" を解決）
    let pdfUrl: string;
    if (pdfPath.startsWith("http")) {
      pdfUrl = pdfPath;
    } else if (pdfPath.startsWith("/")) {
      pdfUrl = `${BASE_ORIGIN}${pdfPath}`;
    } else {
      // "../manage/..." → BASE_ORIGIN + "/manage/..."
      pdfUrl = `${BASE_ORIGIN}/${pdfPath.replace(/^(\.\.\/)+/, "")}`;
    }

    // セル（td）を抽出
    const cells: string[] = [];
    const cellRegex = /<td[^>]*>([\s\S]*?)<\/td>/gi;
    for (const cellMatch of rowContent.matchAll(cellRegex)) {
      const cellText = cellMatch[1]!
        .replace(/<[^>]+>/g, "")
        .replace(/&nbsp;/g, " ")
        .replace(/&amp;/g, "&")
        .replace(/&lt;/g, "<")
        .replace(/&gt;/g, ">")
        .replace(/\s+/g, " ")
        .trim();
      cells.push(cellText);
    }

    // 「日にち」列（最初のセル）から開催日を抽出
    const dateText = cells[0] ?? "";

    // まず和暦の完全な日付（令和X年MM月DD日）を試みる
    let heldOn = parseJapaneseDate(dateText);

    // 月日のみ（MM月DD日）の場合はタイトルの年を使う
    if (!heldOn && titleYear) {
      heldOn = parseMonthDay(dateText, titleYear);
    }

    if (!heldOn) continue;

    // 「審議内容」列（3番目のセル）
    const description = cells[2] ?? cells[1] ?? "";

    results.push({ pdfUrl, heldOn, description, pdfHash });
  }

  return results;
}

/**
 * 指定年の全 PDF リンクを取得する。
 * YEAR_TO_GENRE_ID の対応表を使い、対象年のジャンル ID を特定する。
 */
export async function fetchMeetingList(
  year: number
): Promise<KaminokawaMeeting[]> {
  // Step 1: トップページからジャンル ID の対応表を動的に取得（フォールバックは固定値）
  const genreId = await resolveGenreId(year);
  if (!genreId) return [];

  // Step 2: 年度別一覧ページから会議詳細ページの URL を収集
  const yearlyUrl = `${BASE_ORIGIN}/${genreId}/genre3-0-001.html`;
  const yearlyHtml = await fetchPage(yearlyUrl);
  if (!yearlyHtml) return [];

  const meetingLinks = parseYearlyListPage(yearlyHtml, genreId);
  if (meetingLinks.length === 0) return [];

  // Step 3: 各会議詳細ページから PDF URL を収集
  const results: KaminokawaMeeting[] = [];

  for (const { infoUrl, title } of meetingLinks) {
    const infoHtml = await fetchPage(infoUrl);
    if (!infoHtml) continue;

    const pdfs = parseInfoPage(infoHtml, title);
    for (const pdf of pdfs) {
      results.push({
        pdfUrl: pdf.pdfUrl,
        title,
        heldOn: pdf.heldOn,
        description: pdf.description,
        pdfHash: pdf.pdfHash,
      });
    }
  }

  return results;
}

/**
 * 対象年のジャンル ID を解決する。
 * まず固定の対応表を参照し、見つからない場合はトップページから動的に取得する。
 */
async function resolveGenreId(year: number): Promise<string | null> {
  // 固定の対応表を参照
  const fixed = YEAR_TO_GENRE_ID[year];
  if (fixed) return fixed;

  // トップページから動的取得
  const topHtml = await fetchPage(TOP_PAGE_URL);
  if (!topHtml) return null;

  const genreMap = parseTopPage(topHtml);
  const entry = genreMap.find((e) => e.year === year);
  return entry?.genreId ?? null;
}
