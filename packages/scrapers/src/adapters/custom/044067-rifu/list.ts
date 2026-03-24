/**
 * 利府町議会 — list フェーズ
 *
 * トップページ（年度一覧）から年度別ページのリンクを収集し、
 * 各年度ページから PDF リンクとメタ情報を収集する。
 *
 * HTML 構造:
 * - トップページの <a> タグから /gyosei/chosei/rifuchogikai/2/*.html パターンを収集
 * - 年度別ページには <h2> 見出しで会議種別が区切られる
 * - 各セクション内の <a> タグに PDF リンクが並ぶ
 * - リンクテキストに和暦日付（例: "令和6年12月3日 (PDFファイル: 752.1KB)"）が含まれる
 * - href はプロトコル相対 URL（//www.town.rifu.miyagi.jp/...）
 */

import {
  BASE_ORIGIN,
  TOP_PATH,
  detectMeetingType,
  fetchPage,
  parseWarekiDate,
  delay,
} from "./shared";

export interface RifuMeeting {
  /** PDF の絶対 URL */
  pdfUrl: string;
  /** 会議タイトル（例: "令和6年12月定例会 令和6年12月3日"） */
  title: string;
  /** 開催日 YYYY-MM-DD（解析できない場合は null） */
  heldOn: string | null;
  /** 会議種別 */
  meetingType: "plenary" | "extraordinary" | "committee";
}

/**
 * トップページ HTML から年度別ページの URL を抽出する（テスト可能な純粋関数）。
 *
 * - /gyosei/chosei/rifuchogikai/2/*.html パターンのリンクを抽出
 * - index.html 自身は除外
 */
export function parseTopPage(html: string): string[] {
  const urls: string[] = [];
  const linkRegex =
    /<a\s[^>]*href="([^"]*\/gyosei\/chosei\/rifuchogikai\/2\/[^"]*\.html)"[^>]*>/gi;

  for (const match of html.matchAll(linkRegex)) {
    const href = match[1]!.trim();
    // index.html 自身は除外
    if (href.endsWith("index.html")) continue;

    // 絶対 URL に変換
    let url: string;
    if (href.startsWith("//")) {
      url = `https:${href}`;
    } else if (href.startsWith("http")) {
      url = href;
    } else {
      url = `${BASE_ORIGIN}${href}`;
    }

    if (!urls.includes(url)) {
      urls.push(url);
    }
  }

  return urls;
}

/**
 * 年度別ページ HTML から PDF リンクを抽出する（テスト可能な純粋関数）。
 *
 * アルゴリズム:
 * 1. <h2> タグから会議種別名を取得し、currentSection を更新する
 * 2. 各セクション内の <a> タグから PDF URL とリンクテキストを抽出
 * 3. リンクテキストから開催日（和暦）を解析する
 */
export function parseYearPage(html: string): RifuMeeting[] {
  const results: RifuMeeting[] = [];

  // <h2> セクションで分割する
  // パターン: <h2>...</h2> の後に続くコンテンツ
  const sectionRegex = /<h2[^>]*>([\s\S]*?)<\/h2>([\s\S]*?)(?=<h2|$)/gi;

  for (const sectionMatch of html.matchAll(sectionRegex)) {
    const h2Text = sectionMatch[1]!
      .replace(/<[^>]+>/g, "")
      .replace(/\s+/g, " ")
      .trim();
    const sectionContent = sectionMatch[2]!;

    if (!h2Text) continue;

    // PDF リンクを抽出
    // href はプロトコル相対 URL（//www.town.rifu.miyagi.jp/...）または絶対 URL
    const linkRegex =
      /<a\s[^>]*href="((?:\/\/|https?:\/\/)[^"]*\.pdf|\/[^"]*\.pdf)"[^>]*>([\s\S]*?)<\/a>/gi;

    for (const linkMatch of sectionContent.matchAll(linkRegex)) {
      const href = linkMatch[1]!.trim();
      const rawLinkText = linkMatch[2]!
        .replace(/<[^>]+>/g, "")
        .replace(/\s+/g, " ")
        .trim();

      if (!rawLinkText) continue;

      // 絶対 URL に変換
      let pdfUrl: string;
      if (href.startsWith("//")) {
        pdfUrl = `https:${href}`;
      } else if (href.startsWith("http")) {
        pdfUrl = href;
      } else {
        pdfUrl = `${BASE_ORIGIN}${href}`;
      }

      // リンクテキストから和暦日付を解析
      // 例: "令和6年12月3日 (PDFファイル: 752.1KB)" → "2024-12-03"
      const heldOn = parseWarekiDate(rawLinkText);

      // タイトルを組み立てる（括弧内のファイルサイズ部分は除外）
      const cleanLinkText = rawLinkText.replace(/\s*[（(].*?[）)]\s*$/, "").trim();
      const title = h2Text ? `${h2Text} ${cleanLinkText}` : cleanLinkText;

      results.push({
        pdfUrl,
        title,
        heldOn,
        meetingType: detectMeetingType(h2Text),
      });
    }
  }

  return results;
}

/**
 * 年号から西暦年を計算してターゲット年に一致する年度ページ URL を特定する。
 *
 * 利府町は年度別ページの URL に規則性がないため、
 * トップページから全年度 URL を収集し、各ページから会議録の年を判断する必要がある。
 * そのため、fetchMeetingList は全年度ページを巡回して指定年のものを絞り込む。
 */
export async function fetchMeetingList(year: number): Promise<RifuMeeting[]> {
  const topUrl = `${BASE_ORIGIN}${TOP_PATH}`;
  const topHtml = await fetchPage(topUrl);
  if (!topHtml) return [];

  const yearPageUrls = parseTopPage(topHtml);
  const results: RifuMeeting[] = [];

  for (const pageUrl of yearPageUrls) {
    await delay(500);
    const html = await fetchPage(pageUrl);
    if (!html) continue;

    const meetings = parseYearPage(html);
    // 指定年の会議録のみ収集（heldOn の年で判断）
    for (const meeting of meetings) {
      if (meeting.heldOn) {
        const meetingYear = parseInt(meeting.heldOn.slice(0, 4), 10);
        if (meetingYear === year) {
          results.push(meeting);
        }
      }
    }
  }

  return results;
}
