/**
 * 松野町議会（愛媛県） — list フェーズ
 *
 * 年度一覧トップページ → 年度別会議録一覧ページ → PDF リンクを収集する。
 *
 * URL 構造:
 *   トップ:     https://www.town.matsuno.ehime.jp/site/gikai/list156.html
 *   年度別:     https://www.town.matsuno.ehime.jp/site/gikai/{ID}.html
 *   PDF:        https://www.town.matsuno.ehime.jp/uploaded/attachment/{ID}.pdf
 */

import {
  BASE_ORIGIN,
  INDEX_URL,
  fetchPage,
  parseWarekiYear,
  buildDateString,
  detectMeetingType,
  delay,
} from "./shared";

export interface MatsunoSessionInfo {
  /** 会議タイトル（例: "12月定例会（12月13日） 本会議（１日目）"） */
  title: string;
  /** 開催日 YYYY-MM-DD（解析できない場合は null） */
  heldOn: string | null;
  /** PDF の絶対 URL */
  pdfUrl: string;
  /** 会議種別 */
  meetingType: "plenary" | "extraordinary" | "committee";
}

const INTER_PAGE_DELAY_MS = 1500;

/**
 * 年度一覧トップページから各年度別ページの URL を抽出する。
 *
 * パターン: `<a href="/site/gikai/{数値}.html">令和X年</a>`
 * 数値のみの ID を持つリンクを抽出する（list156 などは除外）。
 */
export function parseIndexUrls(html: string): string[] {
  const urls: string[] = [];
  const linkRegex = /href="(\/site\/gikai\/(\d+)\.html)"/g;
  for (const match of html.matchAll(linkRegex)) {
    const path = match[1];
    if (!path) continue;
    const url = `${BASE_ORIGIN}${path}`;
    if (!urls.includes(url)) {
      urls.push(url);
    }
  }
  return urls;
}

/**
 * 年度別会議録一覧ページ HTML から PDF セッション情報を抽出する。
 *
 * 実際の構造:
 *   <h1>令和６年　会議録一覧</h1>
 *   ...
 *   <div class="detail_free"><h2>定例会</h2></div>
 *   <div class="detail_free">
 *     <p><strong>12月定例会（12月13日）</strong></p>
 *     <p><a href="/uploaded/attachment/6205.pdf">本会議（１日目） [PDFファイル／471KB]</a></p>
 *   </div>
 *   ...
 *   <div class="detail_free"><h2>臨時会</h2></div>
 *   <div class="detail_free">
 *     <p><strong>8月臨時会（8月1日）</strong></p>
 *     <p><a href="/uploaded/attachment/6000.pdf">本会議（１日目） [PDFファイル／137KB]</a></p>
 *   </div>
 */
export function parseYearPage(html: string): MatsunoSessionInfo[] {
  const results: MatsunoSessionInfo[] = [];

  // <h1> から年度（西暦）を取得
  const h1Match = html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i);
  const h1Text = h1Match?.[1]?.replace(/<[^>]+>/g, "").trim() ?? "";
  const yearFromH1 = parseWarekiYear(h1Text);

  // 現在の会議種別を追跡する
  let currentMeetingType: "plenary" | "extraordinary" | "committee" = "plenary";
  // 現在の会議セッション情報（strong テキストから）
  let currentSessionLabel: string | null = null;
  let currentHeldOn: string | null = null;

  // <div class="detail_free"> ブロックを順に処理する
  const divRegex = /<div[^>]*class="detail_free"[^>]*>([\s\S]*?)<\/div>/gi;

  for (const divMatch of html.matchAll(divRegex)) {
    const divHtml = divMatch[1] ?? "";

    // h2 タグが含まれる → 会議種別の切り替え
    const h2Match = divHtml.match(/<h2[^>]*>([\s\S]*?)<\/h2>/i);
    if (h2Match) {
      const h2Text = h2Match[1]?.replace(/<[^>]+>/g, "").trim() ?? "";
      currentMeetingType = detectMeetingType(h2Text);
      currentSessionLabel = null;
      currentHeldOn = null;
      continue;
    }

    // <strong> テキストを取得（会議セッション情報: 例 "12月定例会（12月13日）"）
    const strongMatch = divHtml.match(/<strong[^>]*>([\s\S]*?)<\/strong>/i);
    if (strongMatch) {
      const strongText = (strongMatch[1]?.replace(/<[^>]+>/g, "") ?? "")
        .replace(/\u200b/g, "") // ゼロ幅スペースを除去
        .trim();
      if (strongText && !/^[\s　]*$/.test(strongText)) {
        currentSessionLabel = strongText;

        if (yearFromH1) {
          // "（X月X日）" パターンを優先
          const dateParenMatch = strongText.match(
            /（([\d０-９]{1,2}月[\d０-９]{1,2}日)）/,
          );
          if (dateParenMatch?.[1]) {
            currentHeldOn = buildDateString(yearFromH1, dateParenMatch[1]);
          } else {
            // "（X月X日～...）" パターン（範囲の最初の日）
            const dateRangeMatch = strongText.match(
              /（([\d０-９]{1,2}月[\d０-９]{1,2}日)/,
            );
            currentHeldOn = dateRangeMatch?.[1]
              ? buildDateString(yearFromH1, dateRangeMatch[1])
              : null;
          }
        } else {
          currentHeldOn = null;
        }
      }
    }

    // PDF リンクを抽出
    const pdfLinkRegex =
      /href="(\/uploaded\/attachment\/[^"]+\.pdf)"[^>]*>([\s\S]*?)<\/a>/gi;

    for (const linkMatch of divHtml.matchAll(pdfLinkRegex)) {
      const href = linkMatch[1]!;
      const rawLinkText = linkMatch[2]!
        .replace(/<[^>]+>/g, "")
        .replace(/\s+/g, " ")
        .trim();

      // "[PDFファイル／XXX]" 等を除去してリンクテキストを整形
      const linkText = rawLinkText.replace(/\[PDF[^\]]*\]/g, "").trim();
      if (!linkText) continue;

      const pdfUrl = `${BASE_ORIGIN}${href}`;

      // タイトルを組み立てる
      const sessionLabel = currentSessionLabel ?? "";
      const title = sessionLabel ? `${sessionLabel} ${linkText}` : linkText;

      results.push({
        title,
        heldOn: currentHeldOn,
        pdfUrl,
        meetingType: currentMeetingType,
      });
    }
  }

  return results;
}

/**
 * 指定年の PDF セッション情報一覧を取得する。
 *
 * 1. 年度一覧トップページから各年度別ページ URL を取得
 * 2. 各年度別ページを取得して PDF セッション情報を収集
 * 3. heldOn が year に一致するレコードのみ返す
 */
export async function fetchSessionList(
  year: number,
): Promise<MatsunoSessionInfo[]> {
  const indexHtml = await fetchPage(INDEX_URL);
  if (!indexHtml) return [];

  const yearPageUrls = parseIndexUrls(indexHtml);
  const allSessions: MatsunoSessionInfo[] = [];

  for (const url of yearPageUrls) {
    const html = await fetchPage(url);
    if (!html) continue;

    const sessions = parseYearPage(html);
    for (const session of sessions) {
      allSessions.push(session);
    }

    await delay(INTER_PAGE_DELAY_MS);
  }

  // heldOn が year に一致するものを返す
  return allSessions.filter((s) => {
    if (!s.heldOn) return false;
    return s.heldOn.startsWith(`${year}-`);
  });
}
