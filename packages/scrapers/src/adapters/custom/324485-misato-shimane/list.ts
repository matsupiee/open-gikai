/**
 * 美郷町（島根県）議会 会議録 — list フェーズ
 *
 * 会議録トップ → 年別会議録一覧 → PDF リンクの順でクロールする。
 *
 * 会議録トップ:
 *   /gikai/1910/ に年別ページへのリンクが並ぶ
 *
 * 年別会議録一覧ページ構造:
 *   <h3> タグに会議タイトルと PDF リンクが含まれる
 *   タイトル例: "第４回定例会（４日目）R7.12.9議事録"
 *              "第２回臨時会 R6.4.23議事録"
 *
 * 日付表記: R（令和）/H（平成）+ 年.月.日 の略記形式
 */

import {
  BASE_ORIGIN,
  eraToWesternYear,
  fetchPage,
  toHalfWidth,
} from "./shared";

const TOP_URL = `${BASE_ORIGIN}/gikai/1910/`;

export interface MisatoShimaneMeeting {
  /** PDF の完全 URL */
  pdfUrl: string;
  /** 会議タイトル（例: "第４回定例会（４日目）R7.12.9議事録"） */
  title: string;
  /** 開催日 YYYY-MM-DD（解析できない場合は null） */
  heldOn: string | null;
  /** 会議種別（"plenary" / "extraordinary"） */
  category: string;
  /** 外部 ID 用のキー（PDF URL の末尾ファイル名から生成） */
  pdfKey: string;
}

/**
 * 略記日付文字列 "R7.12.9" / "H26.3.5" を YYYY-MM-DD に変換する。
 * R = 令和 (2018+), H = 平成 (1988+)
 */
export function parseAbbreviatedDate(dateStr: string): string | null {
  const half = toHalfWidth(dateStr.trim());
  const match = half.match(/^([RH])(\d+)\.(\d+)\.(\d+)$/);
  if (!match) return null;

  const prefix = match[1]!;
  const eraYear = parseInt(match[2]!, 10);
  const month = parseInt(match[3]!, 10);
  const day = parseInt(match[4]!, 10);

  let westernYear: number;
  if (prefix === "R") {
    westernYear = eraYear + 2018;
  } else {
    westernYear = eraYear + 1988;
  }

  return `${westernYear}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

/**
 * 年別会議録一覧ページの URL を会議録トップページの HTML から抽出する。
 */
export function parseTopPage(html: string): string[] {
  const urls: string[] = [];
  // /gikai/1910/{数値} パターンのリンクを抽出
  const linkPattern = /href="([^"]*\/gikai\/1910\/(\d+)[^"]*)"/gi;
  for (const match of html.matchAll(linkPattern)) {
    const href = match[1]!;
    const fullUrl = href.startsWith("http")
      ? href
      : new URL(href, BASE_ORIGIN).toString();
    if (!urls.includes(fullUrl)) {
      urls.push(fullUrl);
    }
  }
  return urls;
}

/**
 * 年別会議録一覧ページの HTML から PDF エントリを抽出する（純粋関数）。
 *
 * h3 テキスト例:
 *   "第４回定例会（４日目）R7.12.9議事録"
 *   "第２回臨時会 R6.4.23議事録"
 */
export function parseListPage(html: string): MisatoShimaneMeeting[] {
  const meetings: MisatoShimaneMeeting[] = [];

  // <h3> タグを抽出
  const h3Pattern = /<h3[^>]*>([\s\S]*?)<\/h3>/gi;
  for (const h3Match of html.matchAll(h3Pattern)) {
    const h3Html = h3Match[1]!;
    const h3Text = h3Html.replace(/<[^>]+>/g, "").trim();

    // h3 内の /files/original/ を含む PDF リンクを探す
    const pdfLinkMatch = h3Html.match(
      /href="([^"]*\/files\/original\/[^"]+\.pdf)"/i,
    );
    if (!pdfLinkMatch) continue;

    const pdfHref = pdfLinkMatch[1]!;
    const pdfUrl = pdfHref.startsWith("http")
      ? pdfHref
      : new URL(pdfHref, BASE_ORIGIN).toString();

    // ファイル名から pdfKey を生成
    const fileName = pdfUrl.split("/").pop()?.replace(".pdf", "") ?? pdfUrl;
    const pdfKey = `324485_${fileName}`;

    // 日付抽出: "R7.12.9" / "H26.3.5" パターン
    const dateMatch = toHalfWidth(h3Text).match(/[RH]\d+\.\d+\.\d+/);
    const heldOn = dateMatch ? parseAbbreviatedDate(dateMatch[0]) : null;

    // 会議種別
    const category = h3Text.includes("臨時会") ? "extraordinary" : "plenary";

    meetings.push({
      pdfUrl,
      title: h3Text,
      heldOn,
      category,
      pdfKey,
    });
  }

  return meetings;
}

/**
 * 指定年の会議一覧を取得する。
 *
 * 1. 会議録トップから年別ページ URL を収集
 * 2. 各年別ページから指定年の PDF エントリを収集
 *
 * 指定年に対応する和暦年を持つページのみを対象とする。
 * トップページに年別リンクがある場合はそれを直接使用し、
 * 年の対応は eraToWesternYear でチェックする。
 */
export async function fetchDocumentList(
  year: number,
): Promise<MisatoShimaneMeeting[]> {
  const topHtml = await fetchPage(TOP_URL);
  if (!topHtml) return [];

  const yearPageUrls = parseTopPage(topHtml);
  const allMeetings: MisatoShimaneMeeting[] = [];

  for (const pageUrl of yearPageUrls) {
    const pageHtml = await fetchPage(pageUrl);
    if (!pageHtml) continue;

    // h2 タグから年を取得して対象年かチェック
    const h2Match = pageHtml.match(/<h2[^>]*>([\s\S]*?)<\/h2>/i);
    if (h2Match) {
      const h2Text = toHalfWidth(
        h2Match[1]!.replace(/<[^>]+>/g, "").trim(),
      );
      const westernYear = eraToWesternYear(h2Text);
      // 年別ページのタイトルに年が含まれ、対象年と一致しない場合はスキップ
      if (westernYear !== null && westernYear !== year) continue;
    }

    const meetings = parseListPage(pageHtml);
    // 指定年の heldOn または heldOn が null のもの（年が不明なもの）を含める
    // heldOn が解析できた場合は year と一致するものだけに絞り込む
    for (const m of meetings) {
      if (m.heldOn === null || m.heldOn.startsWith(String(year))) {
        allMeetings.push(m);
      }
    }
  }

  return allMeetings;
}
