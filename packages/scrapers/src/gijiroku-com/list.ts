/**
 * gijiroku.com スクレイパー — list フェーズ
 *
 * voiweb.exe CGI (ACT=100) から会議一覧を取得する。
 *
 * URL 構造:
 *   {origin}/voices/cgi/voiweb.exe?ACT=100&KTYP=0,1,2,3&SORT=0&FYY={year}&TYY={year}&KGTP=1,3
 *
 * HTML 構造:
 *   各会議行は <A HREF="javascript:;" onClick="winopen('voiweb.exe?ACT=200&...&FINO={fino}&UNID={unid}');">
 *   で表される。タイトルはリンクテキスト（例: "12月05日-01号"）で、
 *   親行のテキストに会議名（例: "令和　６年第２回定例会"）が含まれる。
 *
 * エンコーディング: Shift_JIS
 */

import { fetchShiftJisPage } from "./fetch-page";
import { extractBaseInfo } from "./url";

export interface GijirokuMeetingRecord {
  /** FINO パラメータ（ファイル番号） */
  fino: string;
  /** KGNO パラメータ（会議番号） */
  kgno: string;
  /** UNID パラメータ（一意識別子） */
  unid: string;
  /** 会議タイトル（例: "令和　６年第２回定例会１２月定例会議"） */
  title: string;
  /** 日付テキスト（例: "12月05日-01号"） */
  dateLabel: string;
}

/**
 * gijiroku.com の voiweb.exe CGI から指定年の会議一覧を取得する。
 */
export async function fetchMeetingList(
  baseUrl: string,
  year: number
): Promise<GijirokuMeetingRecord[] | null> {
  try {
    const cgiUrl = buildListUrl(baseUrl, year);
    if (!cgiUrl) return null;

    const html = await fetchShiftJisPage(cgiUrl);
    if (!html) return null;

    const records = parseListHtml(html);
    return records.length > 0 ? records : null;
  } catch (err) {
    console.warn(`[gijiroku-com] fetchMeetingList failed for ${baseUrl} (year=${year}):`, err instanceof Error ? err.message : err);
    return null;
  }
}

/**
 * baseUrl から voiweb.exe の一覧取得 URL を構築する。
 *
 * baseUrl の例:
 *   http://tsukuba.gijiroku.com/voices/g08v_search.asp
 *   http://sapporo.gijiroku.com/voices/g07v_search.asp
 *   http://warabi.gijiroku.com/gikai/voices/g08v_search.asp
 *
 * → {origin}/{voicesPath}/cgi/voiweb.exe?ACT=100&KTYP=0,1,2,3&SORT=0&FYY={year}&TYY={year}&KGTP=1,3
 */
/** @internal テスト用にexport */
export function buildListUrl(baseUrl: string, year: number): string | null {
  try {
    const info = extractBaseInfo(baseUrl);
    if (!info) return null;

    return `${info.origin}${info.basePath}/cgi/voiweb.exe?ACT=100&KTYP=0,1,2,3&SORT=0&FYY=${year}&TYY=${year}&KGTP=1,3`;
  } catch (err) {
    console.warn(`[gijiroku-com] buildListUrl failed for ${baseUrl}:`, err instanceof Error ? err.message : err);
    return null;
  }
}

/**
 * voiweb.exe ACT=100 の結果 HTML から会議レコードを抽出する。
 *
 * 各行の構造:
 *   <TD ...>
 *     <A HREF="voiweb.exe?ACT=100&...">folder</A>
 *     会議タイトル,<A HREF="javascript:;" onClick="winopen('voiweb.exe?ACT=200&...&KGNO=1844&FINO=2736&UNID=K_R06120500011');">日付ラベル</A>
 *   </TD>
 *
 * 目次（-目次）は発言がないのでスキップする。
 */
/** @internal テスト用にexport */
export function parseListHtml(html: string): GijirokuMeetingRecord[] {
  const records: GijirokuMeetingRecord[] = [];
  const seen = new Set<string>();

  // winopen('voiweb.exe?ACT=200&...&KGNO={kgno}&FINO={fino}&UNID={unid}')
  // の後ろに ">日付ラベル</A> が続く
  const pattern =
    /winopen\('voiweb\.exe\?ACT=200[^']*&KGNO=(\d+)&FINO=(\d+)&UNID=([^']+)'\);"[^>]*>([^<]+)<\/A>/gi;

  // 各行の前にタイトルテキストが存在する
  // <TD ...> の中で "タイトル,<A HREF..." の形式
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(html)) !== null) {
    const kgno = match[1]!;
    const fino = match[2]!;
    const unid = match[3]!;
    const dateLabel = match[4]!.trim();

    // 目次はスキップ（発言データがないため）
    if (dateLabel.includes("目次")) continue;

    if (seen.has(unid)) continue;
    seen.add(unid);

    // タイトルを match 位置の前方から取得
    const preceding = html.substring(
      Math.max(0, match.index - 500),
      match.index
    );
    const title = extractTitleFromPreceding(preceding);

    records.push({
      fino,
      kgno,
      unid,
      title: title
        ? `${normalizeWhitespace(title)},${dateLabel}`
        : dateLabel,
      dateLabel,
    });
  }

  return records;
}

/**
 * リンクの前方テキストから会議タイトルを抽出する。
 *
 * パターン: "令和　６年第２回定例会１２月定例会議," のように
 * TD 内でリンクの直前にタイトルテキストがカンマ区切りで置かれている。
 */
/** @internal テスト用にexport */
export function extractTitleFromPreceding(preceding: string): string | null {
  // 最後の </A> 以降のテキストを取得（folder link の後のテキスト）
  const afterLastAnchor = preceding.split(/<\/A>/i).pop() ?? "";

  // 改行・タグを除去してカンマの前のテキストを取得
  const cleaned = afterLastAnchor.replace(/<[^>]+>/g, "").replace(/\n/g, "");
  const commaIdx = cleaned.lastIndexOf(",");
  if (commaIdx < 0) return null;

  const title = cleaned.substring(0, commaIdx).trim();
  return title.length > 0 ? title : null;
}

/**
 * 全角・半角スペースを正規化する。
 */
function normalizeWhitespace(s: string): string {
  return s.replace(/[\s\u3000]+/g, " ").trim();
}
