/**
 * 三宅町議会 — list フェーズ
 *
 * 3つの索引ページから PDF リンクを収集する:
 *   1. https://www.town.miyake.lg.jp/site/gikai/8736.html（平成31年以降）
 *   2. https://www.town.miyake.lg.jp/site/gikai/1109.html（平成30年以前）
 *   3. https://www.town.miyake.lg.jp/site/gikai/8725.html（式下中学校組合議会）
 *
 * HTML 構造:
 *   <h2>令和X年</h2>
 *   <ul>
 *     <li><a href="/uploaded/attachment/{ID}.pdf">第N回定例会（M月）</a></li>
 *   </ul>
 */

import {
  BASE_ORIGIN,
  INDEX_URL_RECENT,
  INDEX_URL_OLDER,
  INDEX_URL_SHIKISHITA,
  detectMeetingType,
  parseWarekiYear,
  fetchPage,
  delay,
} from "./shared";

export interface MiyakeSessionInfo {
  /** 会議タイトル（例: "第1回定例会（3月）"） */
  title: string;
  /** 開催年 */
  year: number;
  /** PDF の絶対 URL */
  pdfUrl: string;
  /** 会議種別 */
  meetingType: string;
}

/**
 * 索引ページ HTML から指定年度の PDF リンクを抽出する（純粋関数）。
 *
 * HTML 構造:
 *   見出し要素（h2/h3/p 等）に年度テキスト（"令和X年" 等）が含まれ、
 *   その後の <a href="/uploaded/attachment/*.pdf"> でPDFリンクが続く。
 */
export function parseListPage(html: string, targetYear: number): MiyakeSessionInfo[] {
  const records: MiyakeSessionInfo[] = [];
  const seen = new Set<string>();

  // 年度見出しと PDF リンクを逐次解析する
  // ページ全体を行ごとに処理し、現在の年度コンテキストを追跡する
  let currentYear: number | null = null;

  // 見出しタグ（h1〜h4, strong, p など）に年度テキストがある場合を検出
  // また、テキストノード中の年度表記も検出
  const yearHeadingPattern = /<(?:h[1-6]|strong|b)[^>]*>([\s\S]*?)<\/(?:h[1-6]|strong|b)>/gi;
  const pdfLinkPattern = /href="(\/uploaded\/attachment\/[^"]+\.pdf)"[^>]*>([\s\S]*?)<\/a>/gi;

  // ページ全体のテキストをトークン化して処理
  // 見出し要素とPDFリンクの相対位置でコンテキストを決定する
  const tokens: Array<{ type: "heading"; year: number; pos: number } | { type: "pdf"; href: string; text: string; pos: number }> = [];

  // 見出し要素から年度を抽出
  for (const m of html.matchAll(yearHeadingPattern)) {
    const innerText = m[1]!.replace(/<[^>]+>/g, "").trim();
    const year = parseWarekiYear(innerText);
    if (year !== null) {
      tokens.push({ type: "heading", year, pos: m.index! });
    }
  }

  // PDF リンクを収集
  for (const m of html.matchAll(pdfLinkPattern)) {
    const href = m[1]!;
    const rawText = m[2]!.replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim();
    tokens.push({ type: "pdf", href, text: rawText, pos: m.index! });
  }

  // 位置順にソート
  tokens.sort((a, b) => a.pos - b.pos);

  // トークンを順に処理して、各 PDF リンクに対応する年度を特定
  for (const token of tokens) {
    if (token.type === "heading") {
      currentYear = token.year;
    } else if (token.type === "pdf" && currentYear !== null) {
      if (currentYear !== targetYear) continue;

      const pdfUrl = `${BASE_ORIGIN}${token.href}`;

      // 重複チェック
      if (seen.has(pdfUrl)) continue;
      seen.add(pdfUrl);

      const title = token.text || "会議録";
      const meetingType = detectMeetingType(title);

      records.push({
        title,
        year: currentYear,
        pdfUrl,
        meetingType,
      });
    }
  }

  return records;
}

/**
 * 指定年の会議録 PDF リンク一覧を取得する。
 * 3つの索引ページを全てクロールする。
 */
export async function fetchDocumentList(year: number): Promise<MiyakeSessionInfo[]> {
  const indexUrls = [INDEX_URL_RECENT, INDEX_URL_OLDER, INDEX_URL_SHIKISHITA];
  const allRecords: MiyakeSessionInfo[] = [];
  const seenUrls = new Set<string>();

  for (const indexUrl of indexUrls) {
    await delay(1000);
    const html = await fetchPage(indexUrl);
    if (!html) continue;

    const records = parseListPage(html, year);
    for (const record of records) {
      if (!seenUrls.has(record.pdfUrl)) {
        seenUrls.add(record.pdfUrl);
        allRecords.push(record);
      }
    }
  }

  return allRecords;
}
