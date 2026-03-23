/**
 * 飯綱町議会 — list フェーズ
 *
 * 一覧ページ /gikai/kaigiroku/ から全会議録リンクを取得する。
 * ページネーションなし（全件が単一ページに表示される）。
 *
 * 各リンクは詳細ページ /docs/{ID}.html を指し、
 * 詳細ページから PDF URL を取得する（detail フェーズで実施）。
 */

import { BASE_ORIGIN, eraToWesternYear, fetchPage, toJapaneseEra } from "./shared";

export interface IizunaMeeting {
  /** 詳細ページ URL */
  detailUrl: string;
  /** 会議タイトル（例: "令和7年12月定例会 会議録"） */
  title: string;
  /** 西暦年 */
  year: number | null;
}

/**
 * 一覧ページの HTML から会議録リンクを抽出する（テスト可能な純粋関数）。
 *
 * 構造: <h2><a href="/docs/{ID}.html">令和7年12月定例会 会議録</a></h2>
 */
export function parseListPage(html: string): IizunaMeeting[] {
  const results: IizunaMeeting[] = [];

  // 全角数字→半角に正規化して抽出
  const linkPattern = /<h2><a\s+href="(\/docs\/\d+\.html)">(.+?)<\/a><\/h2>/g;

  for (const match of html.matchAll(linkPattern)) {
    const href = match[1]!;
    const rawTitle = match[2]!.trim();

    // 全角数字→半角に正規化
    const normalizedTitle = rawTitle.replace(/[０-９]/g, (c) =>
      String.fromCharCode(c.charCodeAt(0) - 0xfee0)
    );

    const detailUrl = `${BASE_ORIGIN}${href}`;

    // 和暦年を抽出して西暦に変換
    const eraMatch = normalizedTitle.match(/(令和|平成)(元|\d+)年/);
    let year: number | null = null;
    if (eraMatch) {
      year = eraToWesternYear(eraMatch[1]!, eraMatch[2]!);
    }

    results.push({ detailUrl, title: rawTitle, year });
  }

  return results;
}

/**
 * 詳細ページの HTML から PDF リンクを抽出する（テスト可能な純粋関数）。
 */
export function parseDetailPageForPdf(html: string): string | null {
  const pdfMatch = html.match(/href="(\/fs\/[^"]+\.pdf)"/);
  if (!pdfMatch) return null;
  return `${BASE_ORIGIN}${pdfMatch[1]}`;
}

/**
 * リンクテキストから開催日を推定する。
 * 定例会: "{和暦}年{月}月定例会" → 月情報のみ取得可能（日は不明）
 * 臨時会: "{和暦}年第{N}回（{月}月{日}日）臨時会" → 月日情報を取得可能
 */
export function parseHeldOnFromTitle(title: string): string | null {
  // 全角数字→半角に正規化
  const normalized = title.replace(/[０-９]/g, (c) =>
    String.fromCharCode(c.charCodeAt(0) - 0xfee0)
  );

  // 臨時会: 令和8年第1回（1月16日）臨時会
  const rinjiMatch = normalized.match(
    /(令和|平成)(元|\d+)年第\d+回[（(](\d+)月(\d+)日[）)]臨時会/
  );
  if (rinjiMatch) {
    const year = eraToWesternYear(rinjiMatch[1]!, rinjiMatch[2]!);
    if (!year) return null;
    const month = rinjiMatch[3]!;
    const day = rinjiMatch[4]!;
    return `${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`;
  }

  // 定例会: 令和7年12月定例会 → 月の1日をデフォルトとする
  const teiMatch = normalized.match(/(令和|平成)(元|\d+)年(\d+)月定例会/);
  if (teiMatch) {
    const year = eraToWesternYear(teiMatch[1]!, teiMatch[2]!);
    if (!year) return null;
    const month = teiMatch[3]!;
    return `${year}-${month.padStart(2, "0")}-01`;
  }

  return null;
}

/**
 * 指定年の会議録リンクを取得する。
 */
export async function fetchMeetingList(
  baseUrl: string,
  year: number
): Promise<IizunaMeeting[]> {
  const html = await fetchPage(baseUrl);
  if (!html) return [];

  const allMeetings = parseListPage(html);
  const eraTexts = toJapaneseEra(year);

  // 全角数字→半角に正規化してマッチ
  return allMeetings.filter((m) => {
    const normalizedTitle = m.title.replace(/[０-９]/g, (c) =>
      String.fromCharCode(c.charCodeAt(0) - 0xfee0)
    );
    return eraTexts.some((era) => normalizedTitle.includes(era));
  });
}
