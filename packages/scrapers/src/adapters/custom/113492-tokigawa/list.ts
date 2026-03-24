/**
 * ときがわ町議会 — list フェーズ
 *
 * 年度別インデックスページから会議録ファイルの URL を収集する。
 *
 * インデックスページのリンクパターン:
 *   <a href="./r07/03040001.htm">３月４日（開会、一般質問）</a>
 *   <a href="./h18/03070101.htm">３月７日（正副議長選挙...）</a>
 *
 * 連番 0000 は目次のためスキップする。
 */

import {
  BASE_URL,
  buildIndexFileNames,
  detectMeetingType,
  fetchPage,
  indexFileNameToYear,
} from "./shared";

export interface TokigawaMeeting {
  /** 会議録本文の完全 URL */
  fileUrl: string;
  /** 年度ディレクトリ (例: "r07", "h18") */
  yearDir: string;
  /** ファイル名 (例: "03040001.htm") */
  fileName: string;
  /** 開催日 YYYY-MM-DD */
  heldOn: string;
  /** リンクテキスト (例: "３月４日（開会、一般質問）") */
  linkText: string;
  /** インデックスページの見出し（会議名, 例: "令和７年第１回定例会"） */
  meetingTitle: string;
  /** 西暦年 */
  year: number;
}

/**
 * インデックスページの見出しテキストから会議名を抽出する。
 *
 * 見出しパターン例:
 *   "令和７年第１回定例会"
 *   "令和６年第３回定例会"
 */
export function parseMeetingTitle(html: string): string | null {
  // HTML タグを除去してテキスト化
  const text = html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ");

  // 和暦で始まる会議名を探す（半角・全角数字の両方に対応）
  const match = text.match(
    /((?:令和|平成)(?:元|[０-９\d]+)年第[０-９\d]+回(?:定例会|臨時会))/,
  );
  if (match) return match[1]!;

  return null;
}

/**
 * インデックスページ HTML から会議録ファイルリンクを抽出する。
 *
 * @param html デコード済み HTML テキスト
 * @param _year インデックスページの対象年（西暦）※将来的なフィルタリング用
 * @param _meetingTitle このインデックスページの会議名（見出しから取得）
 */
export function parseIndexPage(
  html: string,
  _year: number,
  _meetingTitle: string,
): Array<{ yearDir: string; fileName: string; linkText: string }> {
  const results: Array<{
    yearDir: string;
    fileName: string;
    linkText: string;
  }> = [];
  const seen = new Set<string>();

  // <a href="./r07/03040001.htm">テキスト</a> のパターン
  const linkPattern = /<a\s+href="\.\/([^/]+)\/(\d{8}\.htm)"[^>]*>([^<]+)<\/a>/gi;

  for (const match of html.matchAll(linkPattern)) {
    const yearDir = match[1]!;
    const fileName = match[2]!;
    const linkText = match[3]!.trim();

    // 連番 0000 は目次のためスキップ
    const seqNum = fileName.slice(4);
    if (seqNum === "0000.htm") continue;

    const key = `${yearDir}/${fileName}`;
    if (!seen.has(key)) {
      seen.add(key);
      results.push({ yearDir, fileName, linkText });
    }
  }

  return results;
}

/**
 * リンクテキストから開催日（YYYY-MM-DD）を抽出する。
 *
 * リンクテキスト例: "３月４日（開会、一般質問）"
 * 全角数字の月日を半角に変換してから解析する。
 */
export function extractHeldOnFromLinkText(
  linkText: string,
  year: number,
): string | null {
  // 全角数字を半角に変換
  const normalized = linkText.replace(/[０-９]/g, (c) =>
    String.fromCharCode(c.charCodeAt(0) - 0xfee0),
  );

  const match = normalized.match(/^(\d+)月(\d+)日/);
  if (!match) return null;

  const month = parseInt(match[1]!, 10);
  const day = parseInt(match[2]!, 10);

  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

/**
 * 年度ディレクトリから会議名（サフィックスなし）を推定する。
 * インデックスページに複数の会議がある場合、見出しから取得できないときの fallback。
 */
export function buildFallbackTitle(yearDir: string, fileName: string): string {
  // ファイル名の上位桁から種別を推定
  const seqNum = parseInt(fileName.slice(4, 8), 10);

  if (seqNum >= 2600) return "決算審査特別委員会";
  if (seqNum >= 2000) return "予算審査特別委員会";
  if (seqNum >= 100) return "臨時会";

  return yearDir; // 判断できない場合は年度ディレクトリをそのまま使用
}

/**
 * 指定年の会議録リストを収集する。
 * 全年度インデックスページを走査して対象年のものを返す。
 */
export async function fetchMeetingList(year: number): Promise<TokigawaMeeting[]> {
  const indexFileNames = buildIndexFileNames();
  const meetings: TokigawaMeeting[] = [];

  for (const indexFile of indexFileNames) {
    const fileYear = indexFileNameToYear(indexFile);
    if (fileYear !== year) continue;

    const url = `${BASE_URL}${indexFile}`;
    const html = await fetchPage(url);
    if (!html) continue;

    const meetingTitle = parseMeetingTitle(html) ?? indexFile.replace(".html", "");

    const links = parseIndexPage(html, year, meetingTitle);

    for (const link of links) {
      const heldOn = extractHeldOnFromLinkText(link.linkText, year);
      if (!heldOn) continue;

      const fileUrl = `${BASE_URL}${link.yearDir}/${link.fileName}`;

      meetings.push({
        fileUrl,
        yearDir: link.yearDir,
        fileName: link.fileName,
        heldOn,
        linkText: link.linkText,
        meetingTitle,
        year,
      });
    }
  }

  return meetings;
}

export { detectMeetingType };
