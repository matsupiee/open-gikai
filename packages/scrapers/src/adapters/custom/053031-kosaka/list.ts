/**
 * 小坂町議会 — list フェーズ
 *
 * 3段階クロール:
 * 1. トップページ (kaigiroku/index.html) から年度別一覧ページの URL を収集
 * 2. 年度別一覧ページから各会議詳細ページの URL を収集
 * 3. 各会議詳細ページから PDF URL・日付を収集
 *
 * fetchDetail は MeetingData | null を1件返すため、
 * list フェーズでは PDF ファイルごとに1レコードを返す。
 */

import {
  detectMeetingType,
  parseWarekiYear,
  fetchPage,
  resolveUrl,
  delay,
} from "./shared";

export interface KosakaSessionInfo {
  /** 会議タイトル（例: "令和6年第1回小坂町議会（定例会） 初日"） */
  title: string;
  /** 開催日 YYYY-MM-DD。解析できない場合は null */
  heldOn: string | null;
  /** PDF の絶対 URL */
  pdfUrl: string;
  /** 会議種別 */
  meetingType: "plenary" | "extraordinary" | "committee";
  /** 会議詳細ページの URL（externalId 用） */
  detailUrl: string;
  /** PDF リンクテキスト（例: "初日（2月20日）"） */
  pdfLabel: string;
}

const INTER_PAGE_DELAY_MS = 1500;

/**
 * 指定年の全セッション PDF を収集する。
 * baseUrl（= 会議録トップページ URL）から年度ページ → 会議詳細ページ → PDF を辿る。
 */
export async function fetchSessionList(
  baseUrl: string,
  year: number
): Promise<KosakaSessionInfo[]> {
  // Step 1: トップページから年度別一覧ページの URL を収集
  const topHtml = await fetchPage(baseUrl);
  if (!topHtml) return [];

  const yearPageUrls = parseYearPageUrls(topHtml, year);
  if (yearPageUrls.length === 0) return [];

  const allSessions: KosakaSessionInfo[] = [];

  for (const yearPageUrl of yearPageUrls) {
    await delay(INTER_PAGE_DELAY_MS);

    // Step 2: 年度別一覧ページから会議詳細ページのリンクを収集
    const yearHtml = await fetchPage(yearPageUrl);
    if (!yearHtml) continue;

    const meetingLinks = parseMeetingLinks(yearHtml);

    // Step 3: 各会議詳細ページから PDF リンクを収集
    for (const link of meetingLinks) {
      await delay(INTER_PAGE_DELAY_MS);

      const detailHtml = await fetchPage(link.url);
      if (!detailHtml) continue;

      const sessions = extractPdfRecords(detailHtml, link.title, link.url);
      allSessions.push(...sessions);
    }
  }

  return allSessions;
}

// --- HTML パーサー（テスト用に export） ---

/**
 * トップページ HTML から、指定年に該当する年度別一覧ページの URL を抽出する。
 *
 * 「平成31年・令和元年」のように複数年度をまとめているページは
 * 両年度にマッチさせる（2019 は平成31年/令和元年の両方に対応）。
 */
export function parseYearPageUrls(html: string, year: number): string[] {
  const urls: string[] = [];
  // 会議録トップページのリンクパターン
  // href="/kurashi_gyosei/.../kaigiroku/1/index.html" や "/kurashi_gyosei/.../kaigiroku/1223.html"
  const pattern =
    /<a\s[^>]*href="((?:https?:)?\/[^"]*kaigiroku\/[^"]+)"[^>]*>([^<]+会議録[^<]*)<\/a>/gi;

  let m: RegExpExecArray | null;
  while ((m = pattern.exec(html)) !== null) {
    const href = m[1]!;
    const linkText = m[2]!.trim();

    if (matchesYear(linkText, year)) {
      const url = resolveUrl(href);
      if (!urls.includes(url)) {
        urls.push(url);
      }
    }
  }

  return urls;
}

/**
 * リンクテキストが指定年度に対応するか判定する。
 * 「平成31年・令和元年会議録」は 2019 にマッチ。
 */
export function matchesYear(linkText: string, year: number): boolean {
  // テキスト内の全和暦年を抽出して西暦変換し、いずれかが year に一致すれば true
  const reiwaPattern = /令和(\d+|元)年/g;
  const heiseiPattern = /平成(\d+|元)年/g;

  let m: RegExpExecArray | null;

  while ((m = reiwaPattern.exec(linkText)) !== null) {
    const n = m[1] === "元" ? 1 : parseInt(m[1]!, 10);
    if (2018 + n === year) return true;
  }

  while ((m = heiseiPattern.exec(linkText)) !== null) {
    const n = m[1] === "元" ? 1 : parseInt(m[1]!, 10);
    if (1988 + n === year) return true;
  }

  return false;
}

export interface MeetingLink {
  title: string;
  url: string;
}

/**
 * 年度別一覧ページ HTML から各会議詳細ページのリンクを抽出する。
 * 「小坂町議会」を含むリンクのみ対象とする。
 */
export function parseMeetingLinks(html: string): MeetingLink[] {
  const links: MeetingLink[] = [];
  const seen = new Set<string>();

  const pattern = /<a\s[^>]*href="([^"]+)"[^>]*>([^<]*小坂町議会[^<]*)<\/a>/gi;

  let m: RegExpExecArray | null;
  while ((m = pattern.exec(html)) !== null) {
    const href = m[1]!;
    const title = m[2]!.replace(/\s+/g, " ").trim();
    const url = resolveUrl(href);

    if (seen.has(url)) continue;
    seen.add(url);

    links.push({ title, url });
  }

  return links;
}

/**
 * 会議詳細ページ HTML から PDF レコードを抽出する。
 *
 * PDF リンクはプロトコル相対 URL（//www.town.kosaka.akita.jp/material/files/group/5/...）で記載。
 * リンクテキストに「N月N日」パターンが含まれる。
 */
export function extractPdfRecords(
  html: string,
  meetingTitle: string,
  detailUrl: string
): KosakaSessionInfo[] {
  const records: KosakaSessionInfo[] = [];
  const meetingType = detectMeetingType(meetingTitle);

  // PDF リンクパターン: //www.town.kosaka.akita.jp/material/files/group/5/*.pdf
  const pdfPattern =
    /<a\s[^>]*href="((?:https?:)?\/\/[^"]*\/material\/files\/group\/5\/[^"]+\.pdf)"[^>]*>([^<]+)<\/a>/gi;

  let m: RegExpExecArray | null;
  while ((m = pdfPattern.exec(html)) !== null) {
    const href = m[1]!;
    const linkText = m[2]!.trim();
    const pdfUrl = resolveUrl(href);

    // 日付を抽出: 「N月N日」パターン
    const dateMatch = linkText.match(/(\d{1,2})月(\d{1,2})日/);
    let heldOn: string | null = null;

    if (dateMatch) {
      const month = parseInt(dateMatch[1]!, 10);
      const day = parseInt(dateMatch[2]!, 10);
      const year = inferYear(meetingTitle, month);
      if (year !== null) {
        heldOn = `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
      }
    }

    // リンクテキストからファイルサイズ表記を除去してラベルを作成
    const pdfLabel = linkText.replace(/\(PDFファイル[^)]*\)/g, "").trim();

    // セッションラベルから会議タイトルを組み立てる
    const sessionTitle = pdfLabel
      ? `${meetingTitle} ${pdfLabel}`
      : meetingTitle;

    records.push({
      title: sessionTitle,
      heldOn,
      pdfUrl,
      meetingType,
      detailUrl,
      pdfLabel,
    });
  }

  return records;
}

/**
 * 会議タイトルの和暦と PDF リンクの月から西暦年を推定する。
 * 年度をまたぐケース（例: 12月定例会の翌年1月閉会）に対応するため、
 * 会議タイトルの和暦年をベースに月で補正する。
 */
function inferYear(meetingTitle: string, month: number): number | null {
  const baseYear = parseWarekiYear(meetingTitle);
  if (baseYear === null) return null;

  // 定例会の開催月をタイトルから推定
  // 平成29年第8回（12月）のような表記を参考に
  const monthMatch = meetingTitle.match(/（(\d{1,2})月）/);
  if (monthMatch) {
    const sessionMonth = parseInt(monthMatch[1]!, 10);
    // 定例会が12月以降で翌年月（1〜3月）の場合は翌年
    if (sessionMonth >= 10 && month <= 3) {
      return baseYear + 1;
    }
  }

  return baseYear;
}
