/**
 * 丸森町議会 -- list フェーズ
 *
 * 議決結果一覧ページ（detail.php?content=1031）から PDF リンクを収集する。
 *
 * ページ構造:
 *   - <h5> タグで年度見出し（例: 令和8年）
 *   - <ul> リストで各会議の PDF リンクを列挙
 *   - リンクテキスト: 「令和X年第Y回丸森町議会（定例会|臨時会）（M月D日～D日）」
 *   - PDF URL: 相対パス ../../common/img/content/content_{YYYYMMDD}_{HHMMSS}.pdf
 */

import {
  BASE_ORIGIN,
  LIST_URL,
  detectMeetingType,
  fetchPage,
  toHalfWidth,
} from "./shared";

export interface MarumoriPdfRecord {
  /** 会議タイトル（例: 令和8年第1回丸森町議会臨時会） */
  title: string;
  /** PDF の絶対 URL */
  pdfUrl: string;
  /** 会議種別 */
  meetingType: string;
  /** 開催年（西暦）— リンクテキストから抽出 */
  year: number;
  /** 開催日文字列（リンクテキストから抽出, 例: "1月27日"） */
  dateText: string;
}

/**
 * 相対 PDF URL を絶対 URL に変換する。
 * 例: "../../common/img/content/content_20260127_120000.pdf"
 *   → "https://www.town.marumori.miyagi.jp/common/img/content/content_20260127_120000.pdf"
 */
export function resolvePdfUrl(href: string): string {
  if (href.startsWith("http")) return href;
  if (href.startsWith("//")) return `https:${href}`;

  // 相対パスを /common/... のような絶対パスに変換
  const normalized = href.replace(/^(\.\.\/)+/, "/");
  return `${BASE_ORIGIN}${normalized.startsWith("/") ? "" : "/"}${normalized}`;
}

/**
 * リンクテキストから会議メタ情報を抽出する。
 * 対応パターン:
 *   令和X年第Y回丸森町議会定例会（M月D日～D日）
 *   令和X年第Y回丸森町議会臨時会（M月D日）
 *   令和８年第１回丸森町議会臨時会（１月２７日）
 */
export function parseMeetingText(text: string): {
  title: string;
  year: number | null;
  dateText: string;
  meetingType: string;
} {
  const normalized = toHalfWidth(text.replace(/\s+/g, ""));

  // 会議名パターン
  const meetingMatch = normalized.match(
    /(令和|平成)(元|\d+)年第(\d+)回丸森町議会(定例会|臨時会)[（(](.+?)[）)]/,
  );

  if (!meetingMatch) {
    return {
      title: text.trim(),
      year: null,
      dateText: "",
      meetingType: detectMeetingType(text),
    };
  }

  const era = meetingMatch[1]!;
  const eraYearStr = meetingMatch[2]!;
  const eraYear = eraYearStr === "元" ? 1 : parseInt(eraYearStr, 10);
  const baseYear = era === "令和" ? 2018 : 1988;
  const year = baseYear + eraYear;

  const number = meetingMatch[3]!;
  const meetingKind = meetingMatch[4]!;
  const dateText = meetingMatch[5]!;

  const eraDisplay = eraYearStr === "元" ? "元" : String(eraYear);
  const title = `${era}${eraDisplay}年第${number}回丸森町議会${meetingKind}`;

  return {
    title,
    year,
    dateText,
    meetingType: detectMeetingType(meetingKind),
  };
}

/**
 * 議決結果一覧ページ HTML から PDF リンクを抽出する。
 */
export function parseListPage(html: string): MarumoriPdfRecord[] {
  const records: MarumoriPdfRecord[] = [];
  const seen = new Set<string>();

  // PDF リンクを全件抽出: href に "content_" かつ ".pdf" を含むもの
  const linkPattern =
    /<a\s[^>]*href="([^"]*content_[^"]*\.pdf)"[^>]*>([\s\S]*?)<\/a>/gi;

  let m: RegExpExecArray | null;
  while ((m = linkPattern.exec(html)) !== null) {
    const href = m[1]!;
    const rawText = m[2]!.replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim();

    if (!rawText) continue;

    const pdfUrl = resolvePdfUrl(href);
    if (seen.has(pdfUrl)) continue;
    seen.add(pdfUrl);

    const { title, year, dateText, meetingType } = parseMeetingText(rawText);
    if (!year) continue;

    records.push({ title, pdfUrl, meetingType, year, dateText });
  }

  return records;
}

/**
 * 指定年の PDF レコード一覧を取得する。
 */
export async function fetchPdfList(year: number): Promise<MarumoriPdfRecord[]> {
  const html = await fetchPage(LIST_URL);
  if (!html) return [];

  const allRecords = parseListPage(html);
  return allRecords.filter((r) => r.year === year);
}
