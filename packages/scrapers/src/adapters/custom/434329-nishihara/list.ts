/**
 * 西原村議会 会議録 — list フェーズ
 *
 * 取得フロー:
 * 1. 定例会一覧（list00557）・臨時会一覧（list00558）から kiji リンクを収集
 *    - 「もっと見る」ページネーション（rel="next1" の href を追跡）に対応
 * 2. アーカイブ一覧（list00651）から kiji003295/index.html へのリンクを収集し、
 *    その単一ページ内の全 PDF リンクを取得（平成24年〜令和4年分）
 * 3. 指定年に合致する会議のみを返す
 *
 * ページ構造（一覧ページ）:
 *   - <li><a href="/gikai/kiji{ID}/index.html">タイトル</a></li>
 *   - <a id="nextload1" rel="next1" href="...">もっと見る</a>
 *
 * ページ構造（詳細ページ、令和5年以降）:
 *   - PDF リンクが 1 件のみ掲載
 *
 * ページ構造（アーカイブまとめページ kiji003295）:
 *   - <ul><li><a href="{PDFパス}">{会議名}（PDF：...）</a></li></ul>
 */

import {
  REGULAR_LIST_URL,
  EXTRA_LIST_URL,
  ARCHIVE_LIST_URL,
  ARCHIVE_KIJI_ID,
  BASE_ORIGIN,
  buildDetailUrl,
  fetchPage,
  toAbsoluteUrl,
  extractYearFromTitle,
  parseJapaneseDate,
} from "./shared";

export interface NishiharaMeeting {
  /** kiji 番号 (e.g., "0031869") */
  kijiId: string;
  /** 会議タイトル */
  title: string;
  /** PDF の絶対 URL */
  pdfUrl: string;
  /** 開催日 YYYY-MM-DD（解析できない場合は null） */
  heldOn: string | null;
}

/**
 * 一覧ページ HTML から kiji リンクを抽出する。
 * 返り値: { kijiId, title }[]
 */
export function parseListPage(html: string): { kijiId: string; title: string }[] {
  const results: { kijiId: string; title: string }[] = [];
  const seen = new Set<string>();

  // /gikai/kiji{ID}/index.html のリンクを抽出
  const linkRegex = /<a[^>]+href="([^"]*\/gikai\/kiji(\d+)\/index\.html)"[^>]*>([\s\S]*?)<\/a>/gi;

  for (const match of html.matchAll(linkRegex)) {
    const kijiId = match[2]!;
    const rawTitle = match[3]!
      .replace(/<[^>]+>/g, "")
      .replace(/\s+/g, " ")
      .trim();

    if (!kijiId || !rawTitle) continue;
    if (seen.has(kijiId)) continue;

    seen.add(kijiId);
    results.push({ kijiId, title: rawTitle });
  }

  return results;
}

/**
 * 一覧ページ HTML から次ページ URL を抽出する。
 * <a id="nextload1" rel="next1" href="..."> の href を返す。
 */
export function parseNextPageUrl(html: string): string | null {
  const match = html.match(/<a[^>]+rel="next1"[^>]+href="([^"]+)"/i)
    ?? html.match(/<a[^>]+href="([^"]+)"[^>]+rel="next1"/i);
  if (!match) return null;
  return toAbsoluteUrl(match[1]!);
}

/**
 * 詳細ページ HTML から PDF URL と開催日を抽出する。
 */
export function parseDetailPage(html: string, detailUrl: string): {
  pdfUrl: string | null;
  heldOn: string | null;
} {
  // PDF リンクを抽出（最初の .pdf リンクを使用）
  const pdfMatch = html.match(/href="([^"]+\.pdf)"/i);
  let pdfUrl: string | null = null;
  if (pdfMatch) {
    const href = pdfMatch[1]!;
    if (href.startsWith("http")) {
      pdfUrl = href;
    } else if (href.startsWith("/")) {
      pdfUrl = `${BASE_ORIGIN}${href}`;
    } else {
      // 詳細ページと同じディレクトリ
      const base = detailUrl.replace(/\/index\.html$/, "/");
      pdfUrl = `${base}${href}`;
    }
  }

  // 開催日を抽出: 和暦の日付パターン
  const heldOn = parseJapaneseDate(html);

  return { pdfUrl, heldOn };
}

/**
 * アーカイブまとめページ（kiji003295）HTML から全 PDF エントリを抽出する。
 * 返り値: { title, pdfUrl }[]
 */
export function parseArchivePage(html: string): { title: string; pdfUrl: string }[] {
  const results: { title: string; pdfUrl: string }[] = [];

  // <a href="{PDFパス}">{会議名}（PDF：...）</a> 形式
  const linkRegex = /<a[^>]+href="([^"]+\.pdf)"[^>]*>([\s\S]*?)<\/a>/gi;
  for (const match of html.matchAll(linkRegex)) {
    const href = match[1]!;
    const rawTitle = match[2]!
      .replace(/<[^>]+>/g, "")
      .replace(/（PDF[^）]*）/g, "")
      .replace(/\s+/g, " ")
      .trim();

    if (!rawTitle) continue;

    let pdfUrl: string;
    if (href.startsWith("http")) {
      pdfUrl = href;
    } else if (href.startsWith("/")) {
      pdfUrl = `${BASE_ORIGIN}${href}`;
    } else {
      pdfUrl = `${BASE_ORIGIN}/gikai/kiji${ARCHIVE_KIJI_ID}/${href}`;
    }

    results.push({ title: rawTitle, pdfUrl });
  }

  return results;
}

/**
 * 一覧ページ + ページネーションで全 kiji リンクを収集する。
 */
async function fetchAllKijiLinks(
  listUrl: string
): Promise<{ kijiId: string; title: string }[]> {
  const allLinks: { kijiId: string; title: string }[] = [];
  const seen = new Set<string>();

  let currentUrl: string | null = listUrl;

  while (currentUrl) {
    const html = await fetchPage(currentUrl);
    if (!html) break;

    const links = parseListPage(html);
    for (const link of links) {
      if (!seen.has(link.kijiId)) {
        seen.add(link.kijiId);
        allLinks.push(link);
      }
    }

    // 次ページ
    const nextUrl = parseNextPageUrl(html);
    // アーカイブ kiji003295 は除外（アーカイブページは別途処理）
    if (nextUrl && nextUrl !== currentUrl && !nextUrl.includes(ARCHIVE_KIJI_ID)) {
      currentUrl = nextUrl;
    } else {
      break;
    }
  }

  return allLinks;
}

/**
 * 指定年の全会議録一覧を取得する。
 */
export async function fetchMeetingList(year: number): Promise<NishiharaMeeting[]> {
  const meetings: NishiharaMeeting[] = [];
  const seenKijiIds = new Set<string>();

  // 1. 令和5年以降: 定例会・臨時会一覧から kiji リンクを収集
  const regularLinks = await fetchAllKijiLinks(REGULAR_LIST_URL);
  const extraLinks = await fetchAllKijiLinks(EXTRA_LIST_URL);
  const allLinks = [...regularLinks, ...extraLinks];

  // 年でフィルタ（アーカイブ kiji は除外）
  const filteredLinks = allLinks.filter((link) => {
    if (link.kijiId === ARCHIVE_KIJI_ID) return false;
    const titleYear = extractYearFromTitle(link.title);
    return titleYear === year;
  });

  // 詳細ページから PDF URL と開催日を取得
  for (const link of filteredLinks) {
    if (seenKijiIds.has(link.kijiId)) continue;

    const detailUrl = buildDetailUrl(link.kijiId);
    const detailHtml = await fetchPage(detailUrl);
    if (!detailHtml) continue;

    const { pdfUrl, heldOn } = parseDetailPage(detailHtml, detailUrl);
    if (!pdfUrl) continue;

    seenKijiIds.add(link.kijiId);
    meetings.push({
      kijiId: link.kijiId,
      title: link.title,
      pdfUrl,
      heldOn,
    });
  }

  // 2. 平成24年〜令和4年: アーカイブまとめページから PDF リンクを一括取得
  const archiveListHtml = await fetchPage(ARCHIVE_LIST_URL);
  if (archiveListHtml) {
    // アーカイブ一覧ページから kiji003295 へのリンクを収集
    const archiveDetailLinks = parseListPage(archiveListHtml);
    const archiveRef = archiveDetailLinks.find(
      (l) => l.kijiId === ARCHIVE_KIJI_ID
    );

    if (archiveRef) {
      const archiveDetailUrl = buildDetailUrl(ARCHIVE_KIJI_ID);
      const archiveHtml = await fetchPage(archiveDetailUrl);
      if (archiveHtml) {
        const entries = parseArchivePage(archiveHtml);

        for (const entry of entries) {
          const titleYear = extractYearFromTitle(entry.title);
          if (titleYear !== year) continue;

          // アーカイブページの PDF は kiji003295 配下に集約されているため
          // 会議ごとに固有の kijiId がない。PDF URL をキーとして使用する。
          const pseudoKijiId = `archive_${encodeURIComponent(entry.pdfUrl).slice(-20)}`;
          if (seenKijiIds.has(pseudoKijiId)) continue;

          seenKijiIds.add(pseudoKijiId);
          meetings.push({
            kijiId: pseudoKijiId,
            title: entry.title,
            pdfUrl: entry.pdfUrl,
            heldOn: null, // アーカイブページには日付情報が含まれない
          });
        }
      }
    }
  }

  return meetings;
}
