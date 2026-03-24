/**
 * 東峰村議会（福岡県） — 共通ユーティリティ
 *
 * サイト: https://vill.toho-info.com/50000/50400/index.html
 * WordPress ベースの村公式サイト。年度別ページに PDF リンクを掲載。
 */

export const BASE_ORIGIN = "https://vill.toho-info.com";

const USER_AGENT =
  "open-gikai-bot/1.0 (https://github.com/matsupiee/open-gikai; contact: please see github)";

const FETCH_TIMEOUT_MS = 30_000;
const PDF_FETCH_TIMEOUT_MS = 60_000;

/**
 * 年度別一覧ページの URL 一覧。
 * H28〜R5: 数値ディレクトリ（50401〜50408）
 * R6以降: 英字小文字ディレクトリ（r6, r7, r8, ...）
 */
export function buildYearIndexUrls(): { fiscalYear: number; url: string }[] {
  const base = `${BASE_ORIGIN}/50000/50400`;
  return [
    { fiscalYear: 2016, url: `${base}/50401/index.html` }, // H28
    { fiscalYear: 2017, url: `${base}/50402/index.html` }, // H29
    { fiscalYear: 2018, url: `${base}/50403/index.html` }, // H30
    { fiscalYear: 2019, url: `${base}/50404/index.html` }, // R1/H31
    { fiscalYear: 2020, url: `${base}/50405/index.html` }, // R2
    { fiscalYear: 2021, url: `${base}/50406/index.html` }, // R3
    { fiscalYear: 2022, url: `${base}/50407/index.html` }, // R4
    { fiscalYear: 2023, url: `${base}/50408/index.html` }, // R5
    { fiscalYear: 2024, url: `${base}/r6/index.html` },   // R6
    { fiscalYear: 2025, url: `${base}/r7/index.html` },   // R7
    { fiscalYear: 2026, url: `${base}/r8/index.html` },   // R8
  ];
}

/** 会議タイプを検出 */
export function detectMeetingType(title: string): string {
  if (title.includes("臨時")) return "extraordinary";
  if (title.includes("委員")) return "committee";
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

/** fetch して ArrayBuffer を返す（PDF ダウンロード用） */
export async function fetchBinary(url: string): Promise<ArrayBuffer | null> {
  try {
    const res = await fetch(url, {
      headers: { "User-Agent": USER_AGENT },
      signal: AbortSignal.timeout(PDF_FETCH_TIMEOUT_MS),
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

/** 全角数字を半角数字に変換する */
function toHalfWidth(s: string): string {
  return s.replace(/[０-９]/g, (c) =>
    String.fromCharCode(c.charCodeAt(0) - 0xff10 + 0x30),
  );
}

/**
 * 和暦テキストから YYYY-MM-DD を返す。
 * 半角・全角どちらの数字にも対応する。
 * 「令和7年12月9日」→ "2025-12-09"
 * 「令和７年１２月９日」→ "2025-12-09"
 * 「平成28年12月6日」→ "2016-12-06"
 * 複数日程の場合は最初の日付を採用（例:「令和7年12月9日〜11日」→ "2025-12-09"）
 */
export function parseDateText(text: string): string | null {
  // 全角数字を半角に変換してからマッチ
  const normalized = toHalfWidth(text);
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
