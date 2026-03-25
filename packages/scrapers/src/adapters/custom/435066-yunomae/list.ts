/**
 * 湯前町議会 会議録 — list フェーズ
 *
 * 一覧ページ（list00557.html）から年度別ページへのリンクを収集し、
 * 各年度ページから kiji ページへのリンクを取得し、
 * kiji ページから PDF リンクと会議メタ情報を取得する。
 *
 * 構造:
 *   一覧ページ (gikai/list00557.html)
 *   └── <a href="gikai/list{listId}.html">令和X年湯前町議会会議録</a>
 *
 *   年度別ページ (gikai/list{listId}.html)
 *   └── <a href="gikai/kiji{kijiId}/index.html">令和X年湯前町議会会議録</a>
 *
 *   kiji ページ (gikai/kiji{kijiId}/index.html)
 *   └── <li>■令和X年第N回定例会（MM月DD日～MM月DD日）</li>
 *       └── <a href="gikai/kiji{kijiId}/{ファイル名}.pdf">PDF リンク</a>
 */

import {
  BASE_ORIGIN,
  LIST_URL,
  buildExternalId,
  buildKijiPageUrl,
  buildYearListUrl,
  extractYearFromTitle,
  fetchPage,
  parseJapaneseDate,
} from "./shared";

export interface YunomaeMeeting {
  /** kiji 番号 (e.g., "4967") */
  kijiId: string;
  /** 会議タイトル / セクション名 (e.g., "■令和7年第3回定例会（3月6日～3月14日）") */
  title: string;
  /** PDF の絶対 URL */
  pdfUrl: string;
  /** 開催日 YYYY-MM-DD */
  heldOn: string;
  /** 外部 ID */
  externalId: string;
}

/**
 * 一覧ページ HTML から年度別ページの list ID を抽出する。
 * トップページ（list00557.html）自身のリンクは除外する。
 */
export function parseTopListPage(html: string): string[] {
  const listIds: string[] = [];

  // gikai/list{ID}.html 形式のリンクを抽出（list00557 自身は除外）
  const linkRegex = /href=["'][^"']*\/gikai\/list(\d+)\.html["']/gi;

  for (const match of html.matchAll(linkRegex)) {
    const listId = match[1];
    if (!listId) continue;
    if (listId === "00557") continue; // トップページ自身を除外

    if (!listIds.includes(listId)) {
      listIds.push(listId);
    }
  }

  return listIds;
}

/**
 * 年度別ページ HTML から kiji ページの ID を抽出する。
 * 返り値: kijiId[]
 */
export function parseYearListPage(html: string): string[] {
  const kijiIds: string[] = [];

  // gikai/kiji{ID}/index.html 形式のリンクを抽出
  const linkRegex = /href=["'][^"']*\/gikai\/kiji(\d+)\/index\.html["']/gi;

  for (const match of html.matchAll(linkRegex)) {
    const kijiId = match[1];
    if (!kijiId) continue;

    if (!kijiIds.includes(kijiId)) {
      kijiIds.push(kijiId);
    }
  }

  return kijiIds;
}

/**
 * kiji ページ HTML から PDF リンクとメタ情報を抽出する。
 *
 * 構造:
 *   ■令和7年第3回定例会（3月6日～3月14日）
 *   <a href=".../xxx.pdf">PDF リンクテキスト</a>
 *
 * セクション名（■で始まるテキスト）を各 PDF リンクの直前から取得し、
 * 各 PDF リンクに紐付ける。
 */
export function parseKijiPage(
  html: string,
  kijiId: string,
  year: number
): { title: string; pdfUrl: string; heldOn: string | null }[] {
  const results: { title: string; pdfUrl: string; heldOn: string | null }[] = [];

  // テキストノード（■セクション名）と PDF リンクの両方を順番に抽出するトークナイザ
  // ■ を含むテキストか、.pdf リンクかのどちらかを順番に並べて処理する
  const tokenRegex =
    /(■[^<]+)|<a\s+[^>]*href=["']([^"']*\.pdf)["'][^>]*>/gi;

  let currentTitle = "";
  for (const match of html.matchAll(tokenRegex)) {
    if (match[1]) {
      // ■ セクション名
      currentTitle = match[1].replace(/\s+/g, " ").trim();
    } else if (match[2]) {
      // PDF リンク
      const href = match[2];
      const pdfUrl = href.startsWith("http")
        ? href
        : `${BASE_ORIGIN}${href.startsWith("/") ? "" : "/gikai/"}${href}`;

      const title = currentTitle || `kiji${kijiId}`;
      const titleYear = extractYearFromTitle(title);
      const heldOn = parseJapaneseDate(title, titleYear ?? year);

      results.push({ title, pdfUrl, heldOn });
    }
  }

  return results;
}

/**
 * 指定年の全会議録一覧を取得する。
 */
export async function fetchMeetingList(year: number): Promise<YunomaeMeeting[]> {
  const listHtml = await fetchPage(LIST_URL);
  if (!listHtml) return [];

  const listIds = parseTopListPage(listHtml);

  const meetings: YunomaeMeeting[] = [];

  for (const listId of listIds) {
    const yearListUrl = buildYearListUrl(listId);
    const yearListHtml = await fetchPage(yearListUrl);
    if (!yearListHtml) continue;

    // 年度別ページのタイトルから年を確認してフィルタリング
    const yearTitleMatch = yearListHtml.match(/(令和|平成)(元|\d+)年/);
    if (yearTitleMatch) {
      const era = yearTitleMatch[1];
      const eraYear = yearTitleMatch[2] === "元" ? 1 : parseInt(yearTitleMatch[2]!, 10);
      const pageYear = eraYear + (era === "平成" ? 1988 : 2018);
      if (pageYear !== year) continue;
    }

    const kijiIds = parseYearListPage(yearListHtml);

    for (const kijiId of kijiIds) {
      const kijiPageUrl = buildKijiPageUrl(kijiId);
      const kijiPageHtml = await fetchPage(kijiPageUrl);
      if (!kijiPageHtml) continue;

      const pdfs = parseKijiPage(kijiPageHtml, kijiId, year);

      for (const pdf of pdfs) {
        // タイトルから年を抽出してフィルタリング
        const titleYear = extractYearFromTitle(pdf.title);
        if (titleYear !== null && titleYear !== year) continue;

        if (!pdf.heldOn) continue;

        meetings.push({
          kijiId,
          title: pdf.title,
          pdfUrl: pdf.pdfUrl,
          heldOn: pdf.heldOn,
          externalId: buildExternalId(kijiId, pdf.pdfUrl),
        });
      }
    }
  }

  return meetings;
}
