/**
 * 上天草市議会 — list フェーズ
 *
 * 1. 一覧ページ (/q/list/389.html?pg={N}) をページネーションを辿り、
 *    全会期の詳細ページ ID・タイトル・掲載日を収集する
 * 2. 詳細ページ ID をキーに、detailParams として返す
 *
 * ページネーション:
 *   1ページ目: /q/list/389.html
 *   2ページ目以降: /q/list/389.html?pg={1, 2, ...} （0始まりではなく 1 始まり）
 *   1ページあたり最大 16 件
 *   エントリが 0 件になったらクロール終了
 */

import { buildListUrl, delay, fetchPage } from "./shared";

export interface KamiamakusaSessionInfo {
  /** 詳細ページ ID */
  id: string;
  /** 会議タイトル（例: "平成28年第4回定例会(10月)議事録"） */
  title: string;
  /** 掲載日 YYYY-MM-DD（年のフィルタリングに使用） */
  postedOn: string;
  /** 詳細ページの絶対 URL */
  detailUrl: string;
}

const INTER_PAGE_DELAY_MS = 1_500;

/**
 * 一覧ページ HTML から会期別エントリを抽出する。
 *
 * HTML 構造:
 *   各エントリは <h3> 内に <span class="listDate">[YYYY年MM月DD日]</span> と
 *   <span class="listTitle"><a href="https://...q/aview/389/{ID}.html" title="タイトル">タイトル</a></span>
 *   の形式で格納されている。
 *   リンクは絶対 URL で記述されている。
 */
export function parseListPage(html: string): KamiamakusaSessionInfo[] {
  const results: KamiamakusaSessionInfo[] = [];
  const seen = new Set<string>();

  // 絶対 URL の /q/aview/389/{ID}.html 形式のリンクとタイトルを抽出
  // href="https://www.city.kamiamakusa.kumamoto.jp/q/aview/389/7679.html" title="タイトル">タイトル</a>
  const linkPattern =
    /href="https?:\/\/www\.city\.kamiamakusa\.kumamoto\.jp(\/q\/aview\/389\/(\d+)\.html)"[^>]*>([^<]+)<\/a>/gi;

  for (const m of html.matchAll(linkPattern)) {
    const path = m[1]!;
    const id = m[2]!;
    const rawTitle = m[3]!.trim();

    if (!id || !rawTitle) continue;
    if (seen.has(id)) continue;
    seen.add(id);

    // href より前のテキストから最後に現れる "[YYYY年MM月DD日]" を抽出する
    const beforeHref = html.slice(0, m.index);
    const dateMatches = [...beforeHref.matchAll(/(\d{4})年(\d{1,2})月(\d{1,2})日/g)];
    const lastDateMatch = dateMatches[dateMatches.length - 1];

    let postedOn = "";
    if (lastDateMatch) {
      const year = lastDateMatch[1]!;
      const month = lastDateMatch[2]!.padStart(2, "0");
      const day = lastDateMatch[3]!.padStart(2, "0");
      postedOn = `${year}-${month}-${day}`;
    }

    results.push({
      id,
      title: rawTitle,
      postedOn,
      detailUrl: `https://www.city.kamiamakusa.kumamoto.jp${path}`,
    });
  }

  return results;
}

/**
 * 指定年の全会期エントリを収集する。
 * 一覧ページをページネーションで辿り、全件取得する。
 * year でのフィルタリングはしない（全件収集）。
 */
export async function fetchSessionList(
  _baseUrl: string,
  _year: number,
): Promise<KamiamakusaSessionInfo[]> {
  const all: KamiamakusaSessionInfo[] = [];
  const seen = new Set<string>();

  // 最大ページ数（安全上限）
  const MAX_PAGES = 20;

  for (let page = 0; page <= MAX_PAGES; page++) {
    if (page > 0) await delay(INTER_PAGE_DELAY_MS);

    const url = buildListUrl(page);
    const html = await fetchPage(url);
    if (!html) break;

    const entries = parseListPage(html);
    if (entries.length === 0) break;

    for (const entry of entries) {
      if (!seen.has(entry.id)) {
        seen.add(entry.id);
        all.push(entry);
      }
    }

    // 次ページが存在するか確認（次のページリンクがなければ終了）
    // ?pg={page} へのリンクが存在するか確認
    const nextPageNum = page + 1;
    const hasNextPage = html.includes(`?pg=${nextPageNum}`) || html.includes(`pg=${nextPageNum}`);
    if (!hasNextPage) break;
  }

  return all;
}

/** 詳細ページから PDF リンク（/dl?q= 形式）を抽出する */
export function parsePdfLinks(html: string): string[] {
  const links: string[] = [];
  const seen = new Set<string>();

  // href="/dl?q={fileParam}" パターン
  const pattern = /href="(\/dl\?q=[^"]+\.pdf)"/gi;

  for (const m of html.matchAll(pattern)) {
    const href = m[1]!;
    if (!seen.has(href)) {
      seen.add(href);
      links.push(`https://www.city.kamiamakusa.kumamoto.jp${href}`);
    }
  }

  return links;
}
