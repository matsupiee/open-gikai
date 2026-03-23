/**
 * あさぎり町議会 会議録 — 共通ユーティリティ
 *
 * サイト: https://www.town.asagiri.lg.jp/list00300.html
 *
 * あさぎり町は独自 CMS で PDF ベースの議事録を公開している。
 * 一覧は AJAX ページネーション（hpkijilistpagerhandler.ashx）で取得し、
 * 各詳細ページ（kiji{番号}/index.html）から PDF URL を収集する。
 */

export const BASE_ORIGIN = "https://www.town.asagiri.lg.jp";

const USER_AGENT =
  "open-gikai-bot/1.0 (https://github.com/matsupiee/open-gikai; contact: please see github)";

const FETCH_TIMEOUT_MS = 30_000;

/** 会議タイプを検出 */
export function detectMeetingType(title: string): "plenary" | "committee" | "extraordinary" {
  if (title.includes("委員会")) return "committee";
  if (title.includes("臨時")) return "extraordinary";
  return "plenary";
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

/** fetch して ArrayBuffer を返す（PDF 用） */
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

/**
 * AJAX エンドポイントの URL を組み立てる。
 * pg=1 から始めて、空レスポンスが返るまでインクリメントする。
 */
export function buildAjaxUrl(pg: number): string {
  return `${BASE_ORIGIN}/dynamic/hpkiji/pub/hpkijilistpagerhandler.ashx?c_id=3&class_id=300&class_set_id=1&pg=${pg}&kbn=kijilist&top_id=0`;
}

/**
 * 詳細ページの URL を組み立てる。
 * e.g., kijiId="0035107" → "https://www.town.asagiri.lg.jp/kiji0035107/index.html"
 */
export function buildDetailUrl(kijiId: string): string {
  return `${BASE_ORIGIN}/kiji${kijiId}/index.html`;
}

/**
 * kiji 番号から externalId 用のキーを生成する。
 * e.g., "0035107" → "asagiri_0035107"
 */
export function buildExternalId(kijiId: string): string {
  return `asagiri_${kijiId}`;
}

/**
 * 和暦の日付文字列から YYYY-MM-DD を抽出する。
 * e.g., "令和７年６月１０日（火曜日）～１３日（金曜日）" → "2025-06-10"
 * e.g., "令和８年１月１５日（木曜日）" → "2026-01-15"
 */
export function parseJapaneseDate(text: string): string | null {
  // 全角数字を半角に変換
  const normalized = text.replace(/[０-９]/g, (c) =>
    String.fromCharCode(c.charCodeAt(0) - 0xfee0)
  );

  const match = normalized.match(
    /(令和|平成)(元|\d+)年(\d+)月(\d+)日/
  );
  if (!match) return null;

  const era = match[1];
  const eraYear = match[2] === "元" ? 1 : parseInt(match[2]!, 10);
  const month = parseInt(match[3]!, 10);
  const day = parseInt(match[4]!, 10);

  // 令和元年 = 2019, 平成元年 = 1989
  const westernYear = eraYear + (era === "平成" ? 1988 : 2018);

  return `${westernYear}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

/**
 * 年度（西暦）から対応する和暦年度の文字列を生成する。
 * e.g., 2025 → "令和7年度"
 * 年度の判定: year パラメータは年度の開始年を表す。
 */
export function toFiscalYearLabel(year: number): string {
  const eraYear = year - 2018;
  return `令和${eraYear}年度`;
}
