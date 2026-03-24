/**
 * 蔵王町議会（宮城県）会議録 — list フェーズ
 *
 * トップページから年度別ページ URL を収集し、各年度別ページから
 * PDF リンクまたは HTML（フレームセット）リンクを収集する。
 *
 * 令和7年（2025年）以降: PDF のみ公開
 * 令和6年（2024年）: PDF + HTML 混在
 * 平成23年〜令和5年: HTML フレームセット公開
 */

import {
  BASE_ORIGIN,
  TOP_PAGE_URL,
  fetchPage,
  parseDateFromText,
  parseDateFromPdfFilename,
} from "./shared";

/** PDF 公開形式の1会議録エントリ */
export interface ZaoPdfMeeting {
  type: "pdf";
  /** PDF の完全 URL */
  pdfUrl: string;
  /** 会議タイトル（例: "令和7年7月定例会 7月2日"） */
  title: string;
  /** セッションタイトル（例: "令和7年7月会議"） */
  sessionTitle: string;
  /** 開催日 YYYY-MM-DD */
  heldOn: string;
}

/** HTML フレームセット公開形式の1会議録エントリ */
export interface ZaoHtmlMeeting {
  type: "html";
  /** main.html の完全 URL */
  mainUrl: string;
  /** 会議タイトル（例: "令和6年6月会議"） */
  title: string;
  /** 開催日 YYYY-MM-DD（解析できない場合は null） */
  heldOn: string | null;
  /** 一般質問かどうか */
  isGeneralQuestion: boolean;
}

export type ZaoMeeting = ZaoPdfMeeting | ZaoHtmlMeeting;

/**
 * トップページから年度別ページへのリンクを抽出する。
 * 令和: gijiroku_R{1〜99}.html
 * 平成: gijiroku_h{23〜31}.html
 */
export function parseYearPageLinks(html: string): { url: string; year: number }[] {
  const results: { url: string; year: number }[] = [];

  // 令和ページ
  const reiwaPattern =
    /href="((?:\.\/)?(?:\/kurashi_guide\/gikai_senkyo\/gikai\/gijiroku\/)?gijiroku_R(\d+)\.html)"/gi;
  for (const match of html.matchAll(reiwaPattern)) {
    const href = match[1]!;
    const eraYear = parseInt(match[2]!, 10);
    const westernYear = eraYear + 2018;
    const url = href.startsWith("http")
      ? href
      : href.startsWith("/")
        ? `${BASE_ORIGIN}${href}`
        : `${BASE_ORIGIN}/kurashi_guide/gikai_senkyo/gikai/gijiroku/${href.replace(/^\.\//, "")}`;
    if (!results.some((r) => r.url === url)) {
      results.push({ url, year: westernYear });
    }
  }

  // 平成ページ
  const heiwaPattern =
    /href="((?:\.\/)?(?:\/kurashi_guide\/gikai_senkyo\/gikai\/gijiroku\/)?gijiroku_h(\d+)\.html)"/gi;
  for (const match of html.matchAll(heiwaPattern)) {
    const href = match[1]!;
    const eraYear = parseInt(match[2]!, 10);
    const westernYear = eraYear + 1988;
    const url = href.startsWith("http")
      ? href
      : href.startsWith("/")
        ? `${BASE_ORIGIN}${href}`
        : `${BASE_ORIGIN}/kurashi_guide/gikai_senkyo/gikai/gijiroku/${href.replace(/^\.\//, "")}`;
    if (!results.some((r) => r.url === url)) {
      results.push({ url, year: westernYear });
    }
  }

  return results;
}

/**
 * 年度ページから PDF リンクを抽出する。
 *
 * ページ構造:
 *   ○月会議（見出し or テキスト）
 *   会議録（X月Y日）→ PDF or main.html へのリンク
 */
export function parseMeetingsFromYearPage(
  html: string,
  pageYear: number,
): ZaoMeeting[] {
  const results: ZaoMeeting[] = [];

  // セクション見出しを取得して月を追跡する
  // <h2>, <h3>, <strong>, <b> などで囲まれた「○月会議」テキストを追跡
  // リンクとその前後のテキストコンテキストを使って判定する

  // HTML を行ごとに処理して、コンテキストを把握する
  const lines = html.split(/\n/);
  let currentSession = "";
  let isGeneralQuestion = false;

  for (const line of lines) {
    // セッション見出しを検出（○月会議、定例会、臨時会）
    const sessionMatch = line.match(
      /[>\s]([１-１２一二三四五六七八九十\d]+月(?:定例会|臨時会|会議)|定例会|臨時会)/,
    );
    if (sessionMatch) {
      const rawSession = sessionMatch[1]!;
      // 全角数字を半角に変換
      currentSession = rawSession.replace(/[０-９]/g, (c) =>
        String.fromCharCode(c.charCodeAt(0) - 0xfee0),
      );
    }

    // 「一般質問」セクションかどうかを検出
    if (line.includes("一般質問")) {
      isGeneralQuestion = true;
    } else if (
      line.match(/[>\s][１-１２一二三四五六七八九十\d]+月(?:定例会|臨時会|会議)/)
    ) {
      isGeneralQuestion = false;
    }

    // PDF リンクを検出
    const pdfMatch = line.match(
      /href="([^"]*r(\d{6})\.pdf)"/i,
    );
    if (pdfMatch) {
      const href = pdfMatch[1]!;
      const filename = href.split("/").pop() ?? "";
      const pdfUrl = href.startsWith("http")
        ? href
        : href.startsWith("/")
          ? `${BASE_ORIGIN}${href}`
          : `${BASE_ORIGIN}/kurashi_guide/gikai_senkyo/gikai/gijiroku/${href}`;

      const heldOn =
        parseDateFromPdfFilename(filename) ??
        parseDateFromText(line);
      if (!heldOn) continue;

      const year = parseInt(heldOn.slice(0, 4), 10);
      if (year !== pageYear) continue;

      // リンクテキストを抽出
      const linkTextMatch = line.match(/href="[^"]*"[^>]*>([\s\S]*?)<\/a>/i);
      const rawLinkText = linkTextMatch
        ? linkTextMatch[1]!
            .replace(/<[^>]+>/g, "")
            .replace(/&nbsp;/g, " ")
            .trim()
        : filename;

      const sessionTitle = currentSession
        ? `${pageYear}年${currentSession}`
        : rawLinkText;

      results.push({
        type: "pdf",
        pdfUrl,
        title: rawLinkText || filename,
        sessionTitle,
        heldOn,
      });
      continue;
    }

    // HTML フレームセットリンク（main.html）を検出
    const htmlMatch = line.match(/href="([^"]*main\.html)"/i);
    if (htmlMatch) {
      const href = htmlMatch[1]!;
      const mainUrl = href.startsWith("http")
        ? href
        : href.startsWith("/")
          ? `${BASE_ORIGIN}${href}`
          : `https://www.town.zao.miyagi.jp/gijiroku/gijiroku/${href.replace(/^\.\//, "")}`;

      // リンクテキストを抽出
      const linkTextMatch = line.match(/href="[^"]*"[^>]*>([\s\S]*?)<\/a>/i);
      const rawLinkText = linkTextMatch
        ? linkTextMatch[1]!
            .replace(/<[^>]+>/g, "")
            .replace(/&nbsp;/g, " ")
            .trim()
        : "";

      // 開催日をリンクテキストから解析
      const heldOn = parseDateFromText(rawLinkText);

      // heldOn が取得できた場合に年をフィルタリング
      if (heldOn) {
        const year = parseInt(heldOn.slice(0, 4), 10);
        if (year !== pageYear) continue;
      }

      const sessionTitle = currentSession
        ? `${pageYear}年${currentSession}`
        : rawLinkText;

      results.push({
        type: "html",
        mainUrl,
        title: sessionTitle || rawLinkText,
        heldOn,
        isGeneralQuestion,
      });
    }
  }

  return results;
}

/**
 * 指定年の全会議録エントリを取得する。
 */
export async function fetchMeetingList(year: number): Promise<ZaoMeeting[]> {
  const topHtml = await fetchPage(TOP_PAGE_URL);
  if (!topHtml) return [];

  const yearPages = parseYearPageLinks(topHtml);
  const targetPages = yearPages.filter((p) => p.year === year);

  // 見つからない場合は前後の年度ページも確認（同一ページに複数年が含まれる場合がある）
  const pagesToFetch = targetPages.length > 0 ? targetPages : yearPages;

  const allMeetings: ZaoMeeting[] = [];

  for (const { url, year: pageYear } of pagesToFetch) {
    if (targetPages.length > 0 && pageYear !== year) continue;

    const html = await fetchPage(url);
    if (!html) continue;

    const meetings = parseMeetingsFromYearPage(html, year);
    allMeetings.push(...meetings);
  }

  return allMeetings;
}
