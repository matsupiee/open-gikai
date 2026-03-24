/**
 * 野洲市議会 — 共通ユーティリティ
 *
 * サイト: https://www.city.yasu.lg.jp/gyoseijoho/gikai/teireikai-rinjikaikaigiroku/index.html
 * 自治体コード: 252107
 *
 * 会議録は PDF 形式で年度別に公開。独自 CMS。検索機能なし。
 * インデックスページから年度別ページ URL を収集し、
 * 各年度ページから会議録 PDF リンクを収集する。
 */

export const BASE_ORIGIN = "https://www.city.yasu.lg.jp";
export const INDEX_URL = `${BASE_ORIGIN}/gyoseijoho/gikai/teireikai-rinjikaikaigiroku/index.html`;

const USER_AGENT =
  "open-gikai-bot/1.0 (https://github.com/matsupiee/open-gikai; contact: please see github)";

const FETCH_TIMEOUT_MS = 30_000;

/** 会議タイプを検出 */
export function detectMeetingType(title: string): string {
  if (title.includes("委員会")) return "committee";
  if (title.includes("臨時会") || title.includes("臨時")) return "extraordinary";
  return "plenary";
}

/**
 * 会議タイトルや PDF ファイル名から年を抽出して西暦に変換する。
 *
 * 対応パターン:
 *   令和X年（令和元年=2019）
 *   平成XX年
 */
export function extractYearFromTitle(title: string): number | null {
  // 令和
  const reiwaMatch = title.match(/令和(元|\d+)年/);
  if (reiwaMatch) {
    const nengo = reiwaMatch[1] === "元" ? 1 : parseInt(reiwaMatch[1]!, 10);
    return 2018 + nengo;
  }

  // 平成
  const heiseiMatch = title.match(/平成(\d+)年/);
  if (heiseiMatch) {
    return 1988 + parseInt(heiseiMatch[1]!, 10);
  }

  return null;
}

/**
 * PDF ファイル名から開催日（YYYY-MM-DD）を抽出する。
 *
 * 新形式: r{年号数字}dai{回数}kai_{YYYYMMDD}.pdf
 * 例: r7dai3kai_20250605.pdf → 2025-06-05
 *
 * 抽出できない場合は null を返す。
 */
export function extractHeldOnFromFileName(fileName: string): string | null {
  // _YYYYMMDD.pdf パターン
  const dateMatch = fileName.match(/_(\d{4})(\d{2})(\d{2})\.pdf$/);
  if (dateMatch) {
    return `${dateMatch[1]}-${dateMatch[2]}-${dateMatch[3]}`;
  }
  return null;
}

/**
 * href を絶対 URL に変換する。
 * "//" 始まりや相対パスを正規化する。
 */
export function resolveUrl(href: string): string {
  if (href.startsWith("//")) return `https:${href}`;
  if (href.startsWith("http")) return href;
  if (href.startsWith("/")) return `${BASE_ORIGIN}${href}`;
  return `${BASE_ORIGIN}/${href}`;
}

/** fetch して UTF-8 テキストを返す */
export async function fetchPage(url: string): Promise<string | null> {
  try {
    const res = await fetch(url, {
      headers: { "User-Agent": USER_AGENT },
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    });
    if (!res.ok) {
      console.warn(`fetchPage failed: ${url} status=${res.status}`);
      return null;
    }
    return await res.text();
  } catch (e) {
    console.warn(`fetchPage error: ${url}`, e instanceof Error ? e.message : e);
    return null;
  }
}

/** バイナリデータを取得する */
export async function fetchBinary(url: string): Promise<ArrayBuffer | null> {
  try {
    const res = await fetch(url, {
      headers: { "User-Agent": USER_AGENT },
      signal: AbortSignal.timeout(60_000),
    });
    if (!res.ok) {
      console.warn(`fetchBinary failed: ${url} status=${res.status}`);
      return null;
    }
    return await res.arrayBuffer();
  } catch (e) {
    console.warn(`fetchBinary error: ${url}`, e instanceof Error ? e.message : e);
    return null;
  }
}

/** リクエスト間の待機 */
export function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
