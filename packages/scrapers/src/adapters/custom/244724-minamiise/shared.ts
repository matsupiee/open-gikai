/**
 * 南伊勢町議会 -- 共通ユーティリティ
 *
 * サイト: https://www.town.minamiise.lg.jp/admin/shoshiki/gikaijimu/index.html
 * 自治体コード: 244724
 *
 * 本会議の会議録（議事録本文）はオンライン未公開。
 * 審議結果（議決結果）および一般質問事項 PDF を対象とする。
 */

export const BASE_ORIGIN = "https://www.town.minamiise.lg.jp";

const USER_AGENT =
  "open-gikai-bot/1.0 (https://github.com/matsupiee/open-gikai; contact: please see github)";

const FETCH_TIMEOUT_MS = 30_000;

/**
 * 審議結果インデックスページから年度別ページ ID を取得するための
 * インデックス URL
 */
export const SHINGIKEKKA_INDEX_URL = `${BASE_ORIGIN}/admin/shoshiki/gikaijimu/shingikekka/index.html`;

/**
 * PDF ドキュメント種別
 */
export type DocumentKind = "ippan" | "shingikekka";

/** 会議タイプを検出 */
export function detectMeetingType(title: string): string {
  // 「委員会付託」「委員会報告」等は定例会・臨時会の一場面であり committee ではない
  // 「○○委員会」のように「委員会」が末尾 or 独立した委員会の場合のみ committee とする
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
  // 全角数字を半角に変換してからパース
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
 * インデックスページ HTML から年度別ページへのリンクを抽出する。
 * 対象: /ippan/{数値ID}.html または /shingikekka/{数値ID}.html 形式のリンク
 *
 * 返値: { year: 西暦, url: 絶対 URL }[]
 */
export function extractYearLinks(
  html: string,
  section: "ippan" | "shingikekka"
): Array<{ year: number; url: string }> {
  const results: Array<{ year: number; url: string }> = [];
  const sectionPath = `/admin/shoshiki/gikaijimu/${section}/`;

  // <a href="..."> リンクを全て抽出
  const linkPattern = /<a\s[^>]*href="([^"]+)"[^>]*>([^<]+)<\/a>/gi;
  let m: RegExpExecArray | null;

  while ((m = linkPattern.exec(html)) !== null) {
    const href = m[1]!;
    const linkText = m[2]!.trim();

    // セクションパス配下のリンクのみ処理
    if (!href.includes(sectionPath)) continue;

    // 絶対 URL に変換
    let absoluteUrl: string;
    try {
      absoluteUrl = new URL(href, BASE_ORIGIN).toString();
    } catch {
      continue;
    }

    // リンクテキストから年を取得
    const year = parseWarekiYear(linkText);
    // 平成31年（令和元年）の特殊ケース: "平成31年(2019年)" のような表記も対応
    if (!year) {
      const m2019 = linkText.match(/2019年/);
      if (m2019) {
        results.push({ year: 2019, url: absoluteUrl });
      }
      continue;
    }

    // 重複年度は最初のものを優先
    if (!results.some((r) => r.year === year)) {
      results.push({ year, url: absoluteUrl });
    }
  }

  return results;
}

/**
 * 年度別ページ HTML から PDF リンクを抽出する。
 * href が `//www.town.minamiise.lg.jp/material/files/group/16/*.pdf` 形式
 *
 * 返値: { title: string, pdfUrl: string }[]
 */
export function extractPdfLinks(
  html: string,
  pageUrl: string
): Array<{ title: string; pdfUrl: string }> {
  const results: Array<{ title: string; pdfUrl: string }> = [];
  const pdfPattern = /<a\s[^>]*href="([^"]*\.pdf)"[^>]*>([^<]+)<\/a>/gi;

  let m: RegExpExecArray | null;
  while ((m = pdfPattern.exec(html)) !== null) {
    const href = m[1]!;
    const rawText = m[2]!.replace(/\s+/g, " ").trim();

    // PDF URL を絶対 URL に変換
    // `//example.com/...` 形式（プロトコル相対）も対応
    let absoluteUrl: string;
    try {
      if (href.startsWith("//")) {
        absoluteUrl = `https:${href}`;
      } else {
        absoluteUrl = new URL(href, pageUrl).toString();
      }
    } catch {
      continue;
    }

    // ファイルサイズ表記を除去: "(PDFファイル: 72.6KB)" など
    const title = rawText.replace(/\(PDFファイル[^)]*\)/g, "").trim();
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
