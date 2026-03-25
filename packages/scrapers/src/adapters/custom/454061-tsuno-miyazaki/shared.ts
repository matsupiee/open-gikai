/**
 * 都農町議会 — 共通ユーティリティ
 *
 * サイト: https://www.town.tsuno.lg.jp/
 * SPA（Angular）+ Azure Blob Storage による PDF 公開。
 * バックエンド REST API を直接叩いて PDF URL を取得する。
 */

export const API_URL =
  "https://www.town.tsuno.lg.jp/prd/tno/portal/openapi/v1/article/detail/retrieve";

export const ARTICLE_IDS = [
  "61a84c6d87decd0dbb681baa", // 令和元年度以降
  "61a84ef987decd0dbb681c31", // 平成30年度以前
];

const USER_AGENT =
  "open-gikai-bot/1.0 (https://github.com/matsupiee/open-gikai; contact: please see github)";

const FETCH_TIMEOUT_MS = 30_000;
const PDF_FETCH_TIMEOUT_MS = 60_000;

/** 会議タイプを検出 */
export function detectMeetingType(title: string): string {
  if (title.includes("臨時")) return "extraordinary";
  return "plenary";
}

/** fetch して JSON を返す */
export async function fetchArticle(articleId: string): Promise<unknown | null> {
  try {
    const res = await fetch(API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "User-Agent": USER_AGENT,
      },
      body: JSON.stringify({
        tenantId: "2",
        siteId: "201",
        langCode: "JPN",
        pageId: "PTARS51",
        articleId,
      }),
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    });
    if (!res.ok) {
      console.warn(
        `[454061-tsuno-miyazaki] fetchArticle failed: ${articleId} status=${res.status}`
      );
      return null;
    }
    return await res.json();
  } catch (e) {
    console.warn(
      `[454061-tsuno-miyazaki] fetchArticle error: ${articleId}`,
      e instanceof Error ? e.message : e
    );
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
      console.warn(
        `[454061-tsuno-miyazaki] fetchBinary failed: ${url} status=${res.status}`
      );
      return null;
    }
    return await res.arrayBuffer();
  } catch (e) {
    console.warn(
      `[454061-tsuno-miyazaki] fetchBinary error: ${url}`,
      e instanceof Error ? e.message : e
    );
    return null;
  }
}

/**
 * 見出し（textType: "T1"）から年（西暦）を抽出する。
 *
 * パターン例:
 *   "令和7年定例会会議録" → 2025
 *   "令和元年定例会会議録" → 2019
 *   "平成31年・令和元年 定例会会議録" → 2019
 *   "平成21年定例会会議録" → 2009
 */
export function extractYearFromHeading(heading: string): number | null {
  // 令和
  const reiwaMatch = heading.match(/令和(\d+|元)年/);
  if (reiwaMatch) {
    const yr = reiwaMatch[1] === "元" ? 1 : parseInt(reiwaMatch[1]!, 10);
    return 2018 + yr;
  }

  // 平成
  const heiseiMatch = heading.match(/平成(\d+|元)年/);
  if (heiseiMatch) {
    const yr = heiseiMatch[1] === "元" ? 1 : parseInt(heiseiMatch[1]!, 10);
    return 1988 + yr;
  }

  return null;
}

/**
 * リンクラベル（linkDisplayName）から回数と種別を抽出する。
 *
 * パターン例:
 *   "令和7年第1回定例会（PDFファイル）" → { session: 1, type: "定例会", year: 2025 }
 *   "第1回定例会(PDFファイル)" → { session: 1, type: "定例会", year: null }
 *   "第2回臨時会" → { session: 2, type: "臨時会", year: null }
 */
export function parseLinkLabel(label: string): {
  session: number | null;
  meetingKind: string | null;
  labelYear: number | null;
} {
  // ラベル内の年を抽出
  let labelYear: number | null = null;
  const reiwaMatch = label.match(/令和(\d+|元)年/);
  if (reiwaMatch) {
    const yr = reiwaMatch[1] === "元" ? 1 : parseInt(reiwaMatch[1]!, 10);
    labelYear = 2018 + yr;
  } else {
    const heiseiMatch = label.match(/平成(\d+|元)年/);
    if (heiseiMatch) {
      const yr = heiseiMatch[1] === "元" ? 1 : parseInt(heiseiMatch[1]!, 10);
      labelYear = 1988 + yr;
    }
  }

  const match = label.match(/第(\d+)回(定例会|臨時会)/);
  if (!match) {
    return { session: null, meetingKind: null, labelYear };
  }

  return {
    session: parseInt(match[1]!, 10),
    meetingKind: match[2]!,
    labelYear,
  };
}

/**
 * 西暦年から和暦表記を生成する。
 * e.g., 2025 → "令和7年", 2019 → "令和元年", 2009 → "平成21年"
 */
export function toEraString(year: number): string {
  if (year >= 2019) {
    const rYear = year - 2018;
    return rYear === 1 ? "令和元年" : `令和${rYear}年`;
  } else if (year >= 1989) {
    const eraYear = year - 1988;
    return eraYear === 1 ? "平成元年" : `平成${eraYear}年`;
  }
  return `${year}年`;
}

/**
 * PDF URL から externalId 用キーを抽出する。
 * Azure Blob Storage URL のファイル名部分（URL デコード後）を使用。
 */
export function extractExternalIdKey(pdfUrl: string): string | null {
  try {
    const url = new URL(pdfUrl);
    const segments = url.pathname.split("/");
    const filename = segments[segments.length - 1];
    if (!filename) return null;
    const decoded = decodeURIComponent(filename);
    return decoded.replace(/\.pdf$/i, "").trim();
  } catch {
    return null;
  }
}
