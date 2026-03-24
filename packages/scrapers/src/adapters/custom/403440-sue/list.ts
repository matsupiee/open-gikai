/**
 * 須恵町議会（福岡県） — list フェーズ
 *
 * 2段階で PDF リンクを収集する:
 * 1. トップページ (index.html) から年度別ページへのリンクを抽出
 * 2. 各年度ページから PDF ダウンロードリンクとメタ情報を抽出
 *
 * 須恵町の年度別ページには:
 * - 定例会・臨時会ごとのセクション（h4 タグで区切られる）
 * - 各セクション内に会議全体の summary PDF と、日ごとの個別 PDF
 * - 個別 PDF のリンクテキストは「3月3日（当初本会議）」形式
 */

import {
  detectMeetingType,
  fetchPage,
  parseDateFromMonthDay,
  parseDateText,
  resolveUrl,
} from "./shared";

export interface SueMeeting {
  /** PDF ダウンロード URL */
  pdfUrl: string;
  /** 会議タイトル（例: 第1回（3月）定例会 3月3日） */
  title: string;
  /** 開催日 YYYY-MM-DD */
  heldOn: string;
  /** 会議種別 plenary/extraordinary/committee */
  meetingType: string;
  /** 年度別ページ URL（sourceUrl として利用） */
  pageUrl: string;
}

/**
 * トップページから年度別ページリンクを抽出する（テスト可能な純粋関数）。
 *
 * HTML 構造:
 *   <li><a href="https://www.town.sue.fukuoka.jp/gyosei/gikai/1/{pageID}.html">会議録（令和6年）</a></li>
 */
export function parseIndexPage(html: string): { yearPageUrl: string; year: number }[] {
  const results: { yearPageUrl: string; year: number }[] = [];

  // /gyosei/gikai/1/{数値}.html 形式のリンクを抽出
  const linkRegex =
    /<a[^>]+href="([^"]*\/gyosei\/gikai\/1\/(\d+)\.html)"[^>]*>([^<]*(?:令和|平成)[^<]*)<\/a>/g;

  for (const match of html.matchAll(linkRegex)) {
    const href = match[1]!;
    const titleText = match[3]!.trim();

    // タイトルから西暦年を推定
    const year = extractYearFromTitle(titleText);
    if (!year) continue;

    results.push({
      yearPageUrl: resolveUrl(href),
      year,
    });
  }

  return results;
}

/**
 * ページタイトルから西暦年を抽出する。
 * 「会議録（令和6年）」→ 2024
 * 「会議録(平成23年)」→ 2011
 */
export function extractYearFromTitle(title: string): number | null {
  const reiwaMatch = title.match(/令和(元|\d+)年/);
  if (reiwaMatch) {
    const n = reiwaMatch[1] === "元" ? 1 : parseInt(reiwaMatch[1]!, 10);
    return n + 2018;
  }
  const heisei = title.match(/平成(\d+)年/);
  if (heisei) {
    return parseInt(heisei[1]!, 10) + 1988;
  }
  return null;
}

/**
 * 年度別ページから PDF リンクを抽出する（テスト可能な純粋関数）。
 *
 * HTML 構造:
 *   <h4>定例会</h4>  or  <h4>臨時会</h4>
 *   ...
 *   <a href="//www.town.sue.fukuoka.jp/material/files/group/46/20250303.pdf">
 *     3月3日（当初本会議） (PDFファイル: 422.0KB)
 *   </a>
 *   ...
 *
 * 日付を持つリンクのみを収集する。
 * 「第N回（M月）定例会会議録」など日付なしのまとめ PDF はスキップ。
 */
export function parseYearPage(
  html: string,
  year: number,
  pageUrl: string,
): SueMeeting[] {
  const results: SueMeeting[] = [];

  // 現在のセクション（定例会 or 臨時会）の文脈を追跡するため
  // h4 タグと PDF リンクを順番に処理する
  const sectionAndLinkRegex =
    /<h4[^>]*>([^<]*)<\/h4>|<a[^>]+href="([^"]+\.pdf)"[^>]*>([\s\S]*?)<\/a>/gi;

  let currentMeetingType = "plenary";
  let currentSectionTitle = "";

  for (const match of html.matchAll(sectionAndLinkRegex)) {
    if (match[1] !== undefined) {
      // h4 セクション見出し
      const heading = match[1].trim();
      currentMeetingType = detectMeetingType(heading);
      currentSectionTitle = heading;
    } else if (match[2] !== undefined) {
      // PDF リンク
      const href = match[2]!;
      const rawText = match[3]!.replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim();

      // リンクテキストから日付を抽出
      // パターン1: 和暦付き「令和7年3月3日」
      let heldOn = parseDateText(rawText);

      // パターン2: 月日のみ「3月3日（当初本会議）」→ 年度から補完
      if (!heldOn) {
        heldOn = parseDateFromMonthDay(rawText, year);
      }

      // 日付が取得できなかったリンクはスキップ（まとめ PDF 等）
      if (!heldOn) continue;

      const pdfUrl = resolveUrl(href);

      // タイトルを構成: セクション + 日付
      const sectionLabel = currentSectionTitle || (currentMeetingType === "extraordinary" ? "臨時会" : "定例会");
      const title = `${year}年 ${sectionLabel} ${heldOn}`;

      results.push({
        pdfUrl,
        title,
        heldOn,
        meetingType: currentMeetingType,
        pageUrl,
      });
    }
  }

  return results;
}

/**
 * 指定年度の全 PDF リンクを取得する。
 */
export async function fetchMeetingList(
  baseUrl: string,
  year: number,
): Promise<SueMeeting[]> {
  // Step 1: トップページから年度別ページリンクを取得
  const indexHtml = await fetchPage(baseUrl);
  if (!indexHtml) return [];

  const yearPages = parseIndexPage(indexHtml);

  // 指定年度のページを検索
  const targetPage = yearPages.find((p) => p.year === year);
  if (!targetPage) return [];

  // Step 2: 年度別ページから PDF リンクを抽出
  const yearPageHtml = await fetchPage(targetPage.yearPageUrl);
  if (!yearPageHtml) return [];

  const meetings = parseYearPage(yearPageHtml, year, targetPage.yearPageUrl);

  // レート制限: 1秒待機
  await new Promise((r) => setTimeout(r, 1000));

  return meetings;
}
