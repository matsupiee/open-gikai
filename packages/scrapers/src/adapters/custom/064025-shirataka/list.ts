/**
 * 白鷹町議会 — list フェーズ
 *
 * 1ページ（1138.htm）に全年度の会議録 PDF リンクが表形式で掲載される。
 * 年度ごとのセクション見出しから会議名を、
 * PDF リンクのテキストや周辺テキストから開催日を取得する。
 */

import { BASE_ORIGIN, fetchPage } from "./shared";

export interface ShiratakaMeeting {
  pdfUrl: string;
  title: string;
  heldOn: string | null;
  sessionName: string;
}

/**
 * 和暦の日付テキストから YYYY-MM-DD を返す。
 * 全角・半角数字の両方に対応する。
 * e.g., "令和７年６月５日" → "2025-06-05"
 * e.g., "R8.2.16" → null（このパターンは別途処理）
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
 * ファイル名パターンから開催日を解析する。
 *
 * パターン1: r{年2桁}-{回数}{種別}-{号}-{月日4桁}.pdf
 *   e.g., "r07-06t-01-1204.pdf" → 令和7年12月4日 → "2025-12-04"
 * パターン2: 会議録R{年}-{回}回（R{年}.{月}.{日}）.pdf
 *   e.g., "会議録R8-2回（R8.2.16）.pdf" → 令和8年2月16日 → "2026-02-16"
 */
export function parseDateFromFilename(filename: string): string | null {
  // パターン2: 日本語ファイル名 "会議録R{年}-{回}回（R{年}.{月}.{日}）.pdf"
  const jpPattern = filename.match(/R(\d+)\.(\d+)\.(\d+)/);
  if (jpPattern) {
    const reiwaYear = parseInt(jpPattern[1]!, 10);
    const month = parseInt(jpPattern[2]!, 10);
    const day = parseInt(jpPattern[3]!, 10);
    const westernYear = reiwaYear + 2018;
    return `${westernYear}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
  }

  // パターン1: "r{年2桁}-{回数}{種別}-{号}-{月日4桁}.pdf"
  // 月日4桁: MMDD
  const enPattern = filename.match(/^r\d{2}-[^-]+-\d{2}-(\d{2})(\d{2})\.pdf$/i);
  if (enPattern) {
    // ファイル名の年部分から西暦を計算
    const yearMatch = filename.match(/^r(\d{2})/i);
    if (!yearMatch) return null;
    const reiwaYear = parseInt(yearMatch[1]!, 10);
    const westernYear = reiwaYear + 2018;
    const month = parseInt(enPattern[1]!, 10);
    const day = parseInt(enPattern[2]!, 10);
    return `${westernYear}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
  }

  return null;
}

/**
 * セクション見出しから会議名を抽出する。
 *
 * 対応パターン:
 *   "令和８年" → "令和８年"
 *   "令和8年" → "令和8年"
 * リンクテキストから詳細会議名を得る。
 */
export function extractSessionName(text: string): string {
  return text.trim().replace(/\s+/g, " ");
}

/**
 * 一覧ページの HTML から PDF リンクとメタ情報を抽出する（テスト可能な純粋関数）。
 *
 * 構造:
 * - 年度ごとの見出しでセクション分け（例: "令和8年", "令和7年"）
 * - 各 PDF は <a href="/secure/{ID}/{ファイル名}.pdf"> でリンク
 * - リンクテキストに会議名（例: "第2回臨時会（会議録R8-2回（R8.2.16）.pdf）"）
 *
 * year が指定された場合、そのカレンダー年に該当する会議録のみ返す。
 */
export function parseListPage(
  html: string,
  year?: number,
): ShiratakaMeeting[] {
  const results: ShiratakaMeeting[] = [];

  // /secure/ 配下の PDF リンクのみ対象
  const linkPattern =
    /<a[^>]+href="(\/secure\/[^"]+\.pdf)"[^>]*>([\s\S]*?)<\/a>/gi;

  for (const match of html.matchAll(linkPattern)) {
    const href = match[1]!;
    // HTML タグを除去してテキストのみ取得
    const linkText = match[2]!.replace(/<[^>]+>/g, "").trim();

    const pdfUrl = `${BASE_ORIGIN}${href}`;

    // ファイル名を取得（URL デコード）
    const encodedFileName = href.split("/").pop() ?? "";
    const fileName = decodeURIComponent(encodedFileName);

    // リンクテキストから日付を抽出（和暦形式）
    let heldOn = parseDateText(linkText);

    // 和暦形式で取れない場合はファイル名から解析
    if (!heldOn) {
      heldOn = parseDateFromFilename(fileName);
    }

    // year フィルタ: カレンダー年で絞り込む
    if (year !== undefined && heldOn) {
      const heldYear = parseInt(heldOn.split("-")[0]!, 10);
      if (heldYear !== year) continue;
    }

    // ファイル名から会議名を抽出（リンクテキストが会議名）
    const cleanLinkText = linkText
      .replace(/\([\d,.]+KB\)/gi, "")
      .replace(/\([\d,.]+MB\)/gi, "")
      .trim();

    // セッション名をリンクテキストから抽出（括弧内のファイル名を除去）
    const sessionName = cleanLinkText
      .replace(/（[^）]*\.pdf[^）]*）/gi, "")
      .replace(/\([^)]*\.pdf[^)]*\)/gi, "")
      .trim() || fileName.replace(/\.pdf$/i, "");

    const title = cleanLinkText || sessionName;

    results.push({ pdfUrl, title, heldOn, sessionName });
  }

  return results;
}

/**
 * 指定年の全 PDF リンクを取得する。
 */
export async function fetchMeetingList(
  baseUrl: string,
  year: number,
): Promise<ShiratakaMeeting[]> {
  const html = await fetchPage(baseUrl);
  if (!html) return [];

  return parseListPage(html, year);
}
