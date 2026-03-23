/**
 * 羽幌町議会 — list フェーズ
 *
 * 年度別ページから会議録リンク（PDF or HTML）を収集する。
 * PDF（H25以降）と HTML（H18〜H24）の2パターンに対応。
 */

import {
  BASE_ORIGIN,
  YEAR_PAGE_MAP,
  buildYearPageUrl,
  fetchPage,
  parseDateText,
} from "./shared";

export interface HaboroMeeting {
  /** 会議録 URL（PDF or HTML） */
  url: string;
  /** 会議名（例: "第1回定例会 平成25年3月11日"） */
  title: string;
  /** YYYY-MM-DD */
  heldOn: string;
  /** セクション名（例: "第1回定例会"） */
  section: string;
  /** "pdf" | "html" */
  format: "pdf" | "html";
}

/** 相対 URL を絶対 URL に変換する */
function resolveUrl(href: string, baseUrl: string): string {
  if (href.startsWith("http")) return href;
  if (href.startsWith("./")) return baseUrl + href.slice(2);
  if (href.startsWith("/")) return `${BASE_ORIGIN}${href}`;
  return baseUrl + href;
}

/**
 * 年度ページ HTML から会議録リンクを抽出する（テスト可能な純粋関数）。
 *
 * セクション見出し（h2, h3, h4, caption, strong, th）から会議種別を検出し、
 * PDF (.pdf) または HTML (.html) リンクを抽出する。
 */
export function parseYearPage(
  html: string,
  pageUrl: string,
  format: "pdf" | "html"
): HaboroMeeting[] {
  const baseUrl = pageUrl.replace(/\/[^/]+$/, "/");

  if (format === "pdf") {
    return parsePdfLinks(html, baseUrl);
  }
  return parseHtmlLinks(html, baseUrl);
}

/**
 * セクション見出しの位置とテキストを収集する。
 * h2, h3, h4, caption, strong, th から会議種別を含むものを拾う。
 */
function collectSections(html: string): { index: number; name: string }[] {
  const sections: { index: number; name: string }[] = [];
  const sectionPattern =
    /<(?:h[2-4]|caption|strong|th)[^>]*>([^<]*(?:定例|臨時|委員会)[^<]*)<\/(?:h[2-4]|caption|strong|th)>/gi;

  for (const match of html.matchAll(sectionPattern)) {
    sections.push({
      index: match.index!,
      name: match[1]!.replace(/[\s　]+会議録.*/, "").trim(),
    });
  }

  sections.sort((a, b) => a.index - b.index);
  return sections;
}

/** 現在のリンク位置に対応するセクションを特定する */
function findSection(
  sections: { index: number; name: string }[],
  linkIndex: number
): string {
  let current = "";
  for (const section of sections) {
    if (section.index < linkIndex) {
      current = section.name;
    }
  }
  return current;
}

/**
 * PDF リンクを抽出する。
 */
function parsePdfLinks(html: string, baseUrl: string): HaboroMeeting[] {
  const results: HaboroMeeting[] = [];
  const sections = collectSections(html);

  // <a> タグの href が .pdf で終わるものを対象にする
  const linkPattern = /<a[^>]+href="([^"]+\.pdf)"[^>]*>([\s\S]*?)<\/a>/gi;

  // 各リンクの周辺テキスト（前後の <td> や <li> 内のテキスト）も日付検出に使う
  for (const match of html.matchAll(linkPattern)) {
    const linkIndex = match.index!;
    const href = match[1]!;
    const linkText = match[2]!.replace(/<[^>]+>/g, "").trim();

    // 周辺コンテキスト（リンクの前方300文字）から日付を検出
    const contextBefore = html.slice(Math.max(0, linkIndex - 300), linkIndex);
    // 同じ <tr> や <li> 内のテキストを使うため、直近の行区切りまで遡る
    const rowContext = contextBefore.replace(/<[^>]+>/g, " ").trim();

    const heldOn =
      parseDateText(linkText) ??
      parseDateText(rowContext.split(/\n/).pop() ?? "");
    if (!heldOn) continue;

    const pdfUrl = resolveUrl(href, baseUrl);
    const section = findSection(sections, linkIndex);

    const cleanText = linkText
      .replace(/（PDF[^）]*）/, "")
      .replace(/\(PDF[^)]*\)/, "")
      .trim();
    const title = section ? `${section} ${cleanText}` : cleanText;

    results.push({
      url: pdfUrl,
      title,
      heldOn,
      section,
      format: "pdf",
    });
  }

  return results;
}

/**
 * HTML 会議録リンクを抽出する（H18〜H24）。
 */
function parseHtmlLinks(html: string, baseUrl: string): HaboroMeeting[] {
  const results: HaboroMeeting[] = [];
  const sections = collectSections(html);

  // <a> タグの href が .html で終わるものを対象にする（index.html は除外）
  const linkPattern = /<a[^>]+href="([^"]+\.html)"[^>]*>([^<]*)<\/a>/gi;

  for (const match of html.matchAll(linkPattern)) {
    const linkIndex = match.index!;
    const href = match[1]!;
    const linkText = match[2]!.trim();

    // index.html は年度ページ自体なのでスキップ
    if (/index\.html$/i.test(href)) continue;

    const heldOn = parseDateText(linkText);
    if (!heldOn) continue;

    const htmlUrl = resolveUrl(href, baseUrl);
    const section = findSection(sections, linkIndex);

    const title = section ? `${section} ${linkText}` : linkText;

    results.push({
      url: htmlUrl,
      title,
      heldOn,
      section,
      format: "html",
    });
  }

  return results;
}

/**
 * 指定年の会議録リンクを取得する。
 */
export async function fetchMeetingList(year: number): Promise<HaboroMeeting[]> {
  const pageUrl = buildYearPageUrl(year);
  if (!pageUrl) return [];

  const entry = YEAR_PAGE_MAP[year];
  if (!entry) return [];

  const html = await fetchPage(pageUrl);
  if (!html) return [];

  return parseYearPage(html, pageUrl, entry.format);
}
