/**
 * 日野町議会 — list フェーズ
 *
 * 2段階で PDF リンクを収集する:
 * 1. 一覧ページ (/1660.htm) から詳細ページ URL を取得
 * 2. 各詳細ページから PDF リンクを抽出
 */

import { BASE_ORIGIN, eraToWestern, fetchPage } from "./shared";

export interface HinoMeeting {
  /** PDF の完全 URL */
  pdfUrl: string;
  /** 会議タイトル（例: "令和7年第6回定例会 第1日"） */
  title: string;
  /** 開催日 YYYY-MM-DD（detail フェーズで PDF から抽出する場合は空文字） */
  heldOn: string;
  /** 会議名（例: "令和7年第6回日野町議会定例会会議録"） */
  sessionTitle: string;
}

/**
 * 一覧ページ HTML から詳細ページのリンクを抽出する（テスト可能な純粋関数）。
 *
 * リンクテキスト形式: "{年号}年第{N}回日野町議会{定例会|臨時会}会議録"
 */
export function parseListPage(
  html: string,
): { label: string; url: string; year: number }[] {
  const results: { label: string; url: string; year: number }[] = [];

  const linkRegex = /<a[^>]+href="([^"]*\/?\d+\.htm)"[^>]*>([\s\S]*?)<\/a>/gi;

  for (const match of html.matchAll(linkRegex)) {
    const href = match[1]!;
    const label = match[2]!.replace(/<[^>]+>/g, "").trim();

    // "日野町議会" + "会議録" を含むリンクのみ対象
    if (!label.includes("日野町議会") || !label.includes("会議録")) continue;

    // href が /{数字}.htm 形式のもの
    if (!/\/?\d+\.htm/.test(href)) continue;

    // 年号から西暦年を抽出
    const eraMatch = label.match(/(令和|平成)(元|\d+)年/);
    if (!eraMatch) continue;

    const westernYear = eraToWestern(eraMatch[1]!, eraMatch[2]!);
    if (!westernYear) continue;

    const url = href.startsWith("http")
      ? href
      : `${BASE_ORIGIN}${href.startsWith("/") ? "" : "/"}${href}`;

    results.push({ label, url, year: westernYear });
  }

  return results;
}

/**
 * 詳細ページ HTML から PDF リンクを抽出する（テスト可能な純粋関数）。
 *
 * 構造: 各詳細ページに「第1日」「第2日」等のリンクがあり、
 * /secure/{フォルダID}/{ファイル名}.pdf 形式の PDF へリンクしている。
 */
export function parseDetailPage(
  html: string,
  pageUrl: string,
  sessionTitle: string,
): HinoMeeting[] {
  const results: HinoMeeting[] = [];

  const linkRegex = /<a[^>]+href="([^"]+\.pdf)"[^>]*>([\s\S]*?)<\/a>/gi;

  for (const match of html.matchAll(linkRegex)) {
    const href = match[1]!;
    const linkText = match[2]!.replace(/<[^>]+>/g, "").trim();

    // PDF の完全 URL を構築
    let pdfUrl: string;
    if (href.startsWith("http")) {
      pdfUrl = href;
    } else if (href.startsWith("/")) {
      pdfUrl = `${BASE_ORIGIN}${href}`;
    } else {
      // 相対パス
      const baseUrl = pageUrl.replace(/\/[^/]+$/, "/");
      pdfUrl = baseUrl + href;
    }

    // linkText から "第N日" を抽出してタイトルに使用
    const dayMatch = linkText.match(/第\s*(\d+)\s*日/);
    const dayLabel = dayMatch ? `第${dayMatch[1]}日` : linkText;

    results.push({
      pdfUrl,
      title: `${sessionTitle} ${dayLabel}`,
      heldOn: "", // detail フェーズで PDF から抽出
      sessionTitle,
    });
  }

  return results;
}

/**
 * PDF テキストから開催日を抽出する。
 * パターン: "令和X年X月X日（X曜日）" or "令和X年XX月XX日"
 *
 * 全角数字にも対応する。
 */
export function parseDateFromPdfText(text: string): string | null {
  // 全角数字を半角に変換
  const normalized = text.replace(/[０-９]/g, (ch) =>
    String.fromCharCode(ch.charCodeAt(0) - 0xfee0),
  );

  // 「第N回 日野町議会...会議録 （第N日）」の後にある開催日を取得
  // 典型: "令和８年１月20日（火曜日）"
  const match = normalized.match(/(令和|平成)(元|\d+)年(\d+)月(\d+)日/);
  if (!match) return null;

  const westernYear = eraToWestern(match[1]!, match[2]!);
  if (!westernYear) return null;

  const month = Number(match[3]);
  const day = Number(match[4]);

  return `${westernYear}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

/**
 * 指定年の全 PDF リンクを取得する。
 */
export async function fetchMeetingList(
  baseUrl: string,
  year: number,
): Promise<HinoMeeting[]> {
  // Step 1: 一覧ページから詳細ページリンクを取得
  const listHtml = await fetchPage(baseUrl);
  if (!listHtml) return [];

  const pages = parseListPage(listHtml);
  const targetPages = pages.filter((p) => p.year === year);
  if (targetPages.length === 0) return [];

  const allMeetings: HinoMeeting[] = [];

  // Step 2: 各詳細ページから PDF リンクを取得
  for (let i = 0; i < targetPages.length; i++) {
    const page = targetPages[i]!;
    const detailHtml = await fetchPage(page.url);
    if (!detailHtml) continue;

    const meetings = parseDetailPage(detailHtml, page.url, page.label);
    allMeetings.push(...meetings);

    if (i < targetPages.length - 1) {
      await new Promise((r) => setTimeout(r, 1000));
    }
  }

  return allMeetings;
}
