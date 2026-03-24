/**
 * 忠岡町議会 -- list フェーズ
 *
 * 会議録一覧ページから詳細ページ URL と PDF リンクを収集する。
 *
 * URL 構造:
 *   一覧ページ: https://www.town.tadaoka.osaka.jp/gyousei/gikai/2110.html
 *   詳細ページ（主パターン）: /soshiki/gikai_jimukyoku/1/{ID}.html
 *   詳細ページ（一部）: /gyousei/gikai/kessanshinsatokubetu/{ID}.html
 *   直接 PDF（一部臨時会）: /material/files/group/21/{ID}.pdf
 */

import {
  BASE_ORIGIN,
  LIST_URL,
  fetchPage,
  normalizeUrl,
  parseJapaneseDate,
} from "./shared";

export interface TadaokaMeeting {
  pdfUrl: string;
  /** リンクテキスト（会議名・日付情報を含む） */
  title: string;
  /** 開催日 YYYY-MM-DD（リンクテキストから推定可能な場合のみ） */
  heldOn: string | null;
  /** 会議セクション（本会議、委員会等） */
  section: string;
}

/** 一覧ページから抽出したエントリ（詳細ページリンクまたは直接 PDF） */
interface ListEntry {
  /** 会議名（リンクテキスト） */
  title: string;
  /** 詳細ページ URL（html の場合）または null */
  detailUrl: string | null;
  /** 直接 PDF URL（pdf の場合）または null */
  directPdfUrl: string | null;
}

/**
 * 一覧ページ HTML から詳細ページリンクと直接 PDF リンクを抽出する（テスト可能な純粋関数）。
 *
 * 収集対象パターン:
 *   - 詳細ページ: /soshiki/gikai_jimukyoku/1/{数字}.html
 *   - 詳細ページ（別パス）: /gyousei/gikai/{path}/{数字}.html
 *   - 直接 PDF: /material/files/group/21/{ファイル名}.pdf
 */
export function parseListPage(html: string): ListEntry[] {
  const results: ListEntry[] = [];

  // a タグを抽出
  const linkPattern = /<a[^>]+href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/gi;

  for (const match of html.matchAll(linkPattern)) {
    const href = match[1]!.trim();
    const rawText = match[2]!.replace(/<[^>]+>/g, "").trim();

    // 詳細ページへのリンク（主パターン）
    if (/\/soshiki\/gikai_jimukyoku\/1\/\d+\.html/.test(href)) {
      results.push({
        title: rawText,
        detailUrl: normalizeUrl(href),
        directPdfUrl: null,
      });
      continue;
    }

    // 詳細ページへのリンク（別パス）
    if (/\/gyousei\/gikai\/[^"]+\/\d+\.html/.test(href)) {
      results.push({
        title: rawText,
        detailUrl: normalizeUrl(href),
        directPdfUrl: null,
      });
      continue;
    }

    // 直接 PDF リンク（/material/files/group/21/ 配下）
    if (/\/material\/files\/group\/21\/[^"]+\.pdf/.test(href)) {
      results.push({
        title: rawText,
        detailUrl: null,
        directPdfUrl: normalizeUrl(href),
      });
      continue;
    }
  }

  return results;
}

/**
 * 詳細ページ HTML から PDF リンクとメタ情報を抽出する（テスト可能な純粋関数）。
 *
 * HTML 構造（例）:
 *   <h1>令和7年第1回定例会 会議録</h1>
 *   <h3>本会議 会議録</h3>
 *   <ul>
 *     <li><a href="/material/files/group/21/20250217teirei1_1.pdf">令和7年2月17日（月曜日）（PDF：1,016KB）</a></li>
 *   </ul>
 *   <h3>委員会 会議録</h3>
 *   <ul>
 *     <li><a href="/material/files/group/21/20250225soumu1.pdf">令和7年2月25日（月曜日）（PDF：504KB）</a></li>
 *   </ul>
 */
export function parseDetailPage(
  html: string,
  listTitle: string
): TadaokaMeeting[] {
  const results: TadaokaMeeting[] = [];

  // h1 からページタイトル（会議名）を取得
  const h1Match = html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i);
  const pageTitle = h1Match
    ? h1Match[1]!.replace(/<[^>]+>/g, "").trim()
    : listTitle;

  // h2/h3 見出しの位置を収集
  const sections: { index: number; heading: string }[] = [];
  const headingPattern = /<h[23][^>]*>([\s\S]*?)<\/h[23]>/gi;
  for (const match of html.matchAll(headingPattern)) {
    const heading = match[1]!.replace(/<[^>]+>/g, "").trim();
    sections.push({ index: match.index!, heading });
  }

  // PDF リンクを抽出
  const linkPattern = /<a[^>]+href="([^"]*\.pdf)"[^>]*>([\s\S]*?)<\/a>/gi;

  for (const match of html.matchAll(linkPattern)) {
    const linkIndex = match.index!;
    const pdfHref = match[1]!;
    const linkText = match[2]!.replace(/<[^>]+>/g, "").trim();

    // /material/files/group/21/ 配下の PDF のみ対象
    if (!pdfHref.includes("/material/files/group/21/")) continue;

    const pdfUrl = normalizeUrl(pdfHref);

    // 現在のセクション見出しを特定（直前の h2/h3）
    let currentSection = "";
    for (const section of sections) {
      if (section.index < linkIndex) {
        currentSection = section.heading;
      }
    }

    // リンクテキストから開催日を抽出
    const heldOn = parseJapaneseDate(linkText);

    results.push({
      pdfUrl,
      title: `${pageTitle}${currentSection ? ` ${currentSection}` : ""}`,
      heldOn,
      section: currentSection,
    });
  }

  return results;
}

/**
 * 一覧ページから年度でフィルタリングした PDF リンクを収集する。
 *
 * @param year 西暦年（年度フィルタ）
 */
export async function fetchMeetingList(
  _baseUrl: string,
  year: number
): Promise<TadaokaMeeting[]> {
  const html = await fetchPage(LIST_URL);
  if (!html) return [];

  const entries = parseListPage(html);

  // 年度フィルタリング：タイトルに含まれる和暦から判定
  const filteredEntries = filterByYear(entries, year);

  const meetings: TadaokaMeeting[] = [];

  for (const entry of filteredEntries) {
    if (entry.directPdfUrl) {
      // 直接 PDF リンクの場合
      const heldOn = parseJapaneseDate(entry.title);
      meetings.push({
        pdfUrl: entry.directPdfUrl,
        title: entry.title,
        heldOn,
        section: "",
      });
    } else if (entry.detailUrl) {
      // 詳細ページからの収集
      const detailHtml = await fetchPage(entry.detailUrl);
      if (!detailHtml) continue;

      const detailMeetings = parseDetailPage(detailHtml, entry.title);
      meetings.push(...detailMeetings);

      // リクエスト間の待機（礼儀として）
      await new Promise((resolve) => setTimeout(resolve, 500));
    }
  }

  return meetings;
}

/**
 * 年度フィルタリング：タイトルから和暦年を抽出して西暦年に変換し、
 * 指定年と一致するエントリのみを返す。
 *
 * e.g., "令和6年第3回定例会会議録" → 年: 2024
 * e.g., "平成27年第1回定例会会議録" → 年: 2015
 */
export function filterByYear(entries: ListEntry[], year: number): ListEntry[] {
  // 令和の場合: 令和 X 年 = 2018 + X 年
  // 平成の場合: 平成 X 年 = 1988 + X 年
  return entries.filter((entry) => {
    const match = entry.title.match(/(令和|平成)(\d+)年/);
    if (!match) return false;

    const era = match[1]!;
    const eraYear = Number(match[2]);

    let entryYear: number;
    if (era === "令和") {
      entryYear = 2018 + eraYear;
    } else if (era === "平成") {
      entryYear = 1988 + eraYear;
    } else {
      return false;
    }

    return entryYear === year;
  });
}

/**
 * 一覧ページの URL を取得する（テスト用公開）。
 */
export function getListUrl(): string {
  return LIST_URL;
}

// BASE_ORIGIN を再エクスポート（テスト用）
export { BASE_ORIGIN };
