/**
 * 紀北町議会 -- 共通ユーティリティ
 *
 * サイト: https://www.town.mie-kihoku.lg.jp/kakuka/gikai/kaigiroku/index.html
 * 自治体コード: 245437
 */

export const BASE_ORIGIN = "https://www.town.mie-kihoku.lg.jp";

const USER_AGENT =
  "open-gikai-bot/1.0 (https://github.com/matsupiee/open-gikai; contact: please see github)";

const FETCH_TIMEOUT_MS = 30_000;

/**
 * 年度（西暦）→ WordPress 投稿 URL のハードコードマップ。
 * 動的収集より安定性を優先してハードコードする。
 * 新年度追加時はカテゴリページを確認して追記すること。
 */
export const YEAR_POST_URLS: Record<number, string> = {
  2025: `${BASE_ORIGIN}/2025/06/12/8857/`,
  2024: `${BASE_ORIGIN}/2024/07/12/570/`,
  2023: `${BASE_ORIGIN}/2024/04/09/568/`,
  2021: `${BASE_ORIGIN}/2022/08/19/536/`,
  2020: `${BASE_ORIGIN}/2022/08/19/540/`,
  2019: `${BASE_ORIGIN}/2022/08/19/538/`,
  2018: `${BASE_ORIGIN}/2022/08/19/532/`,
  2017: `${BASE_ORIGIN}/2022/08/19/542/`,
  2016: `${BASE_ORIGIN}/2022/12/20/544/`,
  2015: `${BASE_ORIGIN}/2022/12/20/546/`,
  2014: `${BASE_ORIGIN}/2022/12/20/548/`,
  2013: `${BASE_ORIGIN}/2022/12/20/550/`,
  2012: `${BASE_ORIGIN}/2022/12/20/552/`,
  2011: `${BASE_ORIGIN}/2022/12/20/554/`,
  2010: `${BASE_ORIGIN}/2022/12/20/556/`,
  2009: `${BASE_ORIGIN}/2022/12/20/558/`,
  2008: `${BASE_ORIGIN}/2022/12/20/560/`,
  2007: `${BASE_ORIGIN}/2022/12/20/562/`,
  2006: `${BASE_ORIGIN}/2022/12/20/564/`,
  2005: `${BASE_ORIGIN}/2022/12/20/566/`,
};

/**
 * 令和4年（2022年）は令和5年カテゴリページと別途確認が必要。
 * 調査の結果、令和4年分の投稿 URL を別途定義。
 */
export const REIWA4_POST_URL = `${BASE_ORIGIN}/2022/10/13/571/`;

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
 * 例: "令和6年" -> 2024, "令和元年" -> 2019（全角数字も対応）
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
 * リンクテキストから開催月日を抽出する。
 * 例: "「3月定例会（開会・提案説明）」" → { month: 3 }
 *     "「令和6年第1回臨時会」" → null (日付不明)
 */
export function parseMeetingMonth(text: string): number | null {
  const m = text.match(/(\d{1,2})月/);
  if (m?.[1]) return parseInt(m[1], 10);
  return null;
}

/**
 * 参考資料 PDF を除外するフィルタ。
 * 「会期日程」「議事日程」「応招」「不応招」を含むリンクテキストはスキップ。
 */
export function isSkipTarget(linkText: string): boolean {
  return (
    linkText.includes("会期日程") ||
    linkText.includes("議事日程") ||
    linkText.includes("応招") ||
    linkText.includes("不応招")
  );
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
