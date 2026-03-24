/**
 * 新上五島町議会 会議録 -- list フェーズ
 *
 * 会議録一覧ページから年度別エントリーIDを取得し、
 * 各年度ページから PDF ダウンロードリンクを収集する。
 *
 * サイト構造:
 *   1. 一覧ページ (goto_chosei.php?wcid=l00002x4) に全年度リンクが並ぶ
 *      リンク: goto_chosei_full.php?eid={eid}&r=4&wcid=l00002x4
 *   2. 年度別ページ (goto_chosei_full.php?eid={eid}&r=4&wcid=l00002x4) に
 *      各会議の PDF リンクが並ぶ
 *      PDF URL: cmd/dlfile.php?entryname=benri&entryid={eid}&fileid={fileid}&/{filename}
 *
 * リンクテキスト例:
 *   "第１回臨時会（R6.1.31）[0.56MB]"
 *   "第１回定例会（R6.3.5～15）[3.95MB]"
 */

import {
  BASE_ORIGIN,
  LIST_URL,
  convertWarekiToWesternYear,
  decodeHtmlEntities,
  detectMeetingType,
  fetchPage,
  parseDateFromLinkText,
  toHalfWidth,
} from "./shared";

export interface ShinkamigotoPdfLink {
  /** 会議録タイトル（例: "第１回定例会"） */
  title: string;
  /** PDF の絶対 URL */
  pdfUrl: string;
  /** 会議種別 */
  meetingType: string;
  /** 西暦年 */
  year: number;
  /** 開催日（YYYY-MM-DD）。解析できない場合は null */
  heldOn: string | null;
  /** ページ上で表示された元号年テキスト（例: "令和６年"） */
  eraYearText: string;
}

/**
 * 一覧ページ HTML から年度別 eid とその年の西暦を取得する。
 *
 * リンクパターン: goto_chosei_full.php?eid={eid}&r=4&wcid=l00002x4
 * リンクテキスト: "令和８年本会議　会議録" など
 */
export function parseEidList(
  html: string,
): Array<{ eid: string; year: number; eraYearText: string }> {
  const results: Array<{ eid: string; year: number; eraYearText: string }> = [];

  const linkPattern =
    /<a[^>]*href="[^"]*goto_chosei_full\.php\?eid=(\d+)[^"]*"[^>]*>([\s\S]*?)<\/a>/gi;

  for (const match of html.matchAll(linkPattern)) {
    const eid = match[1]!;
    const rawText = match[2]!.replace(/<[^>]+>/g, "").trim();
    const normalized = toHalfWidth(rawText);

    const year = convertWarekiToWesternYear(normalized);
    if (!year) continue;

    // 元号年テキストを抽出（例: "令和6年"）
    const eraMatch = normalized.match(/(令和|平成)(元|\d+)年/);
    const eraYearText = eraMatch ? eraMatch[0] : rawText;

    results.push({ eid, year, eraYearText });
  }

  return results;
}

/**
 * 年度別ページのリンクテキストから会議タイトルを抽出する。
 * ファイルサイズ情報（[x.xxMB]）を除去する。
 *
 * 例:
 *   "第１回臨時会（R6.1.31）[0.56MB]" → "第１回臨時会"
 *   "第１回定例会（R6.3.5～15）[3.95MB]" → "第１回定例会"
 */
export function extractMeetingTitle(rawText: string): string {
  // ファイルサイズ情報を除去
  let text = rawText.replace(/\s*\[\d+\.\d+MB\]/g, "").trim();
  // 日付情報（括弧内）を除去
  text = text.replace(/[（(][^）)]*[）)]/g, "").trim();
  return text;
}

/**
 * 年度別ページ HTML から PDF リンク一覧を抽出する。
 *
 * PDF URL パターン: cmd/dlfile.php?entryname=benri&entryid={eid}&fileid={fileid}&/{filename}
 */
export function parseYearPage(
  html: string,
  year: number,
  eraYearText: string,
): ShinkamigotoPdfLink[] {
  const results: ShinkamigotoPdfLink[] = [];

  const linkPattern =
    /<a[^>]*href="([^"]*cmd\/dlfile\.php[^"]*)"[^>]*>([\s\S]*?)<\/a>/gi;

  for (const match of html.matchAll(linkPattern)) {
    const href = match[1]!;
    const rawText = match[2]!.replace(/<[^>]+>/g, "").trim();

    if (!rawText) continue;

    // HTML エンティティをデコードして PDF の絶対 URL を組み立てる
    const decodedHref = decodeHtmlEntities(href);
    const pdfUrl = decodedHref.startsWith("http")
      ? decodedHref
      : `${BASE_ORIGIN}/${decodedHref.replace(/^\//, "")}`;

    const title = extractMeetingTitle(rawText);
    if (!title) continue;

    const heldOn = parseDateFromLinkText(rawText, year);
    const fullTitle = `${eraYearText}${title}`;

    results.push({
      title: fullTitle,
      pdfUrl,
      meetingType: detectMeetingType(title),
      year,
      heldOn,
      eraYearText,
    });
  }

  return results;
}

/**
 * 指定年の PDF リンク一覧を取得する。
 *
 * 1. 一覧ページから対象年の eid を取得
 * 2. 年度別ページから PDF リンクを収集
 */
export async function fetchDocumentList(
  year: number,
): Promise<ShinkamigotoPdfLink[]> {
  const listHtml = await fetchPage(LIST_URL);
  if (!listHtml) return [];

  const eidList = parseEidList(listHtml);
  const target = eidList.find((e) => e.year === year);
  if (!target) return [];

  const yearPageUrl = `${BASE_ORIGIN}/goto_chosei_full.php?eid=${target.eid}&r=4&wcid=l00002x4`;
  const yearHtml = await fetchPage(yearPageUrl);
  if (!yearHtml) return [];

  return parseYearPage(yearHtml, target.year, target.eraYearText);
}
