/**
 * 斜里町議会 — 共通ユーティリティ
 *
 * サイト: http://gikai-sharitown.net/
 * PDF ベースの議事録公開。HTTP のみ（HTTPS は証明書エラー）。
 */

export const BASE_URL = "http://gikai-sharitown.net";

const USER_AGENT =
  "open-gikai-bot/1.0 (https://github.com/matsupiee/open-gikai; contact: please see github)";

const FETCH_TIMEOUT_MS = 30_000;

/**
 * 西暦年から斜里町サイトの年度ページ URL を返す。
 *
 * 年度コード対応:
 *   2018 → h30giji.html
 *   2019 → h31giji.html
 *   2020 → giji.html （令和2年）
 *   2021 → r3giji.html
 *   2022 → r4giji.html
 *   2023 → r5giji.html
 *   2024 → r6giji.html
 *   2025 → r7giji.html
 *
 * 斜里町の「年度」は5月〜翌4月のため、年度の起点年 = 西暦年
 */
export function buildYearPageUrl(year: number): string | null {
  if (year === 2018) return `${BASE_URL}/h30giji.html`;
  if (year === 2019) return `${BASE_URL}/h31giji.html`;
  if (year === 2020) return `${BASE_URL}/giji.html`;
  if (year === 2021) return `${BASE_URL}/r3giji.html`;
  if (year === 2022) return `${BASE_URL}/r4giji.html`;
  if (year === 2023) return `${BASE_URL}/r5giji.html`;
  if (year === 2024) return `${BASE_URL}/r6giji.html`;
  if (year === 2025) return `${BASE_URL}/r7giji.html`;
  return null;
}

/**
 * 令和4年（2022）以降は年度ページのテーブルに直接 PDF リンクが載っている（パターン A）。
 * 令和3年（2021）以前はサブページ（個別会議ページ）へのリンクのみ（パターン B）。
 *
 * 実際のサイト構造:
 *   r4giji.html 以降: 5カラムテーブルの会議録列に kaigiroku PDF リンク直接掲載
 *   r3giji.html 以前: 2カラムテーブルの開催日列に個別会議ページへのリンク
 */
export function isDirectPattern(year: number): boolean {
  return year >= 2022;
}

/** fetch して UTF-8 テキストを返す */
export async function fetchPage(url: string): Promise<string | null> {
  try {
    const res = await fetch(url, {
      headers: { "User-Agent": USER_AGENT },
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    });
    if (!res.ok) {
      console.warn(`[015458-shari] fetchPage failed: ${url} status=${res.status}`);
      return null;
    }
    return await res.text();
  } catch (err) {
    console.warn(
      `[015458-shari] fetchPage error: ${url}`,
      err instanceof Error ? err.message : err,
    );
    return null;
  }
}

/** fetch して ArrayBuffer を返す（PDF ダウンロード用） */
export async function fetchBinary(url: string): Promise<ArrayBuffer | null> {
  try {
    const res = await fetch(url, {
      headers: { "User-Agent": USER_AGENT },
      signal: AbortSignal.timeout(60_000),
    });
    if (!res.ok) {
      console.warn(`[015458-shari] fetchBinary failed: ${url} status=${res.status}`);
      return null;
    }
    return await res.arrayBuffer();
  } catch (err) {
    console.warn(
      `[015458-shari] fetchBinary error: ${url}`,
      err instanceof Error ? err.message : err,
    );
    return null;
  }
}

/**
 * 全角数字を半角数字に変換する。
 */
export function normalizeNumbers(text: string): string {
  return text.replace(/[０-９]/g, (c) =>
    String.fromCharCode(c.charCodeAt(0) - 0xfee0),
  );
}

/**
 * 和暦テキストから西暦年を返す。
 * 「元年」表記にも対応する。
 * e.g., "令和3" → 2021, "平成30" → 2018, "元" (令和) → 2019
 */
export function eraToWesternYear(era: string, yearStr: string): number | null {
  const eraYear = yearStr === "元" ? 1 : parseInt(yearStr, 10);
  if (isNaN(eraYear)) return null;

  if (era === "令和") return eraYear + 2018;
  if (era === "平成") return eraYear + 1988;
  return null;
}

/**
 * 和暦テキスト全体（例: "令和3年5月6日"）から YYYY-MM-DD を返す。
 */
export function parseJapaneseDate(text: string): string | null {
  const normalized = normalizeNumbers(text);
  const match = normalized.match(/(令和|平成)(元|\d+)年(\d+)月(\d+)日/);
  if (!match) return null;

  const year = eraToWesternYear(match[1]!, match[2]!);
  if (!year) return null;

  const month = parseInt(match[3]!, 10);
  const day = parseInt(match[4]!, 10);
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

/**
 * kaigiroku ファイル名から日付を解析する。
 * e.g., "kaigiroku_r3_5_6.pdf" → "2021-05-06"
 * e.g., "kaigiroku_r2_3_4.pdf" → "2020-03-04"
 * e.g., "kaigiroku_h30_9_12.pdf" → "2018-09-12"
 */
export function parseDateFromKaigirokuFilename(filename: string): string | null {
  // kaigiroku_{era}{num}_{month}_{day}.pdf
  const match = filename.match(/kaigiroku_(r|h)(\d+)_(\d+)_(\d+)\.pdf$/i);
  if (!match) return null;

  const eraCode = match[1]!.toLowerCase();
  const eraNum = parseInt(match[2]!, 10);
  const month = parseInt(match[3]!, 10);
  const day = parseInt(match[4]!, 10);

  let year: number;
  if (eraCode === "r") {
    year = eraNum + 2018;
  } else if (eraCode === "h") {
    year = eraNum + 1988;
  } else {
    return null;
  }

  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

/**
 * 6桁の YYMMDD 形式（委員会ファイル名）から YYYY-MM-DD を返す。
 * e.g., "230301_kiroku.pdf" → "2023-03-01"
 * e.g., "220916_kiroku2.pdf" → "2022-09-16"
 * 年の2桁は 18〜 を令和/平成 2000年代として扱う（2018〜2099）
 */
export function parseDateFromKirokuFilename(filename: string): string | null {
  const match = filename.match(/^(\d{2})(\d{2})(\d{2})_kiroku/);
  if (!match) return null;

  const yy = parseInt(match[1]!, 10);
  const mm = parseInt(match[2]!, 10);
  const dd = parseInt(match[3]!, 10);

  // 18 = 2018, 99 = 2099
  const year = 2000 + yy;
  if (year < 2018 || year > 2099) return null;

  return `${year}-${String(mm).padStart(2, "0")}-${String(dd).padStart(2, "0")}`;
}

/** 会議タイプを検出 */
export function detectMeetingType(title: string): string {
  if (title.includes("委員会") || title.includes("協議会")) return "committee";
  if (title.includes("臨時")) return "extraordinary";
  return "plenary";
}

/** HTML タグを除去してプレーンテキストを返す */
export function stripHtml(html: string): string {
  return html.replace(/<[^>]+>/g, "").replace(/&nbsp;/g, " ").trim();
}
