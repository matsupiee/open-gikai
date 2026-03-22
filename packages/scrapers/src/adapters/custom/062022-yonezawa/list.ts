/**
 * 米沢市議会 会議録 — list フェーズ
 *
 * 一覧ページ（260.html）から年ごとのセッションページリンクと臨時会 PDF リンクを取得し、
 * 各セッションページから議事録 PDF リンクを収集する。
 *
 * 構造:
 *   一覧ページ (260.html)
 *   ├── <h2>令和7年</h2>
 *   │   ├── 定例会 → セッションページ (.html) → 議事録 PDF リンク
 *   │   └── 臨時会 → 直接 PDF リンク
 *   ├── <h2>令和6年</h2>
 *   │   └── ...
 */

import { BASE_ORIGIN, INDEX_PATH, fetchPage, toEraInfo } from "./shared";

export interface YonezawaMeeting {
  pdfUrl: string;
  title: string;
  heldOn: string;
  sessionName: string;
}

/**
 * 議事録 PDF の URL かどうかを判定する。
 * スケジュール PDF（teireikainittei_）や要旨 PDF（youshi_）はスキップする。
 */
function isTranscriptPdf(filename: string): boolean {
  if (filename.startsWith("teireikainittei")) return false;
  if (filename.startsWith("youshi")) return false;
  // 議事録 PDF パターン: r{XX}-{MM}{t|r}-{NN}-{MMDD}.pdf
  return /^[rh]\d{2}-\d{2}[tr]-\d{2}-\d{4}\.pdf$/i.test(filename);
}

/**
 * 議事録 PDF ファイル名から開催日を抽出する。
 * e.g., "r06-12t-01-1205.pdf" → "2024-12-05"
 *       "r07-02r-01-0203.pdf" → "2025-02-03"
 */
export function parseDateFromFilename(filename: string): string | null {
  const match = filename.match(
    /^([rh])(\d{2})-(\d{2})[tr]-\d{2}-(\d{2})(\d{2})\.pdf$/i
  );
  if (!match) return null;

  const [, eraChar, eraYearStr, , monthStr, dayStr] = match;
  const eraYear = parseInt(eraYearStr!, 10);

  let westernYear: number;
  if (eraChar === "r") {
    westernYear = eraYear + 2018;
  } else {
    westernYear = eraYear + 1988;
  }

  const month = parseInt(monthStr!, 10);
  const day = parseInt(dayStr!, 10);

  return `${westernYear}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

/**
 * 一覧ページ HTML から年ごとのセクションを分割し、
 * 指定年のセッションページ URL と臨時会 PDF URL を抽出する。
 */
export function parseIndexPage(
  html: string,
  targetEra: string,
  targetEraYear: number
): {
  sessionPageUrls: { url: string; sessionName: string }[];
  directPdfs: YonezawaMeeting[];
} {
  const sessionPageUrls: { url: string; sessionName: string }[] = [];
  const directPdfs: YonezawaMeeting[] = [];

  const targetHeader = `${targetEra}${targetEraYear}年`;

  // 年ごとのセクションを見つける（h2 内に span 等のネストあり）
  const h2Pattern = /<h2[^>]*>[\s\S]*?<\/h2>/gi;
  const h2Matches = [...html.matchAll(h2Pattern)];

  let sectionStart = -1;
  let sectionEnd = html.length;

  for (let i = 0; i < h2Matches.length; i++) {
    const match = h2Matches[i]!;
    if (match[0].includes(targetHeader)) {
      sectionStart = match.index! + match[0].length;
      // 次の h2 までが対象セクション
      if (i + 1 < h2Matches.length) {
        sectionEnd = h2Matches[i + 1]!.index!;
      }
      break;
    }
  }

  if (sectionStart === -1) return { sessionPageUrls, directPdfs };

  const section = html.slice(sectionStart, sectionEnd);

  // セッションページリンク（.html）を抽出
  const htmlLinkPattern =
    /<a[^>]+href="([^"]+\.html)"[^>]*>([^<]+)<\/a>/gi;
  for (const match of section.matchAll(htmlLinkPattern)) {
    const href = match[1]!;
    const linkText = match[2]!.trim();

    // 自治体サイト内の会議録ページのみ
    if (!href.includes("/soshiki/12/")) continue;

    const url = href.startsWith("http")
      ? href
      : `${BASE_ORIGIN}${href.startsWith("/") ? "" : "/"}${href}`;

    // セッション名を抽出: "令和7年3月定例会" → "3月定例会"
    const sessionMatch = linkText.match(
      /(?:令和|平成)\d+年(.+)/
    );
    const sessionName = sessionMatch?.[1] ?? linkText;

    sessionPageUrls.push({ url, sessionName });
  }

  // 臨時会 PDF リンクを直接抽出
  const pdfLinkPattern =
    /<a[^>]+href="([^"]+\.pdf)"[^>]*>([^<]*臨時会[^<]*)<\/a>/gi;
  for (const match of section.matchAll(pdfLinkPattern)) {
    let href = match[1]!;
    const linkText = match[2]!.trim();

    // protocol-relative URL を https に変換
    if (href.startsWith("//")) {
      href = `https:${href}`;
    } else if (!href.startsWith("http")) {
      href = `${BASE_ORIGIN}${href.startsWith("/") ? "" : "/"}${href}`;
    }

    const filename = href.split("/").pop() ?? "";
    if (!isTranscriptPdf(filename)) continue;

    const heldOn = parseDateFromFilename(filename);
    if (!heldOn) continue;

    // セッション名を抽出: "2月臨時会" など
    const sessionMatch = linkText.match(/(\d+月臨時会)/);
    const sessionName = sessionMatch?.[1] ?? "臨時会";

    directPdfs.push({
      pdfUrl: href,
      title: sessionName,
      heldOn,
      sessionName,
    });
  }

  return { sessionPageUrls, directPdfs };
}

/**
 * セッションページ HTML から議事録 PDF リンクを抽出する。
 */
export function parseSessionPage(
  html: string,
  sessionName: string
): YonezawaMeeting[] {
  const meetings: YonezawaMeeting[] = [];

  const pdfLinkPattern =
    /<a[^>]+href="([^"]+\.pdf)"[^>]*>([^<]*)<\/a>/gi;

  for (const match of html.matchAll(pdfLinkPattern)) {
    let href = match[1]!;

    // protocol-relative URL を https に変換
    if (href.startsWith("//")) {
      href = `https:${href}`;
    } else if (!href.startsWith("http")) {
      href = `${BASE_ORIGIN}${href.startsWith("/") ? "" : "/"}${href}`;
    }

    const filename = href.split("/").pop() ?? "";
    if (!isTranscriptPdf(filename)) continue;

    const heldOn = parseDateFromFilename(filename);
    if (!heldOn) continue;

    // 重複チェック
    if (meetings.some((m) => m.pdfUrl === href)) continue;

    meetings.push({
      pdfUrl: href,
      title: sessionName,
      heldOn,
      sessionName,
    });
  }

  return meetings;
}

/**
 * 指定年の全会議録 PDF 一覧を取得する。
 */
export async function fetchMeetingList(
  year: number
): Promise<YonezawaMeeting[]> {
  const eraInfo = toEraInfo(year);
  if (!eraInfo) return [];

  const indexUrl = `${BASE_ORIGIN}${INDEX_PATH}`;
  const indexHtml = await fetchPage(indexUrl);
  if (!indexHtml) return [];

  const { sessionPageUrls, directPdfs } = parseIndexPage(
    indexHtml,
    eraInfo.era,
    eraInfo.eraYear
  );

  const results: YonezawaMeeting[] = [...directPdfs];

  // 各セッションページから PDF リンクを取得
  for (const { url, sessionName } of sessionPageUrls) {
    const sessionHtml = await fetchPage(url);
    if (!sessionHtml) continue;

    const meetings = parseSessionPage(sessionHtml, sessionName);
    for (const m of meetings) {
      if (!results.some((r) => r.pdfUrl === m.pdfUrl)) {
        results.push(m);
      }
    }
  }

  return results;
}
