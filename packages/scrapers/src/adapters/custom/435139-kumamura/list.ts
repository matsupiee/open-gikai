/**
 * 球磨村議会 会議録 — list フェーズ
 *
 * 一覧ページと AJAX エンドポイントから全会議録の kiji 番号・タイトルを収集し、
 * 各詳細ページから PDF URL と開催日を取得する。
 *
 * 構造:
 *   一覧ページ (list00249.html)
 *   ├── <li><a href="/kiji{番号}/index.html">タイトル</a></li>
 *   └── AJAX (hpkijilistpagerhandler.ashx?pg={N}) で追加エントリを返す
 *
 *   詳細ページ (kiji{番号}/index.html)
 *   └── <a href="*.pdf">PDF ダウンロード</a>
 */

import {
  BASE_ORIGIN,
  buildAjaxUrl,
  buildDetailUrl,
  fetchPage,
  parseJapaneseDate,
} from "./shared";

export interface KumamuraMeeting {
  /** kiji 番号 (e.g., "0035000") */
  kijiId: string;
  /** 会議タイトル (e.g., "令和６年第８回定例会　会議録") */
  title: string;
  /** PDF の絶対 URL */
  pdfUrls: string[];
  /** 開催日 YYYY-MM-DD */
  heldOn: string;
}

/**
 * 一覧 HTML（初期ページまたは AJAX レスポンス）から kiji リンクを抽出する。
 * 返り値: { kijiId, title }[]
 */
export function parseListPage(html: string): { kijiId: string; title: string }[] {
  const results: { kijiId: string; title: string }[] = [];

  // /kiji{番号}/index.html のリンクを抽出
  const linkRegex =
    /<a[^>]+href="[^"]*\/kiji(\d+)\/index\.html"[^>]*>([^<]+)<\/a>/gi;

  for (const match of html.matchAll(linkRegex)) {
    const kijiId = match[1];
    const title = match[2]?.trim();
    if (!kijiId || !title) continue;

    // 重複チェック
    if (results.some((r) => r.kijiId === kijiId)) continue;

    results.push({ kijiId, title });
  }

  return results;
}

/**
 * 詳細ページ HTML から全 PDF URL と開催日を抽出する。
 * 球磨村の詳細ページには複数の PDF（審議結果・各日程）が含まれる。
 */
export function parseDetailPage(html: string): {
  pdfUrls: string[];
  heldOn: string | null;
} {
  // 全 PDF リンクを抽出
  const pdfRegex = /<a[^>]+href="([^"]+\.pdf)"[^>]*>/gi;
  const pdfUrls: string[] = [];

  for (const match of html.matchAll(pdfRegex)) {
    const href = match[1];
    if (!href) continue;

    const url = href.startsWith("http")
      ? href
      : `${BASE_ORIGIN}${href.startsWith("/") ? "" : "/"}${href}`;

    if (!pdfUrls.includes(url)) {
      pdfUrls.push(url);
    }
  }

  // 開催日を抽出: 和暦の日付パターン
  const heldOn = parseJapaneseDate(html);

  return { pdfUrls, heldOn };
}

/**
 * タイトルから年を抽出する（西暦）。
 * e.g., "令和６年第８回定例会　会議録" → 2024
 * e.g., "令和３年第６回臨時会　会議録" → 2021
 */
export function extractYearFromTitle(title: string): number | null {
  // 全角数字を半角に変換
  const normalized = title.replace(/[０-９]/g, (c) =>
    String.fromCharCode(c.charCodeAt(0) - 0xfee0)
  );

  const match = normalized.match(/(令和|平成)(元|\d+)年/);
  if (!match) return null;

  const era = match[1];
  const eraYear = match[2] === "元" ? 1 : parseInt(match[2]!, 10);

  return eraYear + (era === "平成" ? 1988 : 2018);
}

/**
 * 初期ページ + AJAX ページネーションで全 kiji リンクを収集する。
 */
async function fetchAllKijiLinks(): Promise<
  { kijiId: string; title: string }[]
> {
  const allLinks: { kijiId: string; title: string }[] = [];

  // 初期ページ
  const initialHtml = await fetchPage(`${BASE_ORIGIN}/list00249.html`);
  if (initialHtml) {
    const links = parseListPage(initialHtml);
    for (const link of links) {
      if (!allLinks.some((l) => l.kijiId === link.kijiId)) {
        allLinks.push(link);
      }
    }
  }

  // AJAX ページネーション（pg=1 から空になるまで、最大 100 ページ）
  const MAX_PAGES = 100;
  for (let pg = 1; pg <= MAX_PAGES; pg++) {
    const url = buildAjaxUrl(pg);
    const html = await fetchPage(url);
    if (!html || html.trim().length === 0) break;

    const links = parseListPage(html);
    if (links.length === 0) break;

    for (const link of links) {
      if (!allLinks.some((l) => l.kijiId === link.kijiId)) {
        allLinks.push(link);
      }
    }
  }

  return allLinks;
}

/**
 * 指定年の全会議録一覧を取得する。
 * 年フィルタリング: タイトルから西暦年を抽出して対象年と照合する。
 */
export async function fetchMeetingList(
  year: number
): Promise<KumamuraMeeting[]> {
  const allLinks = await fetchAllKijiLinks();

  // 年でフィルタ
  const filtered = allLinks.filter((link) => {
    const titleYear = extractYearFromTitle(link.title);
    return titleYear === year;
  });

  const meetings: KumamuraMeeting[] = [];

  for (const link of filtered) {
    const detailUrl = buildDetailUrl(link.kijiId);
    const detailHtml = await fetchPage(detailUrl);
    if (!detailHtml) continue;

    const { pdfUrls, heldOn } = parseDetailPage(detailHtml);
    if (pdfUrls.length === 0 || !heldOn) continue;

    meetings.push({
      kijiId: link.kijiId,
      title: link.title,
      pdfUrls,
      heldOn,
    });
  }

  return meetings;
}
