/**
 * 那須烏山市議会 — list フェーズ
 *
 * 2 段階で PDF リンクを収集する:
 * 1. 会議録一覧ページ (index.html) のサイドバーから年別ページ URL を取得
 * 2. 年別ページ (page{ID}.html) から PDF URL を収集
 *
 * 「目次」PDF はスキップする（発言内容を含まない）。
 */

import { BASE_ORIGIN, INDEX_PAGE_URL, fetchPage } from "./shared";

export interface NasukarasuyamaMeeting {
  /** PDF の完全 URL */
  pdfUrl: string;
  /** 会議タイトル（例: "令和7年第5回12月定例会 第1日"） */
  title: string;
  /** 開催日 YYYY-MM-DD */
  heldOn: string;
  /** 外部 ID 用（PDF URL から生成） */
  pdfId: string;
}

/**
 * 会議録一覧ページのサイドバーから年別ページの URL を抽出する。
 * <li class="iconPage"> 要素内のリンクを対象とする。
 *
 * <a href="/city-council/minutes/page005826.html">令和7年</a> のような形式を想定。
 * リンクテキストから年を抽出する。見つからない場合は li 要素のテキストも参照する。
 */
export function parseIndexPage(html: string): { url: string; year: number }[] {
  const results: { url: string; year: number }[] = [];

  // <a href="...page{ID}.html">年テキスト</a> 形式を探す
  const linkRegex =
    /<a\b[^>]*href="([^"]*\/city-council\/minutes\/page\w+\.html)"[^>]*>([\s\S]*?)<\/a>/gi;

  for (const match of html.matchAll(linkRegex)) {
    const href = match[1]!;
    const linkText = match[2]!
      .replace(/<[^>]+>/g, "")
      .replace(/&nbsp;/g, " ")
      .replace(/\s+/g, " ")
      .trim();

    // 絶対 URL を構築
    let url: string;
    if (href.startsWith("http")) {
      url = href;
    } else if (href.startsWith("/")) {
      url = `${BASE_ORIGIN}${href}`;
    } else {
      url = `${BASE_ORIGIN}/${href}`;
    }

    // 重複チェック
    if (results.some((r) => r.url === url)) continue;

    // まずリンクテキストから年を取得
    let year = extractYearFromContext(linkText);

    // リンクテキストから取れない場合、li 要素のテキスト（リンク前後 100 文字）を参照
    if (!year) {
      const start = Math.max(0, match.index! - 100);
      const end = Math.min(html.length, match.index! + match[0]!.length + 100);
      const context = html.slice(start, end);
      // 最初にマッチする年をコンテキストから取得するが、リンクよりも前のテキストを優先
      const beforeLink = html.slice(start, match.index!);
      year = extractYearFromContext(beforeLink) ?? extractYearFromContext(context);
    }

    if (!year) continue;

    results.push({ url, year });
  }

  return results;
}

/**
 * テキストから西暦年を抽出する。
 * 和暦（令和・平成）から変換する。
 */
function extractYearFromContext(text: string): number | null {
  // 全角数字を半角に変換
  const normalized = text.replace(/[０-９]/g, (c) =>
    String.fromCharCode(c.charCodeAt(0) - 0xfee0)
  );

  const match = normalized.match(/(令和|平成)(元|\d+)年/);
  if (!match) return null;

  const [, era, eraYearStr] = match;
  const eraYear = eraYearStr === "元" ? 1 : parseInt(eraYearStr!, 10);

  if (era === "令和") return eraYear + 2018;
  if (era === "平成") return eraYear + 1988;
  return null;
}

/**
 * 年別ページから PDF リンクを抽出する。
 *
 * HTML 構造:
 * <h2>第5回12月定例会</h2>
 * <ul>
 *   <li><a href="...pdf">第5回12月定例会 目次</a></li>       ← スキップ
 *   <li><a href="...pdf">第5回12月定例会 第1日（11月28日）</a></li>
 * </ul>
 *
 * 開催日は PDFリンクテキストの「（MM月DD日）」部分と、HTML のテキストから取得する。
 */
export function parseYearlyPage(
  html: string,
  year: number
): { pdfUrl: string; title: string; heldOn: string; pdfId: string }[] {
  const results: { pdfUrl: string; title: string; heldOn: string; pdfId: string }[] = [];

  // <article id="contents"> 内のコンテンツを対象にする
  const contentsMatch = html.match(/<article[^>]*id="contents"[^>]*>([\s\S]*?)<\/article>/i);
  const contentsHtml = contentsMatch ? contentsMatch[1]! : html;

  // h2 セクションと ul リストをペアで処理
  // h2 の後に続く ul を取得する
  const sectionRegex = /<h2[^>]*>([\s\S]*?)<\/h2>([\s\S]*?)(?=<h2|$)/gi;

  for (const sectionMatch of contentsHtml.matchAll(sectionRegex)) {
    const sectionTitle = sectionMatch[1]!
      .replace(/<[^>]+>/g, "")
      .replace(/&nbsp;/g, " ")
      .replace(/\s+/g, " ")
      .trim();
    const sectionContent = sectionMatch[2]!;

    // ul 内の li 要素を処理
    const liRegex = /<li[^>]*>([\s\S]*?)<\/li>/gi;
    for (const liMatch of sectionContent.matchAll(liRegex)) {
      const liContent = liMatch[1]!;

      // PDF リンクを取得
      const linkMatch = liContent.match(/href="([^"]*\.pdf)"/i);
      if (!linkMatch) continue;

      const pdfHref = linkMatch[1]!;

      // PDF URL を構築
      let pdfUrl: string;
      if (pdfHref.startsWith("http")) {
        pdfUrl = pdfHref;
      } else if (pdfHref.startsWith("/")) {
        pdfUrl = `${BASE_ORIGIN}${pdfHref}`;
      } else {
        pdfUrl = `${BASE_ORIGIN}/${pdfHref}`;
      }

      // リンクテキストを取得
      const linkTextMatch = liContent.match(/<a[^>]*>([\s\S]*?)<\/a>/i);
      const linkText = linkTextMatch
        ? linkTextMatch[1]!
            .replace(/<[^>]+>/g, "")
            .replace(/&nbsp;/g, " ")
            .replace(/\s+/g, " ")
            .trim()
        : "";

      // 「目次」はスキップ
      if (linkText.includes("目次")) continue;

      // PDF ファイル名から pdfId を生成
      const pdfIdMatch = pdfUrl.match(/\/([^/]+)\.pdf$/i);
      const pdfId = pdfIdMatch ? pdfIdMatch[1]! : pdfUrl;

      // 開催日を抽出: 「第1日（11月28日）」→ 月、日を取得
      const dateMatch = linkText.match(/（(\d+)月(\d+)日）/);
      let heldOn: string | null = null;
      if (dateMatch) {
        const month = parseInt(dateMatch[1]!, 10);
        const day = parseInt(dateMatch[2]!, 10);
        heldOn = `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
      }

      // 日付が取れない場合はスキップ
      if (!heldOn) continue;

      // タイトルを構築
      const title = linkText || sectionTitle;

      results.push({ pdfUrl, title, heldOn, pdfId });
    }
  }

  return results;
}

/**
 * 指定年の全 PDF リンクを取得する。
 */
export async function fetchMeetingList(
  baseUrl: string,
  year: number
): Promise<NasukarasuyamaMeeting[]> {
  // Step 1: 一覧ページから年別ページ URL を収集
  const indexHtml = await fetchPage(baseUrl || INDEX_PAGE_URL);
  if (!indexHtml) return [];

  const yearPages = parseIndexPage(indexHtml);
  const targetPage = yearPages.find((p) => p.year === year);
  if (!targetPage) return [];

  // Step 2: 年別ページから PDF リンクを収集
  const yearlyHtml = await fetchPage(targetPage.url);
  if (!yearlyHtml) return [];

  const pdfs = parseYearlyPage(yearlyHtml, year);

  return pdfs.map((pdf) => ({
    pdfUrl: pdf.pdfUrl,
    title: pdf.title,
    heldOn: pdf.heldOn,
    pdfId: pdf.pdfId,
  }));
}
