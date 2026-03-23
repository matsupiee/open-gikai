/**
 * あさぎり町議会 会議録 — list フェーズ
 *
 * 一覧ページと AJAX エンドポイントから全会議録の kiji 番号・タイトルを収集し、
 * 各詳細ページから PDF URL と開催日を取得する。
 *
 * 構造:
 *   一覧ページ (list00300.html)
 *   ├── <li><span class="upddate">YYYY年M月D日更新</span><a href="/kiji{番号}/index.html">タイトル</a></li>
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
  toFiscalYearLabel,
} from "./shared";

export interface AsagiriMeeting {
  /** kiji 番号 (e.g., "0035107") */
  kijiId: string;
  /** 会議タイトル (e.g., "令和7年度 第7回あさぎり町議会会議会議録") */
  title: string;
  /** PDF の絶対 URL */
  pdfUrl: string;
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
 * 詳細ページ HTML から PDF URL と開催日を抽出する。
 */
export function parseDetailPage(html: string): {
  pdfUrl: string | null;
  heldOn: string | null;
} {
  // PDF リンクを抽出
  const pdfMatch = html.match(
    /<a[^>]+href="([^"]+\.pdf)"[^>]*>/i
  );
  let pdfUrl: string | null = null;
  if (pdfMatch?.[1]) {
    const href = pdfMatch[1];
    pdfUrl = href.startsWith("http")
      ? href
      : `${BASE_ORIGIN}${href.startsWith("/") ? "" : "/"}${href}`;
  }

  // 開催日を抽出: 和暦の日付パターン
  // "令和７年９月８日（月曜日）" や "令和８年１月１５日（木曜日）" など
  const heldOn = parseJapaneseDate(html);

  return { pdfUrl, heldOn };
}

/**
 * 初期ページ + AJAX ページネーションで全 kiji リンクを収集する。
 */
async function fetchAllKijiLinks(): Promise<
  { kijiId: string; title: string }[]
> {
  const allLinks: { kijiId: string; title: string }[] = [];

  // 初期ページ
  const initialHtml = await fetchPage(`${BASE_ORIGIN}/list00300.html`);
  if (initialHtml) {
    const links = parseListPage(initialHtml);
    for (const link of links) {
      if (!allLinks.some((l) => l.kijiId === link.kijiId)) {
        allLinks.push(link);
      }
    }
  }

  // AJAX ページネーション（pg=1 から空になるまで）
  for (let pg = 1; ; pg++) {
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
 * 指定年度の全会議録一覧を取得する。
 * 年度フィルタリング: タイトルに「令和X年度」が含まれるエントリのみ対象とする。
 */
export async function fetchMeetingList(
  year: number
): Promise<AsagiriMeeting[]> {
  const fiscalYearLabel = toFiscalYearLabel(year);
  const allLinks = await fetchAllKijiLinks();

  // 年度でフィルタ
  const filtered = allLinks.filter((link) =>
    link.title.includes(fiscalYearLabel)
  );

  const meetings: AsagiriMeeting[] = [];

  for (const link of filtered) {
    const detailUrl = buildDetailUrl(link.kijiId);
    const detailHtml = await fetchPage(detailUrl);
    if (!detailHtml) continue;

    const { pdfUrl, heldOn } = parseDetailPage(detailHtml);
    if (!pdfUrl) continue;

    meetings.push({
      kijiId: link.kijiId,
      title: link.title,
      pdfUrl,
      heldOn: heldOn ?? "",
    });
  }

  return meetings;
}
