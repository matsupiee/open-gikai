/**
 * 飯塚市議会スクレイパー — list フェーズ
 *
 * 1. list18.html から年度別ページ URL を取得
 * 2. 対象年度ページから会議詳細ページのリンク一覧を取得
 */

const USER_AGENT =
  "open-gikai-bot/1.0 (https://github.com/matsupiee/open-gikai; contact: please see github)";

const BASE_ORIGIN = "https://www.city.iizuka.lg.jp";

export interface IizukaYearPage {
  /** 西暦年度（例: 2024） */
  nendo: number;
  /** 年度ページの絶対 URL */
  url: string;
}

export interface IizukaMeetingLink {
  /** 会議名（例: "第2回定例会(令和6年6月開催)"） */
  title: string;
  /** 詳細ページの絶対 URL */
  url: string;
  /** 詳細ページの記事 ID（例: "2360"） */
  pageId: string;
}

/**
 * list18.html から全年度ページの URL を取得する。
 */
export async function fetchYearPages(
  baseUrl: string
): Promise<IizukaYearPage[]> {
  const indexUrl = `${baseUrl.replace(/\/$/, "")}/list18.html`;

  const res = await fetch(indexUrl, {
    headers: { "User-Agent": USER_AGENT },
  });
  if (!res.ok) return [];

  const html = await res.text();
  return parseYearPages(html);
}

/**
 * 年度別ページから会議詳細ページへのリンクを取得する。
 */
export async function fetchMeetingLinks(
  yearPageUrl: string
): Promise<IizukaMeetingLink[]> {
  const res = await fetch(yearPageUrl, {
    headers: { "User-Agent": USER_AGENT },
  });
  if (!res.ok) return [];

  const html = await res.text();
  return parseMeetingLinks(html);
}

// --- 内部ユーティリティ ---

/**
 * 和暦の年度名を西暦に変換する。
 * 例: "令和7年度" → 2025, "平成30年度" → 2018, "令和元年度" → 2019
 */
/** @internal テスト用にexport */
export function parseNendo(text: string): number | null {
  const reiwa = text.match(/令和(\d+|元)年度/);
  if (reiwa?.[1]) {
    const n = reiwa[1] === "元" ? 1 : parseInt(reiwa[1], 10);
    return 2018 + n;
  }

  const heisei = text.match(/平成(\d+|元)年度/);
  if (heisei?.[1]) {
    const n = heisei[1] === "元" ? 1 : parseInt(heisei[1], 10);
    return 1988 + n;
  }

  return null;
}

/** @internal テスト用にexport */
export function parseYearPages(
  html: string
): IizukaYearPage[] {
  const pages: IizukaYearPage[] = [];

  // <a href="/site/shigikai/list18-63.html">令和7年度</a> パターン
  const pattern =
    /<a\s[^>]*href="(\/site\/shigikai\/list18-(\d+)\.html)"[^>]*>([^<]+)<\/a>/gi;

  let m: RegExpExecArray | null;
  while ((m = pattern.exec(html)) !== null) {
    const path = m[1]!;
    const linkText = m[3]!.trim();
    const nendo = parseNendo(linkText);
    if (nendo !== null) {
      pages.push({
        nendo,
        url: `${BASE_ORIGIN}${path}`,
      });
    }
  }

  return pages;
}

/** @internal テスト用にexport */
export function parseMeetingLinks(html: string): IizukaMeetingLink[] {
  const links: IizukaMeetingLink[] = [];
  const seen = new Set<string>();

  // <a href="/site/shigikai/2360.html">第2回定例会(令和6年6月開催)</a>
  // list18-*.html や list18.html 自体へのリンクは除外
  const pattern =
    /<a\s[^>]*href="\/site\/shigikai\/(\d+)\.html"[^>]*>([^<]+)<\/a>/gi;

  let m: RegExpExecArray | null;
  while ((m = pattern.exec(html)) !== null) {
    const pageId = m[1]!;
    const title = m[2]!.replace(/\s+/g, " ").trim();

    if (seen.has(pageId)) continue;
    seen.add(pageId);

    links.push({
      title,
      url: `${BASE_ORIGIN}/site/shigikai/${pageId}.html`,
      pageId,
    });
  }

  return links;
}

/**
 * 対象年の年度ページ URL を返す。
 * 日本の年度は4月始まりのため、year=2024 → 2024年度のページを返す。
 */
export function findYearPageUrl(
  yearPages: IizukaYearPage[],
  year: number
): string | null {
  const match = yearPages.find((p) => p.nendo === year);
  return match?.url ?? null;
}
