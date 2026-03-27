/**
 * 遊佐町議会 — list フェーズ
 *
 * トップページから年度別リンクを収集し、各年度ページから PDF リンクを取得する。
 * リンクテキスト: 第{回数}遊佐町議会{種別}会（令和{年}年{月}月{日}日開会）
 * PDF URL: /uploads/contents/archive_0000002698_00/{ファイル名}.pdf
 */

import { BASE_ORIGIN, fetchPage } from "./shared";

export interface YuzaMeeting {
  pdfUrl: string;
  title: string;
  heldOn: string | null;
  sessionName: string;
}

/**
 * 和暦テキストから YYYY-MM-DD を返す。
 * 全角・半角数字の両方に対応する。
 * 「元」年に対応（令和元年=2019年、平成元年=1989年）
 *
 * e.g., "令和７年１２月２日開会" → "2025-12-02"
 * e.g., "令和6年12月2日開会"   → "2024-12-02"
 */
export function parseDateText(text: string): string | null {
  // 全角数字を半角に変換
  const normalized = text.replace(/[０-９]/g, (c) =>
    String.fromCharCode(c.charCodeAt(0) - 0xfee0),
  );

  const match = normalized.match(/(令和|平成)(元|\d+)年(\d+)月(\d+)日/);
  if (!match) return null;

  const [, era, eraYearStr, monthStr, dayStr] = match;
  const eraYear = eraYearStr === "元" ? 1 : parseInt(eraYearStr!, 10);
  const month = parseInt(monthStr!, 10);
  const day = parseInt(dayStr!, 10);

  let westernYear: number;
  if (era === "令和") westernYear = eraYear + 2018;
  else if (era === "平成") westernYear = eraYear + 1988;
  else return null;

  return `${westernYear}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

/**
 * トップページの HTML から年度別ページの URL を抽出する（テスト可能な純粋関数）。
 *
 * リンクパターン: /ou/gikai/gikai/{ページ名}.html
 * ただしトップページ自身（pd0223162117.html）は除外する。
 */
export function parseYearPageUrls(html: string): string[] {
  const urls: string[] = [];
  const seen = new Set<string>();

  const linkPattern = /href="(\/ou\/gikai\/gikai\/[^"]+\.html)"/g;
  for (const match of html.matchAll(linkPattern)) {
    const path = match[1]!;
    // トップページ自身を除外
    if (path.includes("pd0223162117")) continue;
    if (seen.has(path)) continue;
    seen.add(path);
    urls.push(`${BASE_ORIGIN}${path}`);
  }

  return urls;
}

/**
 * 年度別ページの HTML から PDF リンクとメタ情報を抽出する（テスト可能な純粋関数）。
 *
 * PDF URL パターン: /uploads/contents/archive_\d+_\d+/{ファイル名}.pdf
 * リンクテキスト: 第{回数}遊佐町議会{種別}会（令和{年}年{月}月{日}日開会）
 *
 * year が指定された場合、そのカレンダー年に該当する会議録のみ返す。
 */
export function parseYearPage(
  html: string,
  year?: number,
): YuzaMeeting[] {
  const results: YuzaMeeting[] = [];

  // PDF リンクを抽出（日本語ファイル名を含む可能性があるため href 内の文字を広く取る）
  // archive ID は年度によって異なるため動的にマッチする（例: archive_0000002698_00, archive_0000002020_00）
  const linkPattern =
    /<a[^>]+href="([^"]*\/uploads\/contents\/archive_\d+_\d+\/[^"]+\.pdf)"[^>]*>([\s\S]*?)<\/a>/gi;

  for (const match of html.matchAll(linkPattern)) {
    const rawHref = match[1]!;
    const linkText = match[2]!.replace(/<[^>]+>/g, "").trim();

    // ファイル名が日本語の場合、URL エンコードが必要
    // パスの各セグメントをエンコード（既にエンコードされている場合はそのまま）
    const pdfUrl = rawHref.startsWith("http")
      ? rawHref
      : `${BASE_ORIGIN}${encodeUriPath(rawHref)}`;

    // リンクテキストから開会日を抽出
    const heldOn = parseDateText(linkText);

    // year フィルタ
    if (year !== undefined) {
      if (!heldOn) continue;
      const heldYear = parseInt(heldOn.split("-")[0]!, 10);
      if (heldYear !== year) continue;
    }

    // セッション名をリンクテキストから抽出
    // e.g., "第583回遊佐町議会定例会（令和7年12月2日開会）" → "第583回遊佐町議会定例会"
    const sessionMatch = linkText.match(/^([^（(]+)/);
    const sessionName = sessionMatch ? sessionMatch[1]!.trim() : linkText;

    results.push({
      pdfUrl,
      title: linkText,
      heldOn,
      sessionName,
    });
  }

  return results;
}

/**
 * URL パスをエンコードする。既にエンコードされている部分はそのまま維持する。
 * 日本語ファイル名を含む場合に対応。
 */
function encodeUriPath(path: string): string {
  return path
    .split("/")
    .map((segment) => {
      // 既にパーセントエンコードされている場合はスキップ
      if (/%[0-9A-Fa-f]{2}/.test(segment)) return segment;
      return encodeURIComponent(segment);
    })
    .join("/");
}

/**
 * 指定年の全 PDF リンクを取得する。
 * トップページ → 年度別ページの順で収集する。
 */
export async function fetchMeetingList(
  topUrl: string,
  year: number,
): Promise<YuzaMeeting[]> {
  const topHtml = await fetchPage(topUrl);
  if (!topHtml) return [];

  const yearPageUrls = parseYearPageUrls(topHtml);
  const results: YuzaMeeting[] = [];

  for (const yearPageUrl of yearPageUrls) {
    const pageHtml = await fetchPage(yearPageUrl);
    if (!pageHtml) continue;

    const meetings = parseYearPage(pageHtml, year);
    results.push(...meetings);

    // rate limiting: 1秒待機
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }

  return results;
}
