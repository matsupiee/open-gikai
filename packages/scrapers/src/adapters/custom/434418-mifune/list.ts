/**
 * 御船町議会（熊本県） — list フェーズ
 *
 * 一覧ページ（hpkiji CMS）から詳細ページ URL を全件収集し、
 * 各詳細ページから PDF リンクを抽出する。
 *
 * URL 構造:
 *   一覧: /gikai/hpkiji/pub/List.aspx?c_id=3&class_set_id=6&class_id=6006&pg={N}
 *   詳細: /gikai/page{ID}.html
 *   PDF:  /common/UploadFileOutput.ashx?c_id=3&id={pageId}&sub_id={subId}&flid={flid}
 *
 * 令和5年度以降は1詳細ページに年度内の複数回分の PDF が列挙される（年度まとめ型）。
 * 令和4年度以前は1詳細ページに1回分の定例会 PDF が掲載される（定例会単位型）。
 */

import {
  BASE_ORIGIN,
  LIST_URL,
  detectMeetingType,
  fetchPage,
  inferHeldOn,
  parseWarekiNendo,
  delay,
} from "./shared";

export interface MifuneSession {
  /** 会議タイトル（例: "令和6年度 第1回御船町議会定例会（6月会議）"） */
  title: string;
  /** 開催日 YYYY-MM-DD（推定できない場合は null） */
  heldOn: string | null;
  /** PDF の絶対 URL */
  pdfUrl: string;
  /** 会議種別 */
  meetingType: string;
}

const INTER_PAGE_DELAY_MS = 1500;

/**
 * 一覧ページ HTML から詳細ページへのリンクを抽出する。
 * 重複を排除して返す。
 *
 * @returns 詳細ページ相対パス（/gikai/page{ID}.html）の配列
 */
export function parseListPage(html: string): string[] {
  const links = new Set<string>();

  // /gikai/page{数字}.html 形式のリンクを抽出
  const linkPattern = /href="(\/gikai\/page\d+\.html)"/gi;
  for (const match of html.matchAll(linkPattern)) {
    const href = match[1];
    if (href) links.add(href);
  }

  return [...links];
}

/**
 * 一覧ページに「次ページ」が存在するか判定する。
 * hpkiji の autopager は ?pg=N 形式でインクリメントするため、
 * レスポンス内に次ページリンクがあれば継続する。
 */
export function hasNextPage(html: string, currentPage: number): boolean {
  const nextPg = currentPage + 1;
  return html.includes(`pg=${nextPg}`) || html.includes(`pg%3D${nextPg}`);
}

/**
 * 詳細ページ HTML から PDF セッション情報を抽出する。
 *
 * mainBlock 内の UploadFileOutput.ashx リンクを対象とする。
 * リンクテキストから会議名を抽出し、heldOn を推定する。
 */
export function parseDetailPage(html: string, detailPageUrl: string): MifuneSession[] {
  // mainBlock 内の HTML を取得（mainBlock がない場合は全体を対象）
  const mainBlockMatch = html.match(/<div[^>]+id=["']?mainBlock["']?[^>]*>([\s\S]*?)<\/div>\s*(?=<div|$)/i)
    ?? html.match(/<div[^>]+id=["']?mainBlock["']?[^>]*>([\s\S]*)/i);
  const searchHtml = mainBlockMatch?.[1] ?? html;

  const results: MifuneSession[] = [];

  // UploadFileOutput.ashx を含むリンクを抽出
  const pdfPattern = /<a\s[^>]*href="([^"]*UploadFileOutput\.ashx[^"]*)"[^>]*>([\s\S]*?)<\/a>/gi;
  for (const match of searchHtml.matchAll(pdfPattern)) {
    const href = match[1]!.trim();
    const rawText = match[2]!
      .replace(/<[^>]+>/g, "")
      .replace(/&nbsp;/g, " ")
      .replace(/&amp;/g, "&")
      .replace(/\s+/g, " ")
      .trim();

    if (!href || !rawText) continue;

    // ファイルサイズ表記（「2.2メガバイト」「別ウィンドウ」等）をスキップ
    if (/メガバイト|キロバイト|別ウィンドウ/.test(rawText) && rawText.length < 20) continue;

    const pdfUrl = href.startsWith("http") ? href : `${BASE_ORIGIN}${href}`;

    // リンクテキストから年度・会議情報を解析
    const nendo = parseWarekiNendo(rawText);
    const heldOn = nendo ? inferHeldOn(nendo, rawText) : null;

    results.push({
      title: rawText,
      heldOn,
      pdfUrl,
      meetingType: detectMeetingType(rawText),
    });
  }

  // UploadFileOutput.ashx リンクが見つからない場合、詳細ページ URL のページ ID から推定
  // （タイトルはページ周辺のテキストから取得）
  if (results.length === 0) {
    // リンクのないシンプルな PDF 埋め込み形式にも対応するため、
    // PDF リンクをより広いパターンで再探索
    const broadPdfPattern = /href="([^"]*UploadFileOutput[^"]*)"[^>]*>/gi;
    for (const match of html.matchAll(broadPdfPattern)) {
      const href = match[1]!.trim();
      const pdfUrl = href.startsWith("http") ? href : `${BASE_ORIGIN}${href}`;

      results.push({
        title: detailPageUrl,
        heldOn: null,
        pdfUrl,
        meetingType: "plenary",
      });
    }
  }

  return results;
}

/**
 * 指定年に対応する全 PDF セッション情報を取得する。
 *
 * 1. 一覧ページを全ページ取得して詳細ページ URL を収集
 * 2. 各詳細ページから PDF リンクを抽出
 * 3. 年（西暦）でフィルタリング
 */
export async function fetchSessionList(year: number): Promise<MifuneSession[]> {
  // Step 1: 一覧ページを全ページ巡回して詳細ページ URL を収集
  const detailPaths = new Set<string>();
  let page = 1;

  while (true) {
    const url = page === 1 ? LIST_URL : `${LIST_URL}&pg=${page}`;
    const html = await fetchPage(url);
    if (!html) break;

    const links = parseListPage(html);
    const prevSize = detailPaths.size;
    for (const link of links) {
      detailPaths.add(link);
    }

    // 新たなリンクが追加されなかった、または次ページなし
    if (detailPaths.size === prevSize || !hasNextPage(html, page)) break;

    page++;
    await delay(INTER_PAGE_DELAY_MS);
  }

  // Step 2: 各詳細ページから PDF セッション情報を収集
  const allSessions: MifuneSession[] = [];

  for (const path of detailPaths) {
    const detailUrl = `${BASE_ORIGIN}${path}`;
    const html = await fetchPage(detailUrl);
    if (!html) continue;

    const sessions = parseDetailPage(html, detailUrl);
    allSessions.push(...sessions);

    await delay(INTER_PAGE_DELAY_MS);
  }

  // Step 3: 年フィルタリング（heldOn が null の場合はタイトルの年度から推定）
  return allSessions.filter((s) => {
    if (s.heldOn) {
      // heldOn の年 または 年-1（年度またがり: 1〜3月は前年度）
      const heldYear = parseInt(s.heldOn.slice(0, 4), 10);
      return heldYear === year;
    }
    // heldOn がない場合はタイトルの年度から推定
    const nendo = parseWarekiNendo(s.title);
    if (!nendo) return false;
    // 年度 nendo は nendo/04 〜 (nendo+1)/03 を含む → year と nendo が一致するか
    // year が nendo (4〜12月) または nendo+1 (1〜3月) の可能性がある
    return nendo === year || nendo + 1 === year;
  });
}
