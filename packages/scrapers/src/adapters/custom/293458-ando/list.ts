/**
 * 安堵町議会 — list フェーズ
 *
 * 1. 会議録トップページから年度ページ URL を取得
 * 2. 年度ページから会議ブロック（div.mol_attachfileblock）を走査し PDF リンクを収集
 *
 * fetchDetail は MeetingData | null を1件返すため、
 * list フェーズでは開催日ごとに1レコードを返す。
 */

import {
  BASE_ORIGIN,
  detectMeetingType,
  parseWarekiNendo,
  fetchPage,
  delay,
} from "./shared";

export interface AndoSessionInfo {
  /** 会議タイトル（例: "第1回定例会 第1日（3月4日）"） */
  title: string;
  /** 開催日 YYYY-MM-DD */
  heldOn: string;
  /** PDF の絶対 URL */
  pdfUrl: string;
  /** 会議種別 */
  meetingType: string;
  /** 年度ページの記事 ID */
  articleId: string;
}

const INTER_PAGE_DELAY_MS = 1500;

/**
 * 指定年度の全セッション日を収集する。
 */
export async function fetchSessionList(
  baseUrl: string,
  year: number,
): Promise<AndoSessionInfo[]> {
  // Step 1: トップページから年度ページ URL を特定
  const topUrl = baseUrl.replace(/\/$/, "");
  const topHtml = await fetchPage(topUrl);
  if (!topHtml) return [];

  const yearPages = parseYearPageLinks(topHtml);
  const targetPage = yearPages.find((p) => p.nendo === year);
  if (!targetPage) return [];

  await delay(INTER_PAGE_DELAY_MS);

  // Step 2: 年度ページから PDF リンクを収集
  const yearHtml = await fetchPage(targetPage.url);
  if (!yearHtml) return [];

  return parseYearPage(yearHtml, targetPage.articleId, year);
}

// --- HTML パーサー（テスト用に export） ---

export interface YearPageLink {
  nendo: number;
  url: string;
  articleId: string;
}

/**
 * トップページ（ul.category_end）から年度ページリンクを抽出する。
 *
 * HTML 構造:
 *   <ul class="category_end">
 *     <li><a href="https://www.town.ando.nara.jp/0000003897.html">令和7年</a></li>
 *   </ul>
 */
export function parseYearPageLinks(html: string): YearPageLink[] {
  const pages: YearPageLink[] = [];

  // ul.category_end ブロックを抽出
  const ulMatch = html.match(
    /<ul[^>]*class="category_end"[^>]*>([\s\S]*?)<\/ul>/,
  );
  if (!ulMatch) return pages;

  const ulContent = ulMatch[1]!;

  // ul 内のリンクを抽出
  const linkPattern = /<a[^>]+href="([^"]+)"[^>]*>([^<]+)<\/a>/g;

  for (const match of ulContent.matchAll(linkPattern)) {
    const href = match[1]!;
    const text = match[2]!.trim();

    const nendo = parseWarekiNendo(text);
    if (nendo === null) continue;

    // 記事 ID を href から抽出: "0000003757.html" → "3757"
    const idMatch = href.match(/(\d{7,10})\.html/);
    if (!idMatch) continue;

    const articleId = String(parseInt(idMatch[1]!, 10));

    // 絶対 URL に変換
    let url: string;
    if (href.startsWith("http")) {
      url = href;
    } else if (href.startsWith("/")) {
      url = `${BASE_ORIGIN}${href}`;
    } else {
      url = `${BASE_ORIGIN}/${href}`;
    }

    pages.push({ nendo, url, articleId });
  }

  return pages;
}

/**
 * 年度ページから会議ごとの PDF セッションを抽出する。
 *
 * HTML 構造:
 *   <div class="mol_attachfileblock">
 *     <p class="mol_attachfileblock_title">第1回定例会</p>
 *     <ul>
 *       <li><a href="./cmsfiles/contents/0000003/3757/R6.3.4esturan.pdf">第1日（3月4日）</a></li>
 *     </ul>
 *   </div>
 */
export function parseYearPage(
  html: string,
  articleId: string,
  year: number,
): AndoSessionInfo[] {
  const sessions: AndoSessionInfo[] = [];

  // div.mol_attachfileblock ブロックを抽出（class に追加クラスが付く場合に対応）
  const blockPattern =
    /<div[^>]*class="mol_attachfileblock[^"]*"[^>]*>([\s\S]*?)<\/div>/g;

  for (const blockMatch of html.matchAll(blockPattern)) {
    const blockContent = blockMatch[1]!;

    // 会議名を抽出
    const titleMatch = blockContent.match(
      /<p[^>]*class="mol_attachfileblock_title"[^>]*>([^<]+)<\/p>/,
    );
    if (!titleMatch) continue;

    const meetingName = titleMatch[1]!.trim();
    const meetingType = detectMeetingType(meetingName);

    // PDF リンクを抽出（<a> 内に <img> タグが含まれるケースに対応）
    const linkPattern = /<a[^>]+href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/g;

    for (const linkMatch of blockContent.matchAll(linkPattern)) {
      const pdfRelUrl = linkMatch[1]!;
      // HTML タグを除去してテキストのみ取得
      const dayLabel = linkMatch[2]!.replace(/<[^>]+>/g, "").trim();

      // 日付を抽出: "第1日（3月4日）" → month=3, day=4
      const dateMatch = dayLabel.match(/(\d{1,2})月(\d{1,2})日/);
      if (!dateMatch) continue;

      const month = parseInt(dateMatch[1]!, 10);
      const day = parseInt(dateMatch[2]!, 10);

      const heldOn = `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;

      // PDF の絶対 URL を構築
      let pdfUrl: string;
      if (pdfRelUrl.startsWith("http")) {
        pdfUrl = pdfRelUrl;
      } else if (pdfRelUrl.startsWith("/")) {
        pdfUrl = `${BASE_ORIGIN}${pdfRelUrl}`;
      } else if (pdfRelUrl.startsWith("./")) {
        pdfUrl = `${BASE_ORIGIN}/${pdfRelUrl.slice(2)}`;
      } else {
        pdfUrl = `${BASE_ORIGIN}/${pdfRelUrl}`;
      }

      sessions.push({
        title: `${meetingName} ${dayLabel}`,
        heldOn,
        pdfUrl,
        meetingType,
        articleId,
      });
    }
  }

  return sessions;
}
