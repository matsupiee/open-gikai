/**
 * 土庄町議会 — 共通ユーティリティ
 *
 * サイト: https://www.town.tonosho.kagawa.jp/gyosei/soshiki/gikai/chogikai/kaigiroku/index.html
 * 土庄町は Smart CMS による HTML 公開で PDF ベースの議事録を提供する。
 */

export const BASE_ORIGIN = "https://www.town.tonosho.kagawa.jp";

/** 年度別 URL マッピング（令和2年以前は数字 ID 形式） */
export const LEGACY_YEAR_URLS: Record<number, string> = {
  2020: `${BASE_ORIGIN}/gyosei/soshiki/gikai/chogikai/kaigiroku/1578.html`,
  2019: `${BASE_ORIGIN}/gyosei/soshiki/gikai/chogikai/kaigiroku/178.html`,
  2018: `${BASE_ORIGIN}/gyosei/soshiki/gikai/chogikai/kaigiroku/209.html`,
  2017: `${BASE_ORIGIN}/gyosei/soshiki/gikai/chogikai/kaigiroku/210.html`,
  2016: `${BASE_ORIGIN}/gyosei/soshiki/gikai/chogikai/kaigiroku/212.html`,
  2015: `${BASE_ORIGIN}/gyosei/soshiki/gikai/chogikai/kaigiroku/214.html`,
  2014: `${BASE_ORIGIN}/gyosei/soshiki/gikai/chogikai/kaigiroku/215.html`,
  2013: `${BASE_ORIGIN}/gyosei/soshiki/gikai/chogikai/kaigiroku/216.html`,
  2012: `${BASE_ORIGIN}/gyosei/soshiki/gikai/chogikai/kaigiroku/217.html`,
  2011: `${BASE_ORIGIN}/gyosei/soshiki/gikai/chogikai/kaigiroku/218.html`,
};

const USER_AGENT =
  "open-gikai-bot/1.0 (https://github.com/matsupiee/open-gikai; contact: please see github)";

const FETCH_TIMEOUT_MS = 30_000;

/** 会議タイプを検出 */
export function detectMeetingType(title: string): string {
  if (title.includes("臨時")) return "extraordinary";
  if (title.includes("委員会")) return "committee";
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
  } catch (err) {
    console.warn(
      `[373222-tonosho] fetch 失敗: ${url}`,
      err instanceof Error ? err.message : err
    );
    return null;
  }
}

/** fetch して ArrayBuffer を返す（PDF ダウンロード用） */
export async function fetchBinary(url: string, referer?: string): Promise<ArrayBuffer | null> {
  try {
    const res = await fetch(url, {
      headers: {
        "User-Agent": USER_AGENT,
        ...(referer ? { Referer: referer } : {}),
      },
      signal: AbortSignal.timeout(60_000),
    });
    if (!res.ok) return null;
    return await res.arrayBuffer();
  } catch (err) {
    console.warn(
      `[373222-tonosho] fetchBinary 失敗: ${url}`,
      err instanceof Error ? err.message : err
    );
    return null;
  }
}

/**
 * 和暦テキスト（「令和N年」「平成N年」）を西暦に変換する。
 */
export function warekiToYear(text: string): number | null {
  const reiwaMatch = text.match(/令和(\d+|元)年/);
  if (reiwaMatch) {
    const n = reiwaMatch[1] === "元" ? 1 : parseInt(reiwaMatch[1]!, 10);
    return 2018 + n;
  }
  const heiseiMatch = text.match(/平成(\d+|元)年/);
  if (heiseiMatch) {
    const n = heiseiMatch[1] === "元" ? 1 : parseInt(heiseiMatch[1]!, 10);
    return 1988 + n;
  }
  return null;
}

/**
 * 月のテキストから YYYY-MM-DD 形式の日付文字列を返す。
 * 日がない場合は 01 を使う。
 */
export function buildHeldOn(year: number, monthText: string, dayText?: string): string {
  const monthMatch = monthText.match(/(\d{1,2})月/);
  if (!monthMatch) return `${year}-01-01`;
  const month = parseInt(monthMatch[1]!, 10);
  if (dayText) {
    const dayMatch = dayText.match(/(\d{1,2})日/);
    if (dayMatch) {
      const day = parseInt(dayMatch[1]!, 10);
      return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    }
  }
  return `${year}-${String(month).padStart(2, "0")}-01`;
}

/**
 * PDF URL パスから externalId 用のキーを抽出する。
 * e.g., "/material/files/group/13/gikai7-6-1.pdf" → "gikai7-6-1"
 */
export function extractExternalIdKey(pdfPath: string): string | null {
  const match = pdfPath.match(/\/([^/]+)\.pdf$/i);
  if (!match) return null;
  return match[1]!;
}

/**
 * 相対 URL を絶対 URL に変換する。
 */
export function toAbsoluteUrl(href: string, basePageUrl: string): string {
  if (href.startsWith("http://") || href.startsWith("https://")) {
    // HTTP を HTTPS に統一
    return href.replace(/^http:\/\//, "https://");
  }
  if (href.startsWith("/")) {
    return `${BASE_ORIGIN}${href}`;
  }
  // 相対パス
  const base = basePageUrl.replace(/\/[^/]+$/, "/");
  return `${base}${href}`;
}
