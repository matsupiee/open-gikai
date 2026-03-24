/**
 * 美浜町議会（和歌山県） — list フェーズ
 *
 * 2段階クロール:
 * 1. トップページと記事一覧ページから年度別記事ページの URL を収集する
 * 2. 各年度ページから PDF リンク（目次を除く）を抽出する
 *
 * 各 PDF が fetchDetail の1レコードに対応する。
 */

import {
  BASE_ORIGIN,
  TOP_URL,
  GIKAI_LIST_URL,
  detectMeetingType,
  parseWarekiYear,
  fetchPage,
  delay,
} from "./shared";

export interface MihamaSessionInfo {
  /** 会議タイトル（リンクテキストから取得） */
  title: string;
  /** 開催日 YYYY-MM-DD（解析できない場合は null） */
  heldOn: string | null;
  /** PDF の絶対 URL */
  pdfUrl: string;
  /** 年度別記事ページの絶対 URL */
  yearPageUrl: string;
  /** 会議種別 */
  meetingType: "plenary" | "extraordinary" | "committee";
}

const INTER_REQUEST_DELAY_MS = 2000;

/**
 * トップページまたは記事一覧ページから年度別記事ページへのリンクを抽出する。
 *
 * パターン: /docs/{記事ID}/ 形式のリンク
 */
export function extractYearPageUrls(html: string): string[] {
  const urls: string[] = [];
  // /docs/{数字ID}/ パターンのリンクを抽出
  const pattern = /href="(\/docs\/\d+\/)"/g;

  for (const match of html.matchAll(pattern)) {
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
 * PDF リンクテキストから会議タイトルと開催日を解析する。
 *
 * リンクテキスト例:
 * - "第４回定例会目次(86KB)" → 目次なのでスキップ
 * - "第４回定例会（第１日）(266KB)" → title生成・日付はnull
 * - "第１回臨時会（第１日）(150KB)" → title生成・日付はnull
 */
export function parsePdfLinkText(
  linkText: string,
  h2Text: string,
): { title: string; heldOn: string | null; meetingType: "plenary" | "extraordinary" | "committee" } | null {
  // 目次 PDF はスキップ
  if (linkText.includes("目次")) return null;

  const meetingType = detectMeetingType(h2Text);

  // h2 から年度を取得
  const westernYear = parseWarekiYear(h2Text);

  // タイトルを生成: h2テキスト + リンクテキスト（ファイルサイズ表記を除去）
  const cleanLinkText = linkText.replace(/\(\d+KB\)/, "").trim();
  const title = h2Text ? `${h2Text} ${cleanLinkText}` : cleanLinkText;

  // heldOn は PDF テキストから抽出するため、ここでは null を返す
  // ただしファイル名のヒントがあれば利用する
  void westernYear;

  return {
    title,
    heldOn: null,
    meetingType,
  };
}

/**
 * 年度別記事ページ HTML から PDF セッション情報を抽出する。
 *
 * HTML 構造:
 * <div class="body">
 *   <h2>令和７年 第４回（１２月）定例会</h2>
 *   <p><a class="iconFile iconPdf" href="./files/0712mokuzi.pdf">第４回定例会目次(86KB)</a></p>
 *   <p><a class="iconFile iconPdf" href="./files/0712teirei1.pdf">第４回定例会（第１日）(266KB)</a></p>
 * </div>
 */
export function parsePdfLinks(html: string, yearPageUrl: string): MihamaSessionInfo[] {
  const results: MihamaSessionInfo[] = [];

  // div.body 内のコンテンツを取得（class="body" に厳密にマッチ）
  const bodyMatch = html.match(/<div\s+class="body">([\s\S]*?)<\/div>/i);
  if (!bodyMatch?.[1]) return results;

  const bodyContent = bodyMatch[1];

  // h2 タグと PDF リンクを順番に処理
  // h2 → a[href$=".pdf"] の順序で会議名とPDFを対応づける
  const segments = bodyContent.split(/<h2[^>]*>/i);

  for (const segment of segments.slice(1)) {
    // h2 のテキスト内容を抽出
    const h2EndIdx = segment.indexOf("</h2>");
    if (h2EndIdx === -1) continue;

    const h2Raw = segment.slice(0, h2EndIdx);
    const h2Text = h2Raw
      .replace(/<[^>]+>/g, "")
      .replace(/&nbsp;/g, " ")
      .replace(/\s+/g, " ")
      .trim();

    if (!h2Text) continue;

    // この h2 に続く PDF リンクを抽出
    const afterH2 = segment.slice(h2EndIdx + 5);
    const pdfPattern = /href="(\.\/files\/[^"]+\.pdf)"[^>]*>([^<]+)/gi;

    for (const pdfMatch of afterH2.matchAll(pdfPattern)) {
      const hrefRelative = pdfMatch[1];
      const linkText = pdfMatch[2]?.trim();

      if (!hrefRelative || !linkText) continue;

      // 目次 PDF はスキップ
      if (linkText.includes("目次")) continue;

      // 相対パスを絶対 URL に変換
      // yearPageUrl: http://www.town.mihama.wakayama.jp/docs/{記事ID}/
      const pdfUrl = new URL(hrefRelative, yearPageUrl).toString();

      const parsed = parsePdfLinkText(linkText, h2Text);
      if (!parsed) continue;

      results.push({
        title: parsed.title,
        heldOn: parsed.heldOn,
        pdfUrl,
        yearPageUrl,
        meetingType: parsed.meetingType,
      });
    }
  }

  return results;
}

/**
 * 指定年に対応する年度別ページ URL の一覧を収集する。
 *
 * トップページと記事一覧ページの両方からリンクを収集する。
 */
export async function fetchYearPageUrls(): Promise<string[]> {
  const urlSet = new Set<string>();

  // トップページから収集
  const topHtml = await fetchPage(TOP_URL);
  if (topHtml) {
    for (const url of extractYearPageUrls(topHtml)) {
      urlSet.add(url);
    }
  }

  await delay(INTER_REQUEST_DELAY_MS);

  // 記事一覧ページから収集（古い年度を含む）
  const listHtml = await fetchPage(GIKAI_LIST_URL);
  if (listHtml) {
    for (const url of extractYearPageUrls(listHtml)) {
      urlSet.add(url);
    }
  }

  return Array.from(urlSet);
}

/**
 * 年度別ページの h2 テキストから西暦年を推定する。
 * 例: "令和７年 第４回（１２月）定例会" → 2025
 */
function estimateYearFromPageH2(html: string): number | null {
  const h2Match = html.match(/<h2[^>]*>([\s\S]*?)<\/h2>/i);
  if (!h2Match?.[1]) return null;
  const text = h2Match[1].replace(/<[^>]+>/g, "").replace(/\s+/g, "");
  return parseWarekiYear(text);
}

/**
 * 指定年のセッション一覧を取得する。
 */
export async function fetchSessionList(year: number): Promise<MihamaSessionInfo[]> {
  const yearPageUrls = await fetchYearPageUrls();
  const allSessions: MihamaSessionInfo[] = [];

  for (const yearPageUrl of yearPageUrls) {
    await delay(INTER_REQUEST_DELAY_MS);

    const html = await fetchPage(yearPageUrl);
    if (!html) continue;

    // このページが対象年に属するか確認
    const pageYear = estimateYearFromPageH2(html);
    if (pageYear !== null && pageYear !== year) continue;

    const sessions = parsePdfLinks(html, yearPageUrl);
    allSessions.push(...sessions);
  }

  return allSessions;
}
