/**
 * 有田市議会 — list フェーズ
 *
 * 1. トップページから年度 ID を収集
 * 2. 対象年度の index.html から会議詳細ページリンクを取得
 * 3. 各詳細ページから PDF リンクを抽出
 *
 * fetchDetail は MeetingData | null を1件返すため、
 * list フェーズでセッション日ごとに1レコードを返す。
 */

import {
  BASE_ORIGIN,
  buildTopUrl,
  buildYearPageUrl,
  buildMeetingPageUrl,
  detectMeetingType,
  parseWarekiYear,
  toWareki,
  fetchPage,
  delay,
} from "./shared";

export interface AridaSessionInfo {
  /** 会議タイトル（例: "令和7年12月定例会 第1日 令和7年12月1日（開会・議案説明）"） */
  title: string;
  /** 開催日 YYYY-MM-DD */
  heldOn: string;
  /** PDF の絶対 URL */
  pdfUrl: string;
  /** 会議種別 */
  meetingType: string;
  /** 会議 ID（詳細ページ識別子） */
  meetingId: string;
}

const INTER_PAGE_DELAY_MS = 1500;

/**
 * 指定年の全セッション日を収集する。
 */
export async function fetchSessionList(
  year: number,
): Promise<AridaSessionInfo[]> {
  // Step 1: トップページから年度 ID を取得
  const topHtml = await fetchPage(buildTopUrl());
  if (!topHtml) return [];

  const yearPages = parseYearPages(topHtml);

  // 対象年に該当する年度ページを特定
  // 有田市は「令和N年」で分類（年度ではなく暦年）
  const targetWareki = toWareki(year);
  const targetPage = yearPages.find((p) => p.year === year);
  if (!targetPage || !targetWareki) return [];

  await delay(INTER_PAGE_DELAY_MS);

  // Step 2: 年度ページから会議リンクを取得
  const yearUrl = buildYearPageUrl(targetPage.nendoId);
  const yearHtml = await fetchPage(yearUrl);
  if (!yearHtml) return [];

  const meetingLinks = parseMeetingLinks(yearHtml, targetPage.nendoId);

  // Step 3: 各詳細ページからセッション日 PDF を抽出
  const allSessions: AridaSessionInfo[] = [];

  for (const link of meetingLinks) {
    await delay(INTER_PAGE_DELAY_MS);

    const meetingUrl = buildMeetingPageUrl(link.nendoId, link.meetingId);
    const detailHtml = await fetchPage(meetingUrl);
    if (!detailHtml) continue;

    const sessions = extractSessionRecords(detailHtml, link.title, link.meetingId, link.nendoId);
    allSessions.push(...sessions);
  }

  return allSessions;
}

// --- HTML パーサー（テスト用に export） ---

export interface YearPageLink {
  year: number;
  nendoId: string;
}

/**
 * トップページから年度ページリンクを抽出する。
 * リンクパターン: /shigikai/honkaigiroku/{nendoId}/index.html
 * テキストパターン: "本会議録（令和N年）"
 */
export function parseYearPages(html: string): YearPageLink[] {
  const pages: YearPageLink[] = [];

  const pattern =
    /href="[^"]*\/shigikai\/honkaigiroku\/(\d+)\/index\.html"[^>]*>[^<]*本会議録[（(]([^）)]+)[）)]/gi;

  let m: RegExpExecArray | null;
  while ((m = pattern.exec(html)) !== null) {
    const nendoId = m[1]!;
    const yearText = m[2]!;
    const year = parseWarekiYear(yearText + "年");
    if (year !== null) {
      pages.push({ year, nendoId });
    }
  }

  return pages;
}

export interface MeetingLink {
  title: string;
  nendoId: string;
  meetingId: string;
}

/**
 * 年度ページから会議詳細ページリンクを抽出する。
 * リンクパターン: /shigikai/honkaigiroku/{nendoId}/{meetingId}.html
 * テキストパターン: "令和N年M月定例会会議録"
 */
export function parseMeetingLinks(html: string, nendoId: string): MeetingLink[] {
  const links: MeetingLink[] = [];
  const seen = new Set<string>();

  const pattern =
    /href="[^"]*\/shigikai\/honkaigiroku\/\d+\/(\d+)\.html"[^>]*>([^<]+)</gi;

  let m: RegExpExecArray | null;
  while ((m = pattern.exec(html)) !== null) {
    const meetingId = m[1]!;
    const title = m[2]!.replace(/\s+/g, " ").trim();

    if (seen.has(meetingId)) continue;
    seen.add(meetingId);

    // 会議録リンクのみ対象（「index」ページは除外）
    if (meetingId === "index") continue;

    links.push({ title, nendoId, meetingId });
  }

  return links;
}

/**
 * 詳細ページ HTML からセッション日ごとの PDF レコードを抽出する。
 *
 * PDFリンクテキストパターン:
 *   "第1日　令和7年12月1日（開会・議案説明） （PDF 194.2KB）"
 */
export function extractSessionRecords(
  html: string,
  meetingTitle: string,
  meetingId: string,
  nendoId: string,
): AridaSessionInfo[] {
  const records: AridaSessionInfo[] = [];
  const meetingType = detectMeetingType(meetingTitle);

  // PDF リンクを抽出
  // href パターン: _res/projects/default_project/_page_/001/... .pdf
  // または相対パスで ../../_res/... .pdf
  const pdfPattern =
    /href="([^"]*\.pdf)"[^>]*>([^<]+)</gi;

  let m: RegExpExecArray | null;
  while ((m = pdfPattern.exec(html)) !== null) {
    const rawHref = m[1]!;
    const linkText = m[2]!.trim();

    // 日付パターン: 令和N年M月D日 or 年M月D日
    const dateMatch = linkText.match(/令和(\d+)年(\d{1,2})月(\d{1,2})日/);
    if (!dateMatch) continue;

    const reiwaYear = parseInt(dateMatch[1]!, 10);
    const month = parseInt(dateMatch[2]!, 10);
    const day = parseInt(dateMatch[3]!, 10);
    const westernYear = 2018 + reiwaYear;

    const heldOn = `${westernYear}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;

    // PDF URL を絶対 URL に変換
    let pdfUrl: string;
    if (rawHref.startsWith("http")) {
      pdfUrl = rawHref;
    } else if (rawHref.startsWith("/")) {
      pdfUrl = `${BASE_ORIGIN}${rawHref}`;
    } else {
      // 相対パスを解決: 会議ページからの相対パス
      // 会議ページ: /shigikai/honkaigiroku/{nendoId}/{meetingId}.html
      // 相対パスの ../ を解決する
      const basePath = `/shigikai/honkaigiroku/${nendoId}/`;
      const resolved = new URL(rawHref, `${BASE_ORIGIN}${basePath}`).href;
      pdfUrl = resolved;
    }

    // リンクテキストから日番号と内容を抽出
    const dayMatch = linkText.match(/第(\d+)日/);
    const contentMatch = linkText.match(/[（(]([^）)]+)[）)]/);

    let sessionTitle = meetingTitle.replace(/会議録$/, "");
    if (dayMatch) {
      sessionTitle += ` 第${dayMatch[1]}日`;
    }
    if (contentMatch) {
      sessionTitle += `（${contentMatch[1]}）`;
    }

    records.push({
      title: sessionTitle,
      heldOn,
      pdfUrl,
      meetingType,
      meetingId,
    });
  }

  return records;
}
