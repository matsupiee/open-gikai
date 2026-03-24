/**
 * 三戸町議会 — list フェーズ
 *
 * 2段階で PDF リンクを収集する:
 * 1. インデックスページ (index.html) から年度別ページ URL を取得
 * 2. 年度別ページから PDF リンクとメタ情報を抽出
 *
 * HTML 構造:
 *   インデックスページ: .link-item a.icon または .free-layout-area a で年度別ページへのリンク
 *   年度別ページ: p.file-link-item > a.pdf でPDFリンク
 */

import { BASE_ORIGIN, fetchPage, toJapaneseEra } from "./shared";

export interface SannoheMeeting {
  pdfUrl: string;
  title: string;
  heldOn: string | null;
  section: string;
}

/**
 * インデックスページから年度別ページのリンクを抽出する。
 *
 * HTML 構造例:
 *   <a href="/choseijoho/gikai/gikaijouhou/3/5145.html">令和7年会議録</a>
 *   <a href="/choseijoho/gikai/gikaijouhou/3/4758.html">令和6年会議録</a>
 */
export function parseIndexPage(
  html: string,
): { label: string; url: string }[] {
  const results: { label: string; url: string }[] = [];

  const seen = new Set<string>();

  // choseijoho/gikai/gikaijouhou/3/{数字ID}.html パターンのリンクを取得（絶対URL・相対パス両対応）
  const linkRegex =
    /<a[^>]+href="([^"]*choseijoho\/gikai\/gikaijouhou\/3\/(\d+)\.html)"[^>]*>([\s\S]*?)<\/a>/gi;

  for (const match of html.matchAll(linkRegex)) {
    const href = match[1]!;
    const label = match[3]!.replace(/<[^>]+>/g, "").trim();

    let url: string;
    if (href.startsWith("https://") || href.startsWith("http://")) {
      url = href;
    } else if (href.startsWith("//")) {
      url = `https:${href}`;
    } else if (href.startsWith("/")) {
      url = `${BASE_ORIGIN}${href}`;
    } else {
      url = `${BASE_ORIGIN}/${href}`;
    }

    // 重複除外
    if (seen.has(url)) continue;
    seen.add(url);

    results.push({ label, url });
  }

  return results;
}

/**
 * PDFリンクテキストから開催日を抽出する。
 *
 * パターン例:
 *   "第521回三戸町議会定例会（令和6年12月議会）会議録"
 *   "第515回三戸町議会臨時会（令和6年1月29日議会）会議録"
 *
 * 月議会の場合は月の1日を使用する。
 * 具体的な日付がある場合はその日を使用する。
 */
export function parseDateFromText(text: string): string | null {
  // "令和6年1月29日" のような具体的な日付
  const dateMatch = text.match(/(令和|平成)(元|\d+)年(\d+)月(\d+)日/);
  if (dateMatch) {
    const [, era, eraYearStr, monthStr, dayStr] = dateMatch;
    const eraYear = eraYearStr === "元" ? 1 : parseInt(eraYearStr!, 10);
    const month = parseInt(monthStr!, 10);
    const day = parseInt(dayStr!, 10);

    let westernYear: number;
    if (era === "令和") westernYear = eraYear + 2018;
    else if (era === "平成") westernYear = eraYear + 1988;
    else return null;

    return `${westernYear}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
  }

  // "令和6年12月議会" のような月のみの日付 → 月の1日を使用
  const monthMatch = text.match(/(令和|平成)(元|\d+)年(\d+)月議会/);
  if (monthMatch) {
    const [, era, eraYearStr, monthStr] = monthMatch;
    const eraYear = eraYearStr === "元" ? 1 : parseInt(eraYearStr!, 10);
    const month = parseInt(monthStr!, 10);

    let westernYear: number;
    if (era === "令和") westernYear = eraYear + 2018;
    else if (era === "平成") westernYear = eraYear + 1988;
    else return null;

    return `${westernYear}-${String(month).padStart(2, "0")}-01`;
  }

  return null;
}

/**
 * PDFリンクテキストからメタデータを抽出する。
 *
 * パターン例:
 *   "第521回三戸町議会定例会（令和6年12月議会）会議録"
 *   "第519回三戸町議会定例会（決算特別委員会）会議録"
 *   "第515回三戸町議会臨時会（令和6年1月29日議会）会議録"
 */
export function parseLinkMeta(text: string): {
  session: string;
  meetingKind: string;
  heldOn: string | null;
} | null {
  // 回次
  const sessionMatch = text.match(/第(\d+)回/);
  if (!sessionMatch) return null;
  const session = `第${sessionMatch[1]}回`;

  // 会議種別
  let meetingKind = "定例会";
  if (text.includes("臨時会")) {
    meetingKind = "臨時会";
  } else if (text.includes("決算特別委員会")) {
    meetingKind = "決算特別委員会";
  } else if (text.includes("予算特別委員会")) {
    meetingKind = "予算特別委員会";
  } else if (text.includes("特別委員会")) {
    meetingKind = "特別委員会";
  }

  const heldOn = parseDateFromText(text);

  return { session, meetingKind, heldOn };
}

/**
 * 年度別ページの HTML から PDF リンクを抽出する（テスト可能な純粋関数）。
 *
 * HTML 構造:
 *   <p class="file-link-item">
 *     <a class="pdf" href="//www.town.sannohe.aomori.jp/material/files/group/13/521kaigiroku.pdf">
 *       第521回三戸町議会定例会（令和6年12月議会）会議録 (PDFファイル: 665.5KB)
 *     </a>
 *   </p>
 */
export function parseYearPage(html: string): SannoheMeeting[] {
  const results: SannoheMeeting[] = [];

  // p.file-link-item > a.pdf セレクタに相当するパターンを抽出
  const blockPattern = /<p[^>]*class="[^"]*file-link-item[^"]*"[^>]*>([\s\S]*?)<\/p>/gi;

  for (const blockMatch of html.matchAll(blockPattern)) {
    const blockContent = blockMatch[1]!;

    // a.pdf タグを抽出
    const linkPattern = /<a[^>]*class="[^"]*pdf[^"]*"[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/i;
    const linkMatch = blockContent.match(linkPattern);
    if (!linkMatch) continue;

    const href = linkMatch[1]!;
    const linkText = linkMatch[2]!.replace(/<[^>]+>/g, "").replace(/\(PDFファイル[^)]*\)/g, "").trim();

    const meta = parseLinkMeta(linkText);
    if (!meta) continue;

    // プロトコル相対URLに https: を付与
    let pdfUrl: string;
    if (href.startsWith("//")) {
      pdfUrl = `https:${href}`;
    } else if (href.startsWith("http")) {
      pdfUrl = href;
    } else if (href.startsWith("/")) {
      pdfUrl = `${BASE_ORIGIN}${href}`;
    } else {
      pdfUrl = `${BASE_ORIGIN}/${href}`;
    }

    const title = `${meta.meetingKind} ${meta.session}`;

    results.push({
      pdfUrl,
      title,
      heldOn: meta.heldOn,
      section: meta.meetingKind,
    });
  }

  return results;
}

/**
 * 指定年の全 PDF リンクを取得する。
 */
export async function fetchMeetingList(
  baseUrl: string,
  year: number,
): Promise<SannoheMeeting[]> {
  // Step 1: インデックスページから年度別ページのリンクを取得
  const indexHtml = await fetchPage(baseUrl);
  if (!indexHtml) return [];

  const yearPages = parseIndexPage(indexHtml);
  const eraTexts = toJapaneseEra(year);

  // 対象年度のページを見つける
  const targetPage = yearPages.find((p) =>
    eraTexts.some((era) => p.label.includes(era)),
  );
  if (!targetPage) return [];

  // Step 2: 年度別ページから PDF リンクを抽出
  const yearHtml = await fetchPage(targetPage.url);
  if (!yearHtml) return [];

  return parseYearPage(yearHtml);
}
