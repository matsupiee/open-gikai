/**
 * 度会町議会 -- 共通ユーティリティ
 *
 * サイト: https://www.town.watarai.lg.jp/category_list.php?frmCd=8-0-0-0-0
 * 自治体コード: 244708
 *
 * 町公式サイト内に年度ごとの PDF ファイルとして掲載されている会議録を対象とする。
 * カテゴリトップから年度別 frmId を取得し、各年度ページから PDF リンクを収集する。
 */

export const BASE_ORIGIN = "https://www.town.watarai.lg.jp";

export const CATEGORY_TOP_URL = `${BASE_ORIGIN}/category_list.php?frmCd=8-0-0-0-0`;

const USER_AGENT =
  "open-gikai-bot/1.0 (https://github.com/matsupiee/open-gikai; contact: please see github)";

const FETCH_TIMEOUT_MS = 30_000;

/**
 * 年度別一覧ページの URL テンプレート
 */
export function buildYearPageUrl(frmId: number): string {
  return `${BASE_ORIGIN}/contents_detail.php?co=cat&frmId=${frmId}&frmCd=8-6-0-0-0`;
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
 * 会議タイトルから会議種別を検出する。
 */
export function detectMeetingType(title: string): string {
  const committeePattern = /委員会(?!付託|報告|審査)/;
  if (committeePattern.test(title)) return "committee";
  if (title.includes("臨時会") || title.includes("臨時")) return "extraordinary";
  return "plenary";
}

/**
 * カテゴリトップページから年度別 frmId を抽出する。
 *
 * 対象リンクパターン: contents_detail.php?co=cat&frmId=(\d+)&frmCd=8-6-0-0-0
 *
 * 返値: frmId のリスト（重複なし）
 */
export function extractFrmIds(html: string): number[] {
  const seen = new Set<number>();
  const results: number[] = [];
  const pattern = /frmId=(\d+)&frmCd=8-6-0-0-0/g;

  let m: RegExpExecArray | null;
  while ((m = pattern.exec(html)) !== null) {
    const id = parseInt(m[1]!, 10);
    if (!seen.has(id)) {
      seen.add(id);
      results.push(id);
    }
  }

  return results;
}

/**
 * 年度別ページ HTML から PDF リンクを抽出する。
 *
 * リンクは相対パス（./cmsfiles/...）で記述されているため、ベース URL と結合して絶対 URL に変換する。
 *
 * 返値: { title: string, pdfUrl: string }[]
 */
export function extractPdfLinks(
  html: string,
  pageUrl: string
): Array<{ title: string; pdfUrl: string }> {
  const results: Array<{ title: string; pdfUrl: string }> = [];
  const pdfPattern = /<a\s[^>]*href="([^"]*\.pdf)"[^>]*>([^<]*)<\/a>/gi;

  let m: RegExpExecArray | null;
  while ((m = pdfPattern.exec(html)) !== null) {
    const href = m[1]!;
    const rawText = m[2]!.replace(/\s+/g, " ").trim();

    // PDF URL を絶対 URL に変換
    let absoluteUrl: string;
    try {
      absoluteUrl = new URL(href, pageUrl).toString();
    } catch {
      continue;
    }

    // PDF ファイルが cmsfiles 配下にあることを確認
    if (!absoluteUrl.includes("/cmsfiles/")) continue;

    const title = rawText || "";
    results.push({ title, pdfUrl: absoluteUrl });
  }

  return results;
}

/**
 * 会議タイトルから回数を抽出する。
 * 例: "第1回定例会" -> 1
 */
export function extractSessionNumber(title: string): number | null {
  const m = title.match(/第(\d+)回/);
  if (m?.[1]) {
    return parseInt(m[1], 10);
  }
  return null;
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
