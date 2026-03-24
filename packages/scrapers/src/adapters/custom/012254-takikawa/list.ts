/**
 * 滝川市議会 会議録 — list フェーズ
 *
 * 取得フロー:
 * 1. トップページ (/page/2872.html) から年度別ページへのリンクを収集
 * 2. 年度別ページから PDF リンクと会議回次・種別を収集
 * 3. 指定年の PDF のみを返す
 *
 * ページ構造（トップページ）:
 *   - h2/h3 見出しで会議種別（本会議、委員会等）を区切り
 *   - <a href="/page/{ID}.html"> で年度別ページへのリンク
 *
 * ページ構造（年度別ページ）:
 *   - h2 見出しで会議回次・種別を区切り（例: 第4回臨時会）
 *   - <a href="/uploaded/attachment/{ID}.pdf"> で PDF リンク
 *   - リンクテキスト: "目次"、"{月}月{日}日 [PDFファイル／{サイズ}KB]"
 */

import {
  TOP_PAGE_URL,
  extractYearFromTitle,
  extractMonthDay,
  buildDateString,
  toAbsoluteUrl,
  fetchPage,
} from "./shared";

export interface TakikawaMeeting {
  /** 年度別ページの ID (e.g., "18437") */
  pageId: string;
  /** PDF ファイルの attachment ID (e.g., "18556") */
  attachmentId: string;
  /** 会議タイトル (e.g., "令和7年 第4回定例会 12月3日") */
  title: string;
  /** PDF の絶対 URL */
  pdfUrl: string;
  /** 開催日 YYYY-MM-DD（解析できない場合は null） */
  heldOn: string | null;
  /** 目次 PDF かどうか */
  isIndex: boolean;
}

/**
 * トップページ HTML から年度別ページへのリンクを抽出する。
 * リンクテキストが和暦年度（令和・平成・昭和）を含むもののみを返す。
 * 返り値: { pageId, url, linkText }[]
 */
export function parseTopPage(html: string): { pageId: string; url: string; linkText: string }[] {
  const results: { pageId: string; url: string; linkText: string }[] = [];
  const seen = new Set<string>();

  // /page/{数字}.html 形式のリンクを抽出（リンクテキスト付き）
  const linkRegex = /<a[^>]+href="([^"]*\/page\/(\d+)\.html)"[^>]*>([\s\S]*?)<\/a>/gi;

  for (const match of html.matchAll(linkRegex)) {
    const href = match[1]!;
    const pageId = match[2]!;
    const rawText = match[3]!.replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim();

    // トップページ自体 (2872) は除外
    if (pageId === "2872") continue;
    // 和暦年度を含まないリンクは除外（会議録以外のページリンクを除外）
    if (!/(令和|平成|昭和)(元|\d+)年/.test(rawText)) continue;
    // ただし年度テキストが短くない（会議録以外の長いテキストは除外）
    // e.g., "令和7年" "令和5年" "平成16年～令和元年" はOK
    // e.g., "令和8年7月採用　一般職（社会人経験者）" は除外
    if (rawText.length > 20) continue;

    if (seen.has(pageId)) continue;

    seen.add(pageId);
    results.push({ pageId, url: toAbsoluteUrl(href), linkText: rawText });
  }

  return results;
}

/**
 * 年度別ページ HTML から PDF リンクと会議情報を抽出する。
 * pageId: 年度別ページの ID
 * year: 対象年（タイトルから推定した年）
 */
export function parseYearPage(
  html: string,
  _pageId: string,
  year: number
): Omit<TakikawaMeeting, "pageId">[] {
  const results: Omit<TakikawaMeeting, "pageId">[] = [];

  // h2 見出しごとに会議セクションを分割
  // h2 見出しの例: "第4回臨時会" "第1回定例会"
  const sectionRegex = /<h2[^>]*>([\s\S]*?)<\/h2>([\s\S]*?)(?=<h2|$)/gi;
  const sections: { heading: string; content: string }[] = [];

  for (const match of html.matchAll(sectionRegex)) {
    const heading = match[1]!.replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim();
    const content = match[2]!;
    if (heading) {
      sections.push({ heading, content });
    }
  }

  // セクションが見つからない場合はページ全体を1セクションとして処理
  if (sections.length === 0) {
    sections.push({ heading: "", content: html });
  }

  for (const section of sections) {
    const { heading, content } = section;

    // PDF リンクを抽出
    const pdfRegex =
      /<a[^>]+href="([^"]*\/uploaded\/attachment\/(\d+)\.pdf)"[^>]*>([\s\S]*?)<\/a>/gi;

    for (const match of content.matchAll(pdfRegex)) {
      const href = match[1]!;
      const attachmentId = match[2]!;
      const rawText = match[3]!
        .replace(/<[^>]+>/g, "")
        .replace(/\s+/g, " ")
        .trim();

      // 目次 PDF かどうか
      const isIndex = rawText.includes("目次");

      // 開催日の解析（目次は日付なし）
      let heldOn: string | null = null;
      if (!isIndex) {
        const monthDay = extractMonthDay(rawText);
        if (monthDay) {
          heldOn = buildDateString(year, monthDay.month, monthDay.day);
        }
      }

      // タイトルを組み立て
      const sectionPart = heading ? `${heading} ` : "";
      const datePart = isIndex ? "目次" : rawText.replace(/\s*\[.*?\]\s*/g, "").trim();
      const title = `${year}年 ${sectionPart}${datePart}`.trim();

      const pdfUrl = toAbsoluteUrl(href);

      results.push({
        attachmentId,
        title,
        pdfUrl,
        heldOn,
        isIndex,
      });
    }
  }

  return results;
}

/**
 * 指定年の全会議録一覧を取得する。
 * isIndex=true（目次 PDF）は除外する。
 */
export async function fetchMeetingList(year: number): Promise<TakikawaMeeting[]> {
  const meetings: TakikawaMeeting[] = [];
  const seen = new Set<string>();

  // 1. トップページから年度別ページリンクを収集
  const topHtml = await fetchPage(TOP_PAGE_URL);
  if (!topHtml) return meetings;

  const yearPageLinks = parseTopPage(topHtml);

  // 2. 各年度別ページを処理
  for (const { pageId, url, linkText } of yearPageLinks) {
    // リンクテキストから年を取得してフィルタリング
    const linkYear = extractYearFromTitle(linkText);

    // "平成16年～令和元年" のような範囲指定ページ（linkYear=null）はスキップするか、
    // 指定年が範囲内かどうかを別途確認する
    // ここでは linkYear が取得できて year と一致しないページはスキップ
    if (linkYear !== null && linkYear !== year) continue;

    const pageHtml = await fetchPage(url);
    if (!pageHtml) continue;

    // h1 からも年度情報を確認
    const h1Match = pageHtml.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i);
    const h1Text = h1Match ? h1Match[1]!.replace(/<[^>]+>/g, "").trim() : "";

    const pageYear = linkYear ?? extractYearFromTitle(h1Text) ?? null;

    // 年が一致しない場合はスキップ（ただし年が取得できない場合は処理継続）
    if (pageYear !== null && pageYear !== year) continue;

    const entries = parseYearPage(pageHtml, pageId, year);

    for (const entry of entries) {
      // 目次 PDF は除外
      if (entry.isIndex) continue;

      const key = entry.attachmentId;
      if (seen.has(key)) continue;
      seen.add(key);

      meetings.push({ pageId, ...entry });
    }
  }

  return meetings;
}

/**
 * 指定年の目次 PDF 含む全エントリを取得する（動作確認用）。
 */
export async function fetchAllEntries(year: number): Promise<TakikawaMeeting[]> {
  const entries: TakikawaMeeting[] = [];
  const seen = new Set<string>();

  const topHtml = await fetchPage(TOP_PAGE_URL);
  if (!topHtml) return entries;

  const yearPageLinks = parseTopPage(topHtml);

  for (const { pageId, url, linkText } of yearPageLinks) {
    const linkYear = extractYearFromTitle(linkText);
    if (linkYear !== null && linkYear !== year) continue;

    const pageHtml = await fetchPage(url);
    if (!pageHtml) continue;

    const h1Match = pageHtml.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i);
    const h1Text = h1Match ? h1Match[1]!.replace(/<[^>]+>/g, "").trim() : "";

    const pageYear = linkYear ?? extractYearFromTitle(h1Text) ?? null;

    if (pageYear !== null && pageYear !== year) continue;

    const pageEntries = parseYearPage(pageHtml, pageId, year);

    for (const entry of pageEntries) {
      const key = entry.attachmentId;
      if (seen.has(key)) continue;
      seen.add(key);

      entries.push({ pageId, ...entry });
    }
  }

  return entries;
}
