/**
 * 熊野町議会（広島県） — 共通ユーティリティ
 *
 * サイト: https://www.town.kumano.hiroshima.jp/www/genre/1436489288629/index.html
 * 自治体コード: 343072
 */

export const BASE_ORIGIN = "https://www.town.kumano.hiroshima.jp";

const USER_AGENT =
  "open-gikai-bot/1.0 (https://github.com/matsupiee/open-gikai; contact: please see github)";

const FETCH_TIMEOUT_MS = 30_000;

/**
 * 年度別記事ページ URL 一覧（ハードコード）
 * 年度 → 記事ページ URL のマッピング
 * 年度は西暦で管理（令和6年度 = 2024 等）
 */
export const YEAR_CONTENT_URLS: ReadonlyArray<{
  year: number;
  contentUrl: string;
}> = [
  { year: 2025, contentUrl: "/www/contents/1751953208630/index.html" },
  { year: 2024, contentUrl: "/www/contents/1710119246226/index.html" },
  { year: 2023, contentUrl: "/www/contents/1679892034278/index.html" },
  { year: 2022, contentUrl: "/www/contents/1647318727561/index.html" },
  { year: 2021, contentUrl: "/www/contents/1618272255975/index.html" },
  { year: 2020, contentUrl: "/www/contents/1584944659318/index.html" },
  { year: 2019, contentUrl: "/www/contents/1553046058421/index.html" },
  { year: 2018, contentUrl: "/www/contents/1520901626175/index.html" },
  { year: 2017, contentUrl: "/www/contents/1495679275703/index.html" },
  { year: 2016, contentUrl: "/www/contents/1461737770532/index.html" },
  { year: 2015, contentUrl: "/www/contents/1432187153540/index.html" },
  { year: 2014, contentUrl: "/www/contents/1409901681058/index.html" },
  { year: 2013, contentUrl: "/www/contents/1409904354152/index.html" },
  { year: 2012, contentUrl: "/www/contents/1409905030458/index.html" },
];

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
    console.warn(`[343072-kumano] fetchPage failed: ${url}`, e);
    return null;
  }
}

/** fetch してバイナリ（ArrayBuffer）を返す */
export async function fetchBinary(url: string): Promise<ArrayBuffer | null> {
  try {
    const res = await fetch(url, {
      headers: { "User-Agent": USER_AGENT },
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    });
    if (!res.ok) return null;
    return await res.arrayBuffer();
  } catch (e) {
    console.warn(`[343072-kumano] fetchBinary failed: ${url}`, e);
    return null;
  }
}

/** 会議タイプを検出 */
export function detectMeetingType(
  title: string
): "plenary" | "extraordinary" | "committee" {
  if (title.includes("全員協議会")) return "committee";
  if (title.includes("特別委員会")) return "committee";
  if (title.includes("臨時会")) return "extraordinary";
  return "plenary";
}

/**
 * 和暦の年表記から西暦を返す。
 * 例: "令和6年" → 2024, "平成30年" → 2018, "令和元年" → 2019
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
 * 月日テキスト（例: "3月5日"）と年からYYYY-MM-DD文字列を生成する。
 */
export function buildDateString(
  year: number,
  monthDay: string
): string | null {
  const m = monthDay.match(/(\d{1,2})月(\d{1,2})日/);
  if (!m) return null;
  const month = parseInt(m[1]!, 10);
  const day = parseInt(m[2]!, 10);
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

/** リクエスト間の待機 */
export function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
