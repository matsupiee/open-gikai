/**
 * 那珂川町議会 — list フェーズ
 *
 * 3 段階で PDF リンクを収集する:
 * 1. 年別一覧ページ ({year}/index.html) から会議録詳細ページへのリンクを収集
 * 2. 会議録詳細ページのテーブルから PDF リンクと開催日を抽出
 *
 * 年別一覧ページ構造:
 *   リスト要素に各会議録詳細ページへのリンクがある
 *   リンクテキスト例: "令和６年第７回那珂川町議会定例会（１２月）会議録"
 *
 * 会議録詳細ページ構造:
 *   テーブル形式で会期中の各日の議事内容を表示
 *   列構成: 月日、曜日、時間、議事・議案
 *   月日セルに PDF ファイルへのリンクあり
 */

import {
  BASE_ORIGIN,
  buildYearListUrl,
  detectMeetingType,
  fetchPage,
  parseJapaneseDate,
  parseMonthDay,
} from "./shared";

export interface NakagawaTochigiMeeting {
  /** PDF の完全 URL */
  pdfUrl: string;
  /** 会議タイトル（例: "令和６年第７回那珂川町議会定例会（１２月）会議録"） */
  title: string;
  /** 開催日 YYYY-MM-DD（解析できない場合は null） */
  heldOn: string | null;
  /** 会議種別（"plenary" / "extraordinary"） */
  meetingType: string;
  /** 外部 ID 用キー（PDF ファイル名から） */
  pdfKey: string;
}

/**
 * 年別一覧ページ ({year}/index.html) の HTML から会議録詳細ページへのリンクを抽出する。
 *
 * リンクパターン例:
 *   href="{ID}.html" または href="{year}/{ID}.html" または絶対パス
 *   リンクテキスト: "令和６年第７回那珂川町議会定例会（１２月）会議録"
 */
export function parseYearListPage(
  html: string,
  year: number
): { detailUrl: string; title: string }[] {
  const results: { detailUrl: string; title: string }[] = [];

  // .html へのリンクを含む a タグを抽出
  // href が .html で終わり、テキストに「会議録」または「定例会」「臨時会」が含まれるもの
  const linkRegex = /href="([^"]*\.html)"[^>]*>([\s\S]*?)<\/a>/gi;

  for (const match of html.matchAll(linkRegex)) {
    const href = match[1]!;
    const rawTitle = match[2]!
      .replace(/<[^>]+>/g, "")
      .replace(/&nbsp;/g, " ")
      .replace(/&amp;/g, "&")
      .replace(/\s+/g, " ")
      .trim();

    if (!rawTitle) continue;

    // 会議録タイトルパターンにマッチするものだけ（那珂川町議会関連）
    if (!rawTitle.includes("定例会") && !rawTitle.includes("臨時会")) continue;
    if (rawTitle.includes("index")) continue;

    // 絶対 URL を構築
    let detailUrl: string;
    if (href.startsWith("http")) {
      detailUrl = href;
    } else if (href.startsWith("/")) {
      detailUrl = `${BASE_ORIGIN}${href}`;
    } else if (href.includes("/")) {
      // "2024/some-page.html" のような相対パス
      detailUrl = `${BASE_ORIGIN}/05gikai/kaigiroku/${href}`;
    } else {
      // "some-page.html" のような同一ディレクトリの相対パス
      detailUrl = `${BASE_ORIGIN}/05gikai/kaigiroku/${year}/${href}`;
    }

    // 重複チェック
    if (results.some((r) => r.detailUrl === detailUrl)) continue;
    results.push({ detailUrl, title: rawTitle });
  }

  return results;
}

/**
 * 会議録詳細ページ（日程表）の HTML から PDF リンクと開催日を抽出する。
 *
 * テーブル構造:
 *   | 月日 | 曜日 | 時間 | 議事・議案 |
 *   月日セルに PDF へのリンクあり
 *
 * PDF URL パターン（年代によって異なる）:
 *   近年: files/R6.12.3.pdf
 *   中期: files/teireikai3t1.pdf
 *   初期: files/09kaigiroku3gatuteirei1.pdf
 */
export function parseDetailPage(
  html: string,
  year: number
): { pdfUrl: string; heldOn: string | null; pdfKey: string }[] {
  const results: { pdfUrl: string; heldOn: string | null; pdfKey: string }[] =
    [];

  // テーブル行を走査
  const rowRegex = /<tr[^>]*>([\s\S]*?)<\/tr>/gi;

  for (const rowMatch of html.matchAll(rowRegex)) {
    const rowContent = rowMatch[1]!;

    // PDF リンクを探す（files/ ディレクトリ配下の .pdf）
    const pdfMatch = rowContent.match(/href="([^"]*files\/[^"]+\.pdf)"/i);
    if (!pdfMatch) continue;

    const pdfPath = pdfMatch[1]!;

    // PDF URL を絶対 URL に変換
    let pdfUrl: string;
    if (pdfPath.startsWith("http")) {
      pdfUrl = pdfPath;
    } else if (pdfPath.startsWith("/")) {
      pdfUrl = `${BASE_ORIGIN}${pdfPath}`;
    } else if (pdfPath.startsWith("../")) {
      // ../files/... → /05gikai/kaigiroku/files/...
      pdfUrl = `${BASE_ORIGIN}/05gikai/kaigiroku/${pdfPath.replace(/^\.\.\//, "")}`;
    } else {
      // files/... → /05gikai/kaigiroku/{year}/files/...
      pdfUrl = `${BASE_ORIGIN}/05gikai/kaigiroku/${year}/${pdfPath}`;
    }

    // PDF キーをファイル名から生成
    const fileNameMatch = pdfUrl.match(/\/([^/]+\.pdf)$/i);
    const pdfKey = fileNameMatch
      ? `094111_${fileNameMatch[1]}`
      : `094111_${pdfUrl}`;

    // セル（td）からテキストを抽出
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

    // 月日セル（最初のセル）から開催日を抽出
    const dateText = cells[0] ?? "";

    // まず完全な和暦日付（令和X年MM月DD日）を試みる
    let heldOn = parseJapaneseDate(dateText);

    // 月日のみ（MM月DD日）の場合は年別一覧の年を使う
    if (!heldOn) {
      heldOn = parseMonthDay(dateText, year);
    }

    // 重複チェック
    if (results.some((r) => r.pdfUrl === pdfUrl)) continue;
    results.push({ pdfUrl, heldOn, pdfKey });
  }

  return results;
}

/**
 * 指定年の全 PDF リンクを取得する。
 *
 * 1. 年別一覧ページから各会議録詳細ページへのリンクを取得
 * 2. 各会議録詳細ページのテーブルから PDF リンクを収集
 */
export async function fetchDocumentList(
  year: number
): Promise<NakagawaTochigiMeeting[]> {
  const yearListUrl = buildYearListUrl(year);
  const yearHtml = await fetchPage(yearListUrl);
  if (!yearHtml) return [];

  const meetingLinks = parseYearListPage(yearHtml, year);
  if (meetingLinks.length === 0) return [];

  const results: NakagawaTochigiMeeting[] = [];

  for (const { detailUrl, title } of meetingLinks) {
    const detailHtml = await fetchPage(detailUrl);
    if (!detailHtml) continue;

    const pdfs = parseDetailPage(detailHtml, year);
    for (const pdf of pdfs) {
      results.push({
        pdfUrl: pdf.pdfUrl,
        title,
        heldOn: pdf.heldOn,
        meetingType: detectMeetingType(title),
        pdfKey: pdf.pdfKey,
      });
    }
  }

  return results;
}
