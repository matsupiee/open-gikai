/**
 * 昭和村議会（群馬県） — list フェーズ
 *
 * 2段階クロール:
 * 1. トップページ（kaigiroku.html）から各定例会・臨時会ページへのリンクを取得
 *    - h5 タグで年度を、h6 内の a タグで各会議へのリンクを抽出
 * 2. 各定例会ページから本文 PDF リンクを収集
 *    - リンクテキストまたはファイル名に「本文」「honbun」を含むものを抽出
 */

import {
  BASE_ORIGIN,
  TOP_PAGE_PATH,
  detectMeetingType,
  fetchPage,
  parseWarekiYear,
  delay,
} from "./shared";

export interface ShowaGunmaSession {
  /** 会議タイトル（例: "令和7年第4回定例会"） */
  title: string;
  /** 開催年（西暦）。トップページの h5 タグから解析 */
  year: number;
  /** 本文 PDF の絶対 URL */
  pdfUrl: string;
  /** 号数（例: "第1号"、"第2号"） */
  goNumber: string;
  /** 会議種別 */
  meetingType: "plenary" | "extraordinary" | "committee";
}

const INTER_PAGE_DELAY_MS = 1500;

/**
 * トップページの HTML から年度・会議名・URL の対応を抽出する（純粋関数）。
 *
 * 構造:
 * - <h5>令和X年</h5>
 * - <h6><a href="...">第N回定例会</a></h6>
 */
export function parseTopPage(
  html: string
): { year: number; sessionTitle: string; url: string }[] {
  const results: { year: number; sessionTitle: string; url: string }[] = [];

  // h5 と h6 を順に走査して年度と会議名を対応付ける
  // h5 タグの後に続く h6 タグが同じ年度に属する
  const blockPattern = /<h5[^>]*>([\s\S]*?)<\/h5>([\s\S]*?)(?=<h5|$)/gi;

  for (const blockMatch of html.matchAll(blockPattern)) {
    const h5Content = blockMatch[1]!;
    const blockContent = blockMatch[2]!;

    const year = parseWarekiYear(h5Content);
    if (!year) continue;

    // h6 内の a タグを抽出
    const linkPattern = /<h6[^>]*>[\s\S]*?<a[^>]+href="([^"]+)"[^>]*>([\s\S]*?)<\/a>[\s\S]*?<\/h6>/gi;
    for (const linkMatch of blockContent.matchAll(linkPattern)) {
      const href = linkMatch[1]!.trim();
      const rawTitle = linkMatch[2]!.replace(/<[^>]+>/g, "").trim();

      if (!href || !rawTitle) continue;

      // 絶対 URL に変換
      let url: string;
      if (href.startsWith("http")) {
        url = href;
      } else if (href.startsWith("/")) {
        url = `${BASE_ORIGIN}${href}`;
      } else {
        // 相対パス（例: assembly/2025_12_teireikai.html）
        url = `${BASE_ORIGIN}/kurashi/gyousei/${href}`;
      }

      results.push({ year, sessionTitle: rawTitle, url });
    }
  }

  return results;
}

/**
 * 各定例会ページの HTML から本文 PDF リンクを抽出する（純粋関数）。
 *
 * 各号ごとに「名簿」と「本文」の2つの PDF がある。
 * 「本文」のみを対象とする（リンクテキストまたはファイル名で判断）。
 */
export function parsePdfLinks(
  html: string,
  baseUrl: string
): { pdfUrl: string; goNumber: string }[] {
  const results: { pdfUrl: string; goNumber: string }[] = [];

  const linkPattern = /<a[^>]+href="([^"]*\.pdf)"[^>]*>([\s\S]*?)<\/a>/gi;

  for (const match of html.matchAll(linkPattern)) {
    const href = match[1]!.trim();
    const rawText = match[2]!.replace(/<[^>]+>/g, "").trim();

    if (!href || !rawText) continue;

    // 本文 PDF のみ対象（名簿はスキップ）
    const isHonbun =
      rawText.includes("本文") ||
      href.toLowerCase().includes("honbun") ||
      href.toLowerCase().includes("_2") ||  // 古い命名規則: {和暦}-{回}-{号}-2.pdf
      rawText.includes("会議録");

    const isMeibo =
      rawText.includes("名簿") ||
      href.toLowerCase().includes("meibo") ||
      href.toLowerCase().includes("_1");  // 古い命名規則: {和暦}-{回}-{号}-1.pdf

    // 名簿は除外
    if (isMeibo && !isHonbun) continue;

    // 本文でない場合もスキップ
    if (!isHonbun) continue;

    // 絶対 URL に変換
    let pdfUrl: string;
    if (href.startsWith("http")) {
      pdfUrl = href;
    } else if (href.startsWith("/")) {
      pdfUrl = `${BASE_ORIGIN}${href}`;
    } else {
      // 相対パス
      const baseDir = baseUrl.replace(/\/[^/]+$/, "/");
      pdfUrl = baseDir + href;
    }

    // 号数を抽出（「第1号」「第2号」等）
    const goMatch = rawText.match(/第(\d+)号/);
    const goNumber = goMatch ? `第${goMatch[1]}号` : "第1号";

    results.push({ pdfUrl, goNumber });
  }

  return results;
}

/**
 * 指定年の会議録セッション一覧を取得する。
 * トップページ → 各定例会ページ → 本文 PDF の順にクロール。
 */
export async function fetchSessionList(
  year: number
): Promise<ShowaGunmaSession[]> {
  const topUrl = `${BASE_ORIGIN}${TOP_PAGE_PATH}`;
  const topHtml = await fetchPage(topUrl);
  if (!topHtml) return [];

  await delay(INTER_PAGE_DELAY_MS);

  // トップページから年度・会議の一覧を取得
  const allSessions = parseTopPage(topHtml);

  // 指定年のセッションのみ対象
  const targetSessions = allSessions.filter((s) => s.year === year);

  const results: ShowaGunmaSession[] = [];

  for (const session of targetSessions) {
    const sessionHtml = await fetchPage(session.url);
    if (!sessionHtml) {
      await delay(INTER_PAGE_DELAY_MS);
      continue;
    }

    await delay(INTER_PAGE_DELAY_MS);

    const pdfLinks = parsePdfLinks(sessionHtml, session.url);

    for (const { pdfUrl, goNumber } of pdfLinks) {
      results.push({
        title: `${session.sessionTitle}${goNumber}`,
        year: session.year,
        pdfUrl,
        goNumber,
        meetingType: detectMeetingType(session.sessionTitle),
      });
    }
  }

  return results;
}
