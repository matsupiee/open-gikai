/**
 * 津幡町議会 — list フェーズ
 *
 * 単一ページ (https://www.town.tsubata.lg.jp/page/1738.html) から
 * 全会議録 PDF リンクとメタ情報を抽出する。
 *
 * ページ構造:
 * - <h2>令和○年津幡町議会　会議録</h2> で年度区切り
 * - <a href="/uploaded/attachment/{id}.pdf">{会議名} [PDFファイル／{サイズ}]</a>（{開催日程}）
 * - ページ冒頭に「速報版」セクションがある場合は速報版として識別
 */

import { BASE_ORIGIN, eraToYear, fetchPage } from "./shared";

export interface TsubataMeeting {
  pdfUrl: string;
  title: string;
  /** 開催開始日 YYYY-MM-DD 形式 */
  heldOn: string | null;
  /** 開催終了日 YYYY-MM-DD 形式（複数日の場合） */
  heldUntil: string | null;
  /** 対応する年度（西暦） */
  year: number;
  /** 速報版かどうか */
  isProvisional: boolean;
}

/**
 * h2 テキストから西暦年を抽出する。
 * 例: "令和7年津幡町議会　会議録" -> 2025
 * 例: "平成21年津幡町議会　会議録" -> 2009
 */
export function parseYearFromH2(h2Text: string): number | null {
  return eraToYear(h2Text);
}

/**
 * リンクテキストから会議名を抽出する（ファイルサイズ情報を除去）。
 * 例: "津幡町議会12月会議 [PDFファイル／1.82MB]" -> "津幡町議会12月会議"
 */
export function cleanTitle(linkText: string): string {
  return linkText
    .replace(/\s*\[PDFファイル[^\]]*\]/g, "")
    .trim();
}

/**
 * 日付文字列 "令和X年Y月Z日" を YYYY-MM-DD に変換する。
 * 例: "令和7年12月4日" -> "2025-12-04"
 */
export function parseDateString(dateStr: string): string | null {
  const match = dateStr.match(/(令和|平成)(元|\d+)年(\d+)月(\d+)日/);
  if (!match) return null;
  const era = match[1]!;
  const eraYear = match[2] === "元" ? 1 : parseInt(match[2]!, 10);
  const year = era === "令和" ? 2018 + eraYear : 1988 + eraYear;
  const month = String(parseInt(match[3]!, 10)).padStart(2, "0");
  const day = String(parseInt(match[4]!, 10)).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

/**
 * 開催日程テキストを開始日・終了日に分解する。
 *
 * パターン:
 *   "（令和7年12月4日～12月11日）" -> { start: "2025-12-04", end: "2025-12-11" }
 *   "（令和8年1月21日）"           -> { start: "2026-01-21", end: null }
 */
export function parseDateRange(
  dateText: string
): { start: string | null; end: string | null } {
  // 括弧内のテキストを取得
  const inner = dateText.replace(/[（）()]/g, "").trim();

  // 開始日を抽出
  const startMatch = inner.match(/((?:令和|平成)(?:元|\d+)年\d+月\d+日)/);
  if (!startMatch) return { start: null, end: null };

  const startDate = parseDateString(startMatch[1]!);
  if (!startDate) return { start: null, end: null };

  // 終了日（〜月日 形式）を抽出
  const endMatch = inner.match(/～(\d+)月(\d+)日/);
  if (endMatch) {
    // 年は開始日から引き継ぐ
    const startYear = startDate.substring(0, 4);
    const endMonth = String(parseInt(endMatch[1]!, 10)).padStart(2, "0");
    const endDay = String(parseInt(endMatch[2]!, 10)).padStart(2, "0");
    return { start: startDate, end: `${startYear}-${endMonth}-${endDay}` };
  }

  return { start: startDate, end: null };
}

/**
 * 一覧ページの HTML から会議録メタ情報を抽出する（テスト可能な純粋関数）。
 *
 * アルゴリズム:
 * 1. HTML を順に走査し、<h2> で年度を更新
 * 2. <h2> 直後の <ul>/<li> 内の PDF リンクを年度と紐付けて収集
 * 3. ページ冒頭の「速報版」セクション内のリンクは isProvisional=true
 *
 * 対象年 (year) が指定された場合はその年のみ返す。
 * 未指定 (0 や undefined) の場合は全件返す。
 */
export function parseListPage(
  html: string,
  targetYear?: number
): TsubataMeeting[] {
  const results: TsubataMeeting[] = [];

  let currentYear: number | null = null;
  let isProvisional = false;

  // h2 タグ、速報版見出し、PDF リンク、リンク後のテキストノードを一括走査
  // パターン:
  //   <h2>...</h2>
  //   PDF a タグ: <a href="/uploaded/attachment/{id}.pdf">...</a>
  //   日程テキスト: （令和X年...） がリンク直後に出現
  const combined =
    /<h2[^>]*>([\s\S]*?)<\/h2>|<a[^>]+href="(\/uploaded\/attachment\/[^"]+\.pdf)"[^>]*>([\s\S]*?)<\/a>([\s\S]*?)(?=<|$)/gi;

  for (const match of html.matchAll(combined)) {
    if (match[1] !== undefined) {
      // <h2> タグ: 年度または速報版セクションを更新
      const h2Text = match[1]!.replace(/<[^>]+>/g, "").trim();
      if (h2Text.includes("速報版")) {
        isProvisional = true;
        // 速報版セクションでは年度を更新しない（リンク内の日付から年度を取得する）
        continue;
      }
      const year = parseYearFromH2(h2Text);
      if (year !== null) {
        currentYear = year;
        isProvisional = false;
      }
    } else if (match[2] !== undefined) {
      // PDF リンク
      const href = match[2]!;
      const linkText = match[3]!.trim();
      const afterText = match[4]!;

      if (!linkText) continue;

      // 速報版セクションで currentYear が未設定の場合、日付テキストから年を推測
      let effectiveYear = currentYear;
      if (effectiveYear === null && isProvisional) {
        const provisionalDateMatch = afterText.match(/（((?:令和|平成)(?:元|\d+)年[^）]*?)）/);
        if (provisionalDateMatch) {
          const parsed = parseDateString(provisionalDateMatch[1]!.split("～")[0]!);
          if (parsed) {
            effectiveYear = parseInt(parsed.substring(0, 4), 10);
          }
        }
      }

      if (effectiveYear === null) continue;
      if (targetYear && effectiveYear !== targetYear) continue;

      const title = cleanTitle(linkText);
      const pdfUrl = `${BASE_ORIGIN}${href}`;

      // 開催日程をリンク直後のテキストから抽出
      const dateMatch = afterText.match(/（((?:令和|平成)(?:元|\d+)年[^）]*?)）/);
      let heldOn: string | null = null;
      let heldUntil: string | null = null;

      if (dateMatch) {
        const dateRange = parseDateRange(`（${dateMatch[1]!}）`);
        heldOn = dateRange.start;
        heldUntil = dateRange.end;
      }

      results.push({
        pdfUrl,
        title,
        heldOn,
        heldUntil,
        year: effectiveYear,
        isProvisional,
      });
    }
  }

  return results;
}

/**
 * 一覧ページを取得して指定年の会議録リストを返す。
 */
export async function fetchMeetingList(
  baseUrl: string,
  year: number
): Promise<TsubataMeeting[]> {
  const html = await fetchPage(baseUrl);
  if (!html) return [];
  return parseListPage(html, year);
}
