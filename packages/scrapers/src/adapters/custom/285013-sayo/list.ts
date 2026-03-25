/**
 * 佐用町議会（兵庫県） -- list フェーズ
 *
 * 1. 全件一覧ページをページネーションでクロールし、年度別詳細ページIDを収集
 * 2. 対象年度の詳細ページから PDF リンクと開催日を抽出
 *
 * 詳細ページの HTML 構造:
 *   <h3>第115回定例会(1日目)</h3>
 *   <p>令和6年3月4日</p>
 *   <p><a href="/gikai/kaigiroku/R6nen/teirei_115/teirei115-1.pdf">(PDF形式：882KB)</a></p>
 */

import {
  BASE_ORIGIN,
  LIST_BASE_URL,
  LIST_PARAMS,
  DETAIL_BASE_URL,
  detectMeetingType,
  parseWarekiYear,
  fetchPage,
  delay,
} from "./shared";

export interface SayoSessionInfo {
  /** 会議タイトル（例: "第115回定例会(1日目)"） */
  title: string;
  /** 開催日 YYYY-MM-DD */
  heldOn: string;
  /** PDF の絶対 URL */
  pdfUrl: string;
  /** 会議種別 */
  meetingType: string;
  /** 会議名（見出しから取得） */
  sessionName: string;
}

const INTER_PAGE_DELAY_MS = 1500;

/**
 * 指定年度の全セッション日を収集する。
 * 全件一覧からページネーションで年度別ページIDを収集し、対象年度のページを処理する。
 */
export async function fetchSessionList(
  _baseUrl: string,
  year: number
): Promise<SayoSessionInfo[]> {
  const allSessions: SayoSessionInfo[] = [];

  // Step 1: 全件一覧から対象年度の詳細ページIDを収集
  const yearPageIds = await fetchAllYearPageIds(year);

  // Step 2: 各年度ページから PDF リンクを収集
  for (const id of yearPageIds) {
    await delay(INTER_PAGE_DELAY_MS);
    const url = `${DETAIL_BASE_URL}?id=${id}`;
    const pageHtml = await fetchPage(url);
    if (!pageHtml) continue;

    const sessions = extractPdfRecords(pageHtml, url);
    allSessions.push(...sessions);
  }

  return allSessions;
}

/**
 * 全件一覧ページをページネーションでクロールし、指定年度の詳細ページIDを返す。
 *
 * 佐用町のCMSは p= パラメータで20件ずつ表示する。
 * 前のページと全く同じIDセットが返ってきたらループ終了。
 */
export async function fetchAllYearPageIds(year: number): Promise<string[]> {
  const allIds: string[] = [];
  const seenIds = new Set<string>();

  for (let page = 1; ; page++) {
    // オフセットは (page-1) * 20 を使うか、単純に p={page} を使う
    // 実際のCMSは p=1, p=2 ... でページ番号として動作するか確認済み
    const url = `${LIST_BASE_URL}${LIST_PARAMS}&p=${page}`;
    const html = await fetchPage(url);
    if (!html) break;

    const result = parseDetailPageIds(html, year);

    // 記事が1件もない場合は終了
    if (result.total === 0) break;

    // 全IDが既にseenに含まれている（ページが重複している）場合は終了
    const allSeen = result.allIds.every((id) => seenIds.has(id));
    if (allSeen && result.allIds.length > 0) break;

    // 新規IDを追加
    for (const id of result.allIds) {
      seenIds.add(id);
    }
    allIds.push(...result.matched);

    // ページ内の全件が対象外 or 次ページなし の場合はbreak
    // 23件程度しかないため p=2 で終わる
    if (result.allIds.length < 20) break;

    await delay(INTER_PAGE_DELAY_MS);
  }

  return allIds;
}

export interface ParseDetailPageIdsResult {
  /** 対象年度のID一覧 */
  matched: string[];
  /** このページで見つかった全ID（重複チェック用） */
  allIds: string[];
  /** このページで見つかった総件数（0ならループ終了） */
  total: number;
}

/**
 * 全件一覧ページ HTML から年度別詳細ページへのリンクを抽出する。
 * 対象年度に一致するIDのみを返し、ページ全体の件数も返す。
 *
 * HTML 例:
 *   <a href="../info/detail.jsp?id=9544">佐用町議会会議録(令和6年開催分)</a>
 */
export function parseDetailPageIds(
  html: string,
  year: number
): ParseDetailPageIdsResult {
  const matched: string[] = [];
  const allIds: string[] = [];
  let total = 0;

  // detail.jsp?id= を含むリンクを抽出
  const pattern = /href="[^"]*detail\.jsp\?id=(\d+)"[^>]*>\s*([^<]*)/gi;
  let m: RegExpExecArray | null;

  while ((m = pattern.exec(html)) !== null) {
    const id = m[1]!;
    const text = m[2]!.replace(/\s+/g, " ").trim();

    if (!text) continue;

    total++;
    allIds.push(id);

    // 西暦年を直接含む場合（例: "2024年開催分"）
    const seirekiMatch = text.match(/(\d{4})年/);
    if (seirekiMatch) {
      if (parseInt(seirekiMatch[1]!, 10) === year) {
        matched.push(id);
      }
      continue;
    }

    // 和暦を変換（例: "令和6年開催分"）
    const warekiYear = parseWarekiYear(text);
    if (warekiYear !== null && warekiYear === year) {
      matched.push(id);
    }
  }

  return { matched, allIds, total };
}

/**
 * 和暦の日付文字列から YYYY-MM-DD を返す。
 * 例: "令和6年3月4日" -> "2024-03-04"
 * パース不能な場合は null を返す。
 */
export function parseWarekiDate(text: string): string | null {
  // 令和
  const reiwaMatch = text.match(/令和(元|\d+)年(\d{1,2})月(\d{1,2})日/);
  if (reiwaMatch) {
    const n = reiwaMatch[1] === "元" ? 1 : parseInt(reiwaMatch[1]!, 10);
    const year = 2018 + n;
    const month = parseInt(reiwaMatch[2]!, 10);
    const day = parseInt(reiwaMatch[3]!, 10);
    return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
  }

  // 平成
  const heiseiMatch = text.match(/平成(元|\d+)年(\d{1,2})月(\d{1,2})日/);
  if (heiseiMatch) {
    const n = heiseiMatch[1] === "元" ? 1 : parseInt(heiseiMatch[1]!, 10);
    const year = 1988 + n;
    const month = parseInt(heiseiMatch[2]!, 10);
    const day = parseInt(heiseiMatch[3]!, 10);
    return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
  }

  return null;
}

/**
 * 年度別詳細ページ HTML から PDF リンクを抽出し、セッション日情報を返す。
 *
 * ページ構造（テーブル形式）:
 *   <tr>
 *     <td>第115回定例会(1日目)</td>
 *     <td>令和6年3月4日</td>
 *     <td><a href="http://www.town.sayo.lg.jp/gikai/kaigiroku/R6nen/teirei_115/teirei115-1.pdf">(PDF形式：882KB)</a></td>
 *   </tr>
 */
export function extractPdfRecords(
  html: string,
  pageUrl: string
): SayoSessionInfo[] {
  const records: SayoSessionInfo[] = [];
  const seenHref = new Set<string>();

  // テーブル行 <tr>...</tr> を抽出して処理
  const trPattern = /<tr[^>]*>([\s\S]*?)<\/tr>/gi;
  let trm: RegExpExecArray | null;

  while ((trm = trPattern.exec(html)) !== null) {
    const rowHtml = trm[1]!;

    // <td>...</td> セルを抽出
    const cells: string[] = [];
    const tdPattern = /<td[^>]*>([\s\S]*?)<\/td>/gi;
    let tdm: RegExpExecArray | null;
    while ((tdm = tdPattern.exec(rowHtml)) !== null) {
      const cellText = tdm[1]!
        .replace(/<[^>]+>/g, " ")
        .replace(/\s+/g, " ")
        .trim();
      cells.push(cellText);
    }

    // 3列以上あり、2列目が日付、3列目にPDF情報を含む行を処理
    if (cells.length < 3) continue;

    const sessionName = cells[0]!;
    const dateText = cells[1]!;

    // 会議名パターン確認
    if (!/第\d+回/.test(sessionName)) continue;

    // 日付パース
    const heldOn = parseWarekiDate(dateText);
    if (!heldOn) continue;

    // PDF リンクを抽出
    const linkMatch = rowHtml.match(/href="([^"]*\.pdf)"/i);
    if (!linkMatch) continue;

    const href = linkMatch[1]!;

    // 絶対URLに変換
    let absoluteUrl: string;
    if (href.startsWith("http")) {
      absoluteUrl = href;
    } else if (href.startsWith("//")) {
      absoluteUrl = `https:${href}`;
    } else if (href.startsWith("/")) {
      absoluteUrl = `${BASE_ORIGIN}${href}`;
    } else {
      try {
        absoluteUrl = new URL(href, pageUrl).toString();
      } catch {
        continue;
      }
    }

    if (seenHref.has(absoluteUrl)) continue;
    seenHref.add(absoluteUrl);

    const meetingType = detectMeetingType(sessionName);

    records.push({
      title: sessionName,
      heldOn,
      pdfUrl: absoluteUrl,
      meetingType,
      sessionName,
    });
  }

  return records;
}
