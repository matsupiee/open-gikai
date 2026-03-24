/**
 * 川崎町議会（宮城県）会議録 — list フェーズ
 *
 * 会議録一覧ページ（list6-25.html）から年度別ページ URL を取得し、
 * 各年度別ページから PDF リンクまたは HTML 会議録のメタ情報を収集する。
 *
 * 令和3年（2021年）以降: PDF 公開（年度別ページに PDF リンクが含まれる）
 * 令和2年（2020年）以前: HTML 直接公開（会議ごとの個別ページ）
 */

import {
  BASE_ORIGIN,
  LIST_PAGE_URL,
  fetchPage,
  parseDateFromText,
  eraToWesternYear,
} from "./shared";

/** PDF 公開形式（令和3年以降）の1会議録エントリ */
export interface KawasakiPdfMeeting {
  type: "pdf";
  /** PDF の完全 URL */
  pdfUrl: string;
  /** 会議タイトル（例: "令和7年3月5日（第2号）"） */
  title: string;
  /** 定例会名（例: "令和7年3月定例会"） */
  sessionTitle: string;
  /** 開催日 YYYY-MM-DD */
  heldOn: string;
}

/** HTML 直接公開形式（令和2年以前）の1会議録エントリ */
export interface KawasakiHtmlMeeting {
  type: "html";
  /** 会議録ページの完全 URL */
  pageUrl: string;
  /** 会議タイトル（例: "令和2年12月会議"） */
  title: string;
  /** 開催日（ページタイトルから推定、不明な場合は null） */
  heldOn: string | null;
}

export type KawasakiMeeting = KawasakiPdfMeeting | KawasakiHtmlMeeting;

/**
 * 会議録一覧ページ（list6-25.html）から年度別ページへのリンクを抽出する。
 * リンク href は `/site/gikai/{ページID}.html` 形式。
 *
 * 戻り値: { url, linkText }[] — URL と表示テキストのペア
 */
export function parseTopPageLinks(html: string): { url: string; text: string }[] {
  const results: { url: string; text: string }[] = [];
  const linkPattern =
    /<a[^>]+href="(\/site\/gikai\/(?!list)[^"]+\.html)"[^>]*>([\s\S]*?)<\/a>/gi;

  for (const match of html.matchAll(linkPattern)) {
    const href = match[1]!;
    const rawText = match[2]!
      .replace(/<[^>]+>/g, "")
      .replace(/&nbsp;/g, " ")
      .replace(/&amp;/g, "&")
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">")
      .replace(/&quot;/g, '"')
      .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(Number(code)))
      .trim();

    if (!rawText) continue;
    // 会議録関連のリンクのみ対象
    if (!rawText.includes("会議録") && !rawText.includes("会議")) continue;

    const fullUrl = `${BASE_ORIGIN}${href}`;
    if (!results.some((r) => r.url === fullUrl)) {
      results.push({ url: fullUrl, text: rawText });
    }
  }

  return results;
}

/**
 * 年度別ページ（令和3年以降: PDF 公開）から PDF リンクを抽出する。
 *
 * HTML 構造:
 *   <h2>令和7年3月定例会</h2>
 *   <ul>
 *     <li><a href="/uploaded/attachment/8930.pdf">令和7年3月5日（第2号）</a> [PDFファイル…]</li>
 *   </ul>
 */
export function parsePdfLinks(html: string): KawasakiPdfMeeting[] {
  const results: KawasakiPdfMeeting[] = [];

  // h2 見出しと PDF リンクを順に抽出するため、位置ベースで処理
  const h2Pattern = /<h2[^>]*>([\s\S]*?)<\/h2>/gi;
  const h2Matches = [...html.matchAll(h2Pattern)];

  for (let i = 0; i < h2Matches.length; i++) {
    const h2Match = h2Matches[i]!;
    const sessionTitle = h2Match[1]!
      .replace(/<[^>]+>/g, "")
      .replace(/&nbsp;/g, " ")
      .trim();

    if (!sessionTitle.includes("定例会") && !sessionTitle.includes("臨時会")) {
      continue;
    }

    // 次の h2 までの範囲を取得
    const sectionStart = h2Match.index! + h2Match[0].length;
    const nextH2 = h2Matches[i + 1];
    const sectionEnd = nextH2 ? nextH2.index! : html.length;
    const section = html.slice(sectionStart, sectionEnd);

    // PDF リンクを抽出
    const pdfLinkPattern =
      /<a[^>]+href="([^"]*\.pdf)"[^>]*>([\s\S]*?)<\/a>/gi;

    for (const match of section.matchAll(pdfLinkPattern)) {
      const href = match[1]!;
      const rawText = match[2]!
        .replace(/<[^>]+>/g, "")
        .replace(/&nbsp;/g, " ")
        .replace(/&amp;/g, "&")
        .replace(/&lt;/g, "<")
        .replace(/&gt;/g, ">")
        .replace(/&quot;/g, '"')
        .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(Number(code)))
        .trim();

      if (!rawText) continue;

      const heldOn = parseDateFromText(rawText);
      if (!heldOn) continue;

      const pdfUrl = href.startsWith("http")
        ? href
        : `${BASE_ORIGIN}${href}`;

      results.push({
        type: "pdf",
        pdfUrl,
        title: rawText,
        sessionTitle,
        heldOn,
      });
    }
  }

  return results;
}

/**
 * 年度別ページのリンクテキストから対象年を推定する。
 * 例: "令和7年 会議録" → 2025
 *     "令和2年 会議録（12月会議）" → 2020
 *     "令和元年 会議録（12月会議）" → 2019
 *     "平成31年 会議録（3月会議）" → 2019
 */
export function inferYearFromLinkText(text: string): number | null {
  return eraToWesternYear(text);
}

/**
 * 指定年の全会議録エントリを取得する。
 * 一覧ページから年度別ページ URL を収集し、各ページを巡回する。
 */
export async function fetchMeetingList(
  year: number,
): Promise<KawasakiMeeting[]> {
  const topHtml = await fetchPage(LIST_PAGE_URL);
  if (!topHtml) return [];

  const yearPageLinks = parseTopPageLinks(topHtml);
  const allMeetings: KawasakiMeeting[] = [];

  for (const { url, text } of yearPageLinks) {
    // リンクテキストから対象年を推定してフィルタリング
    const linkYear = inferYearFromLinkText(text);
    if (linkYear !== null && linkYear !== year) continue;

    const html = await fetchPage(url);
    if (!html) continue;

    // PDF リンクの有無で公開形式を判定
    const hasPdfLinks = /<a[^>]+href="[^"]*\.pdf"[^>]*>/i.test(html);

    if (hasPdfLinks) {
      // 令和3年以降: PDF 公開
      const meetings = parsePdfLinks(html);
      const filtered = meetings.filter((m) => {
        const meetingYear = parseInt(m.heldOn.slice(0, 4), 10);
        return meetingYear === year;
      });
      allMeetings.push(...filtered);
    } else {
      // 令和2年以前: HTML 直接公開（個別ページ）
      // リンクテキストから開催日を推定
      const heldOn = parseDateFromText(text) ?? null;
      allMeetings.push({
        type: "html",
        pageUrl: url,
        title: text,
        heldOn,
      });
    }
  }

  return allMeetings;
}
