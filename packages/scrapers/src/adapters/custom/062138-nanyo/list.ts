/**
 * 南陽市議会 会議録 — list フェーズ
 *
 * トップページ（/gikaikaigiroku/）から年度別ページへのリンクを収集し、
 * 各年度ページから PDF リンクを取得する。
 *
 * 構造:
 *   トップページ
 *   ├── 令和7年会議録（/gikaikaigiroku/5903）
 *   │   ├── ３月定例会会議録（PDF）
 *   │   └── ...
 *   ├── 令和6年会議録（/gikaikaigiroku/5461）
 *   │   └── ...
 *   └── 平成21年会議録（/gikaikaigiroku/215）
 */

import { BASE_URL, INDEX_PATH, fetchPage, parseEraYear } from "./shared";

export interface NanyoMeeting {
  pdfUrl: string;
  title: string;
  heldOn: string | null;
  sessionName: string;
}

/**
 * トップページ HTML から年度別ページ URL を抽出する。
 * URL パターン: /gikaikaigiroku/{数字ID}
 */
export function parseTopPage(
  html: string
): { url: string; year: number }[] {
  const results: { url: string; year: number }[] = [];

  // <a href="/gikaikaigiroku/5903">令和7年会議録</a> のようなリンク
  const linkPattern =
    /<a[^>]+href="(\/gikaikaigiroku\/\d+)"[^>]*>([^<]+)<\/a>/gi;

  for (const match of html.matchAll(linkPattern)) {
    const href = match[1]!;
    const text = match[2]!.trim();

    const year = parseEraYear(text);
    if (!year) continue;

    const url = `${BASE_URL}${href}`;
    // 重複チェック
    if (!results.some((r) => r.url === url)) {
      results.push({ url, year });
    }
  }

  return results;
}

/**
 * PDF ファイル名（日本語）から開催月を推測して heldOn を生成する。
 * e.g., "南陽市議会令和7年12月定例会.pdf" → "2025-12-01" (月の1日で代表)
 *       "南陽市議会令和6年3月定例会.pdf"  → "2024-03-01"
 * 解析できない場合は null を返す。
 */
export function parseDateFromFilename(filename: string): string | null {
  // 令和/平成 + 年 + 月 のパターン
  const match = filename.match(/(令和|平成)(元|\d+)年(\d+)月/);
  if (!match) return null;

  const era = match[1]!;
  const eraYearStr = match[2]!;
  const monthStr = match[3]!;

  const eraYear = eraYearStr === "元" ? 1 : parseInt(eraYearStr, 10);
  const month = parseInt(monthStr, 10);
  if (month < 1 || month > 12) return null;

  let westernYear: number;
  if (era === "令和") {
    westernYear = eraYear + 2018;
  } else {
    westernYear = eraYear + 1988;
  }

  return `${westernYear}-${String(month).padStart(2, "0")}-01`;
}

/**
 * 年度別ページ HTML から PDF リンクを抽出する。
 * PDF パス: /up/files/giyousei/sigikai/gikaikaigiroku/
 */
export function parseYearPage(html: string): NanyoMeeting[] {
  const meetings: NanyoMeeting[] = [];

  // PDF リンクを全て取得
  const pdfPattern =
    /<a[^>]+href="([^"]*\/up\/files\/giyousei\/sigikai\/gikaikaigiroku\/[^"]+\.pdf)"[^>]*>([^<]*)<\/a>/gi;

  for (const match of html.matchAll(pdfPattern)) {
    let href = match[1]!;
    const linkText = match[2]!.trim();

    // 絶対 URL に変換
    if (!href.startsWith("http")) {
      href = `${BASE_URL}${href.startsWith("/") ? "" : "/"}${href}`;
    }

    // URL エンコードされたファイル名をデコードしてセッション名を取得
    const rawFilename = href.split("/").pop() ?? "";
    let filename: string;
    try {
      filename = decodeURIComponent(rawFilename);
    } catch {
      filename = rawFilename;
    }
    const filenameWithoutExt = filename.replace(/\.pdf$/i, "");

    // セッション名を決定（リンクテキストを優先、なければファイル名）
    const sessionName = linkText || filenameWithoutExt;

    // ファイル名から日付を推測する
    const heldOn = parseDateFromFilename(filename);

    // タイトルはリンクテキスト or ファイル名
    const title = sessionName;

    // 重複チェック
    if (meetings.some((m) => m.pdfUrl === href)) continue;

    meetings.push({
      pdfUrl: href,
      title,
      heldOn,
      sessionName,
    });
  }

  return meetings;
}

/**
 * 指定年の全 PDF 一覧を取得する。
 */
export async function fetchMeetingList(
  _baseUrl: string,
  year: number
): Promise<NanyoMeeting[]> {
  const indexUrl = `${BASE_URL}${INDEX_PATH}`;
  const indexHtml = await fetchPage(indexUrl);
  if (!indexHtml) return [];

  const yearPages = parseTopPage(indexHtml);
  const targetPages = yearPages.filter((p) => p.year === year);

  if (targetPages.length === 0) return [];

  const results: NanyoMeeting[] = [];

  for (const { url } of targetPages) {
    const pageHtml = await fetchPage(url);
    if (!pageHtml) continue;

    const meetings = parseYearPage(pageHtml);
    for (const m of meetings) {
      if (!results.some((r) => r.pdfUrl === m.pdfUrl)) {
        results.push(m);
      }
    }
  }

  return results;
}
