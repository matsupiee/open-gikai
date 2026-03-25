/**
 * 玉城町議会 -- 共通ユーティリティ
 *
 * サイト: https://kizuna.town.tamaki.mie.jp/chosei/senkyogikai/gikai/shingi/gijiroku.html
 * 自治体コード: 244619
 */

export const BASE_URL =
  "https://kizuna.town.tamaki.mie.jp/chosei/senkyogikai/gikai/shingi/";

export const INDEX_URL = `${BASE_URL}gijiroku.html`;

const USER_AGENT =
  "open-gikai-bot/1.0 (https://github.com/matsupiee/open-gikai; contact: please see github)";

const FETCH_TIMEOUT_MS = 30_000;

/**
 * 会議タイプを検出する。
 */
export function detectMeetingType(title: string): string {
  const committeePattern = /委員会(?!付託|報告|審査)/;
  if (committeePattern.test(title)) return "committee";
  if (title.includes("臨時会") || title.includes("臨時")) return "extraordinary";
  return "plenary";
}

/**
 * 和暦の年表記から西暦を返す。
 * 例: "令和6年" -> 2024, "令和元年" -> 2019
 */
export function parseWarekiYear(text: string): number | null {
  const normalized = text.replace(
    /[０-９]/g,
    (c) => String.fromCharCode(c.charCodeAt(0) - 0xfee0)
  );

  const reiwa = normalized.match(/令和(\d+|元)年/);
  if (reiwa?.[1]) {
    const n = reiwa[1] === "元" ? 1 : parseInt(reiwa[1], 10);
    return 2018 + n;
  }

  const heisei = normalized.match(/平成(\d+|元)年/);
  if (heisei?.[1]) {
    const n = heisei[1] === "元" ? 1 : parseInt(heisei[1], 10);
    return 1988 + n;
  }

  return null;
}

/**
 * 索引ページ HTML から年度別目次 URL を抽出する。
 * `.html` 拡張子を持つリンクを年度別目次として収集する。
 * BASE_URL 配下のリンクに限定する。
 */
export function extractYearlyTocLinks(html: string): Array<{ url: string }> {
  const results: Array<{ url: string }> = [];
  const linkPattern = /<a\s[^>]*href="([^"]+\.html)"[^>]*>/gi;
  let m: RegExpExecArray | null;

  while ((m = linkPattern.exec(html)) !== null) {
    const href = m[1]!;

    // 索引ページ自体への自己参照は除外
    if (href.includes("gijiroku.html")) continue;

    // 絶対 URL に変換
    let absoluteUrl: string;
    try {
      absoluteUrl = new URL(href, INDEX_URL).toString();
    } catch {
      continue;
    }

    // BASE_URL 配下のリンクのみ対象
    if (!absoluteUrl.startsWith(BASE_URL)) continue;

    // 重複を除外
    if (!results.some((r) => r.url === absoluteUrl)) {
      results.push({ url: absoluteUrl });
    }
  }

  return results;
}

/**
 * 年度別目次ページ HTML から PDF リンクを抽出する。
 * `documents/` 配下の PDF リンクをすべて収集する。
 * リンク周辺のテキスト（h2, li のテキスト）をタイトルとして使用する。
 */
export function extractPdfLinks(
  html: string,
  pageUrl: string
): Array<{ title: string; pdfUrl: string }> {
  const results: Array<{ title: string; pdfUrl: string }> = [];
  const pdfPattern = /<a\s[^>]*href="([^"]*documents\/[^"]*\.pdf)"[^>]*>([^<]*)<\/a>/gi;

  let m: RegExpExecArray | null;
  while ((m = pdfPattern.exec(html)) !== null) {
    const href = m[1]!;
    const rawText = m[2]!.replace(/\s+/g, " ").trim();

    let absoluteUrl: string;
    try {
      absoluteUrl = new URL(href, pageUrl).toString();
    } catch {
      continue;
    }

    // タイトルが空の場合はファイル名から生成
    const title = rawText || new URL(absoluteUrl).pathname.split("/").pop() || "";
    if (!title) continue;

    results.push({ title, pdfUrl: absoluteUrl });
  }

  return results;
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
