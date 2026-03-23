/**
 * 永平寺町議会 — list フェーズ
 *
 * 2段階で PDF リンクを収集する:
 * 1. 一覧ページ (/minutes) から全会議 ID を取得
 * 2. 各詳細ページ (/assembly/minutes/{ID}) から本文 PDF の URL を抽出
 *
 * ページネーションなし（全件が単一ページに表示される）。
 */

import { BASE_ORIGIN, extractWesternYear, fetchPage } from "./shared";

export interface EiheijiMeeting {
  /** PDF の完全 URL */
  pdfUrl: string;
  /** 会議タイトル（例: "令和8年1月臨時会"） */
  title: string;
  /** 開催日 YYYY-MM-DD */
  heldOn: string;
  /** 会議 ID（例: "rinnji0801"） */
  meetingId: string;
}

/**
 * 一覧ページ (/minutes) の HTML から会議リンクを抽出する。
 * 各 <li><a href="/assembly/minutes/{ID}">タイトル</a></li> を返す。
 */
export function parseMinutesPage(
  html: string
): { meetingId: string; title: string }[] {
  const results: { meetingId: string; title: string }[] = [];
  const linkRegex =
    /<a[^>]+href="\/assembly\/minutes\/([^"]+)"[^>]*>([\s\S]*?)<\/a>/g;

  for (const match of html.matchAll(linkRegex)) {
    const meetingId = match[1]!.trim();
    // HTML タグを除去してテキストのみ取得
    const title = match[2]!.replace(/<[^>]+>/g, "").trim();
    results.push({ meetingId, title });
  }

  return results;
}

/**
 * 詳細ページ (/assembly/minutes/{ID}) の HTML から本文 PDF リンクを抽出する。
 * 表紙・目次 PDF はスキップし、本文 PDF のみを返す。
 *
 * リンクテキストから開催日コード（R071202 等）を読み取って YYYY-MM-DD に変換する。
 */
export function parseDetailPage(
  html: string,
  meetingId: string,
  meetingTitle: string
): EiheijiMeeting[] {
  const results: EiheijiMeeting[] = [];

  // PDF リンクを抽出
  const linkRegex =
    /<a[^>]+href="([^"]*\.pdf)"[^>]*>([\s\S]*?)<\/a>/gi;

  for (const match of html.matchAll(linkRegex)) {
    const href = match[1]!;
    const linkText = match[2]!.replace(/<[^>]+>/g, "").trim();

    // 表紙・目次をスキップ
    if (/表紙|目次|名簿|日程/.test(linkText)) continue;

    // 開催日を抽出: リンクテキスト（和暦）→ リンクテキスト（Rコード）→ ファイル名から
    const heldOn =
      extractDateFromText(linkText) ??
      extractDateFromFilename(linkText) ??
      extractDateFromFilename(href);
    if (!heldOn) continue;

    // PDF URL を構築
    let pdfUrl: string;
    if (href.startsWith("http")) {
      pdfUrl = href;
    } else if (href.startsWith("/")) {
      pdfUrl = `${BASE_ORIGIN}${href}`;
    } else {
      pdfUrl = `${BASE_ORIGIN}/assembly/minutes/${meetingId}/${href}`;
    }

    results.push({
      pdfUrl,
      title: meetingTitle,
      heldOn,
      meetingId,
    });
  }

  return results;
}

/**
 * リンクテキストから和暦の開催日を抽出して YYYY-MM-DD に変換する。
 * e.g., "令和８年１月２１日" → "2026-01-21"
 */
export function extractDateFromText(text: string): string | null {
  // 全角数字を半角に変換
  const normalized = text.replace(/[０-９]/g, (c) =>
    String.fromCharCode(c.charCodeAt(0) - 0xfee0)
  );

  const match = normalized.match(/(令和|平成)(元|\d+)年(\d+)月(\d+)日/);
  if (!match) return null;

  const [, era, eraYearStr, monthStr, dayStr] = match;
  const eraYear = eraYearStr === "元" ? 1 : parseInt(eraYearStr!, 10);
  const month = parseInt(monthStr!, 10);
  const day = parseInt(dayStr!, 10);

  let westernYear: number;
  if (era === "令和") westernYear = eraYear + 2018;
  else if (era === "平成") westernYear = eraYear + 1988;
  else return null;

  return `${westernYear}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

/**
 * PDF ファイル名から開催日コードを抽出して YYYY-MM-DD に変換する。
 * e.g., "R071202" → "2025-12-02"
 *       "H280315" → "2016-03-15"
 */
export function extractDateFromFilename(filename: string): string | null {
  // R{和暦2桁}{月2桁}{日2桁} パターン
  const reiwaMatch = filename.match(/R(\d{2})(\d{2})(\d{2})/);
  if (reiwaMatch) {
    const year = parseInt(reiwaMatch[1]!, 10) + 2018;
    const month = reiwaMatch[2]!;
    const day = reiwaMatch[3]!;
    return `${year}-${month}-${day}`;
  }

  // H{和暦2桁}{月2桁}{日2桁} パターン
  const heiseiMatch = filename.match(/H(\d{2})(\d{2})(\d{2})/);
  if (heiseiMatch) {
    const year = parseInt(heiseiMatch[1]!, 10) + 1988;
    const month = heiseiMatch[2]!;
    const day = heiseiMatch[3]!;
    return `${year}-${month}-${day}`;
  }

  return null;
}

/**
 * 指定年の全 PDF リンクを取得する。
 */
export async function fetchMeetingList(
  baseUrl: string,
  year: number
): Promise<EiheijiMeeting[]> {
  // Step 1: 一覧ページから全会議を取得
  const minutesUrl = `${baseUrl.replace(/\/$/, "")}/minutes`;
  const html = await fetchPage(minutesUrl);
  if (!html) return [];

  const allMeetings = parseMinutesPage(html);

  // 対象年度の会議をフィルタ
  const targetMeetings = allMeetings.filter((m) => {
    const westernYear = extractWesternYear(m.title);
    return westernYear === year;
  });

  if (targetMeetings.length === 0) return [];

  // Step 2: 各詳細ページから PDF URL を取得
  const results: EiheijiMeeting[] = [];

  for (const meeting of targetMeetings) {
    const detailUrl = `${BASE_ORIGIN}/assembly/minutes/${meeting.meetingId}`;
    const detailHtml = await fetchPage(detailUrl);
    if (!detailHtml) continue;

    const pdfs = parseDetailPage(detailHtml, meeting.meetingId, meeting.title);
    results.push(...pdfs);
  }

  return results;
}
