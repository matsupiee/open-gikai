/**
 * 甘楽町議会 — 共通ユーティリティ
 *
 * サイト: https://www.town.kanra.lg.jp/gikai/kaigiroku/index.html
 * 自治体コード: 103845
 */

export const BASE_ORIGIN = "https://www.town.kanra.lg.jp";

/** 会議録トップページ URL */
export const TOP_URL = `${BASE_ORIGIN}/gikai/kaigiroku/index.html`;

const USER_AGENT =
  "open-gikai-bot/1.0 (https://github.com/matsupiee/open-gikai; contact: please see github)";

const FETCH_TIMEOUT_MS = 30_000;

/** 会議タイプを検出 */
export function detectMeetingType(title: string): "plenary" | "extraordinary" | "committee" {
  if (title.includes("委員会")) return "committee";
  if (title.includes("臨時会")) return "extraordinary";
  return "plenary";
}

/** fetch して UTF-8 テキストを返す */
export async function fetchPage(url: string): Promise<string | null> {
  try {
    const res = await fetch(url, {
      headers: { "User-Agent": USER_AGENT },
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    });
    if (!res.ok) return null;
    return await res.text();
  } catch (e) {
    console.warn(`[kanra] fetchPage failed: ${url}`, e);
    return null;
  }
}

/** fetch してバイナリを返す */
export async function fetchBinary(url: string): Promise<ArrayBuffer | null> {
  try {
    const res = await fetch(url, {
      headers: { "User-Agent": USER_AGENT },
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    });
    if (!res.ok) return null;
    return await res.arrayBuffer();
  } catch (e) {
    console.warn(`[kanra] fetchBinary failed: ${url}`, e);
    return null;
  }
}

/**
 * 和暦の年表記から西暦を返す。
 * 例: "令和6年" → 2024, "平成31年" → 2019, "令和元年" → 2019
 */
export function parseWarekiYear(text: string): number | null {
  const reiwa = text.match(/令和(\d+|元)年/);
  if (reiwa?.[1]) {
    const n = reiwa[1] === "元" ? 1 : parseInt(reiwa[1], 10);
    return 2018 + n;
  }

  const heisei = text.match(/平成(\d+|元)年/);
  if (heisei?.[1]) {
    const n = heisei[1] === "元" ? 1 : parseInt(heisei[1], 10);
    return 1988 + n;
  }

  return null;
}

/**
 * 全角数字を半角数字に変換する。
 */
export function toHankaku(str: string): string {
  return str.replace(/[０-９]/g, (ch) =>
    String.fromCharCode(ch.charCodeAt(0) - 0xff10 + 0x30),
  );
}

/**
 * 年度ディレクトリ名から西暦年を返す。
 * "R6" → 2024, "h31" → 2019, "h22" → 2010
 */
export function parseDirYear(dir: string): number | null {
  const reiwa = dir.match(/^R(\d+)$/i);
  if (reiwa?.[1]) {
    return 2018 + parseInt(reiwa[1], 10);
  }

  const heisei = dir.match(/^h(\d+)$/i);
  if (heisei?.[1]) {
    return 1988 + parseInt(heisei[1], 10);
  }

  return null;
}

/**
 * PDF ファイル名から開催日 (YYYY-MM-DD) を抽出する。
 * 複数のファイル名パターンに対応する。
 *
 * 新形式: 20241206mokuji.pdf → 2024-12-06
 *         202412061gou.pdf   → 2024-12-06
 *         20241206.1gou.pdf  → 2024-12-06
 *
 * 中間形式: r06_3t.mokuji.pdf → null (日付不明)
 *           20240906.1gou.pdf  → 2024-09-06
 *
 * 旧形式: kaigi_2203_mokuji.pdf → null (日不明)
 *         kaigi_220309.pdf       → 2022-03-09
 *         20131210.pdf           → 2013-12-10
 *         201312mokuji.pdf       → null (日不明)
 *         20190307-1.pdf         → 2019-03-07
 */
export function parseDateFromPdfFilename(filename: string): string | null {
  // 8桁の日付パターン YYYYMMDD（先頭）
  const yyyymmdd = filename.match(/^(\d{4})(\d{2})(\d{2})[^\/]/);
  if (yyyymmdd) {
    return `${yyyymmdd[1]}-${yyyymmdd[2]}-${yyyymmdd[3]}`;
  }

  // kaigi_YYMMDD.pdf 形式
  const kaigiDate = filename.match(/kaigi_(\d{2})(\d{2})(\d{2})/);
  if (kaigiDate) {
    const yy = parseInt(kaigiDate[1]!, 10);
    const year = yy >= 10 ? 2000 + yy : 2000 + yy;
    return `${year}-${kaigiDate[2]}-${kaigiDate[3]}`;
  }

  return null;
}

/** リクエスト間の待機 */
export function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
