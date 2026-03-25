/**
 * 八代市議会 -- list フェーズ
 *
 * ACT=100 で全会議録一覧を取得し、FINO・KGNO を収集する。
 *
 * URL: /VOICES/CGI/voiweb.exe?ACT=100&KTYP=0,1,2,3&KGTP=1,2&SORT=1&PAGE={PAGE}&HIT={HIT}
 *
 * 1ページ20件。総件数を最初のページから取得してページネーション。
 * 指定年（西暦）の会議録のみ返す。
 */

import { BASE_URL, detectMeetingType, fetchPage, delay } from "./shared";

export interface YatsushiroListRecord {
  /** 会議番号 */
  kgno: number;
  /** ファイル番号 */
  fino: number;
  /** 会議名（例: "令和　７年　９月定例会"） */
  meetingTitle: string;
  /** 開催日テキスト（例: "10月03日-01号"） */
  dateText: string;
  /** 会議種別 */
  meetingType: string;
  /** 詳細 URL */
  detailUrl: string;
}

const INTER_PAGE_DELAY_MS = 1500;

/**
 * ACT=100 の一覧 HTML から総件数を抽出する。
 * 「N件の日程がヒットしました」という文字列から取得。
 */
export function parseTotalHits(html: string): number {
  const m = html.match(/(\d+)\s*件の日程がヒットしました/);
  return m ? parseInt(m[1]!, 10) : 0;
}

/**
 * 一覧ページの HTML から会議録エントリを抽出する。
 *
 * HTML 例:
 * 令和　７年　９月定例会,<A HREF="voiweb.exe?ACT=200&...&KGNO=220&FINO=973" TARGET="HLD_WIN">10月03日-01号</A>
 */
export function parseListHtml(html: string): YatsushiroListRecord[] {
  const records: YatsushiroListRecord[] = [];

  // FINO と KGNO を含むリンクを探す
  const linkPattern =
    /<A\s+HREF="voiweb\.exe\?([^"]*FINO=(\d+)[^"]*)"[^>]*>([\s\S]*?)<\/A>/gi;

  let m: RegExpExecArray | null;
  while ((m = linkPattern.exec(html)) !== null) {
    const queryStr = m[1]!;
    const fino = parseInt(m[2]!, 10);
    const linkText = m[3]!.replace(/<[^>]+>/g, "").trim();

    // KGNO を抽出
    const kgnoMatch = queryStr.match(/KGNO=(\d+)/i);
    if (!kgnoMatch) continue;
    const kgno = parseInt(kgnoMatch[1]!, 10);

    // リンク直前のテキストから会議名を取得
    // リンクの前にある行のカンマ区切りで会議名を取得
    const linkIndex = m.index!;
    const precedingText = html.slice(Math.max(0, linkIndex - 200), linkIndex);

    // 直前の行テキストを取得（<BR> や <TD> タグで区切られている）
    const lineMatch = precedingText.match(
      /([^\n<>]+?(?:定例会|臨時会|委員会)[^\n<>]*?)(?:,\s*)?$/,
    );
    const meetingTitle = lineMatch
      ? lineMatch[1]!.replace(/&nbsp;/g, "\u3000").trim()
      : "";

    const detailUrl = `${BASE_URL}?ACT=200&KGNO=${kgno}&FINO=${fino}`;

    records.push({
      kgno,
      fino,
      meetingTitle,
      dateText: linkText,
      meetingType: detectMeetingType(meetingTitle),
      detailUrl,
    });
  }

  return records;
}

/**
 * 指定年度の会議録エントリ一覧を取得する。
 *
 * ACT=100 でページネーションしながら全件取得し、
 * 指定年に対応するエントリのみ返す。
 */
export async function fetchMeetingList(
  year: number,
): Promise<YatsushiroListRecord[]> {
  // Step 1: 最初のページを取得して総件数を確認
  const firstPageUrl = `${BASE_URL}?ACT=100&KTYP=0,1,2,3&KGTP=1,2&SORT=1&PAGE=1`;
  const firstHtml = await fetchPage(firstPageUrl);
  if (!firstHtml) return [];

  const totalHits = parseTotalHits(firstHtml);
  if (totalHits === 0) return [];

  const allRecords: YatsushiroListRecord[] = [];
  allRecords.push(...parseListHtml(firstHtml));

  // Step 2: 残りのページを取得
  const pageSize = 20;
  const totalPages = Math.ceil(totalHits / pageSize);

  for (let page = 2; page <= totalPages; page++) {
    await delay(INTER_PAGE_DELAY_MS);

    const pageUrl = `${BASE_URL}?ACT=100&KTYP=0,1,2,3&KGTP=1,2&SORT=1&PAGE=${page}&HIT=${totalHits}`;
    const html = await fetchPage(pageUrl);
    if (!html) continue;

    allRecords.push(...parseListHtml(html));
  }

  // 指定年のエントリだけ返す
  // dateText が "MM月DD日-NN号" 形式なので、meetingTitle の和暦から西暦年を判定
  const yearRecords = allRecords.filter((r) => {
    // meetingTitle から年を取得
    const titleYear = extractYearFromTitle(r.meetingTitle, r.dateText);
    return titleYear === year;
  });

  return yearRecords;
}

/**
 * 会議名テキストと日付テキストから西暦年を推定する。
 *
 * 会議名例: "令和　７年　９月定例会"
 * 日付例: "10月03日-01号"
 *
 * 会議が9月定例会で10月に開催される場合のように、
 * 開催月が会議年度と異なることがある。
 * 会議名の年を優先して使用する。
 */
/** 全角数字を半角数字に変換する */
function toHalfWidth(s: string): string {
  return s.replace(/[０-９]/g, (c) =>
    String.fromCharCode(c.charCodeAt(0) - 0xfee0),
  );
}

export function extractYearFromTitle(
  meetingTitle: string,
  _dateText: string,
): number | null {
  // 全角スペースと全角数字を正規化
  const normalized = toHalfWidth(meetingTitle.replace(/[\u3000\s]+/g, ""));

  const reiwa = normalized.match(/令和(元|\d+)年/);
  if (reiwa?.[1]) {
    const n = reiwa[1] === "元" ? 1 : parseInt(reiwa[1], 10);
    return 2018 + n;
  }

  const heisei = normalized.match(/平成(元|\d+)年/);
  if (heisei?.[1]) {
    const n = heisei[1] === "元" ? 1 : parseInt(heisei[1], 10);
    return 1988 + n;
  }

  const showa = normalized.match(/昭和(元|\d+)年/);
  if (showa?.[1]) {
    const n = showa[1] === "元" ? 1 : parseInt(showa[1], 10);
    return 1925 + n;
  }

  return null;
}
