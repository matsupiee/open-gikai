/**
 * 壱岐市議会 会議録 -- list フェーズ
 *
 * 2段階クロール:
 *   Step1: 年度一覧ページ (index.html) から対象年の年度別ページ URL を取得
 *   Step2: 年度別ページから「第N号」を含む会議録本体 PDF リンクを収集
 *
 * ページ構造（年度別ページ）:
 *   <h2><strong>令和6年本会議　壱岐市議会本会議</strong></h2>
 *   <h3>...<span>定例会1月会議</span>...</h3>
 *   <p class="file-link-item"><a href="//...0601g1gou.pdf">第1号(1月16日) ...</a></p>
 *   ...
 *
 * リンクテキストから開催日を抽出する。
 * 年度情報は年度別ページの h2 見出しから取得する。
 */

import {
  BASE_ORIGIN,
  INDEX_URL,
  convertHeadingToWesternYear,
  detectMeetingType,
  fetchPage,
  resolveUrl,
  toHalfWidth,
} from "./shared";

export interface IkiPdfLink {
  /** 会議録タイトル（例: "定例会1月会議 第1号"） */
  title: string;
  /** PDF の絶対 URL */
  pdfUrl: string;
  /** 会議種別 */
  meetingType: string;
  /** 年度ページから取得した西暦年 */
  headingYear: number;
  /** 開催日（YYYY-MM-DD）。リンクテキストの括弧内から年+月日で構成 */
  heldOn: string | null;
}

/**
 * リンクテキスト中の括弧内日付を解析して YYYY-MM-DD を返す。
 *
 * 対応パターン:
 *   "第1号(1月16日)"    → 月=1, 日=16
 *   "第1号（12月6日）"  → 月=12, 日=6
 *   "第1号(5月2日)"     → 月=5, 日=2
 */
export function parseDateFromLinkText(
  linkText: string,
  year: number,
): string | null {
  const normalized = toHalfWidth(linkText);
  // 全角括弧・半角括弧どちらも対応
  const match = normalized.match(/[（(](\d+)月(\d+)日[）)]/);
  if (!match) return null;

  const month = Number(match[1]);
  const day = Number(match[2]);
  if (month < 1 || month > 12 || day < 1 || day > 31) return null;

  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

/**
 * 年度一覧ページ HTML から各年度への href を抽出する。
 *
 * パターン: /soshiki/gikai_jimukyoku/shigikai/kaigiroku/{ページID}.html
 */
export function parseIndexPage(html: string): Array<{
  pageUrl: string;
  linkText: string;
}> {
  const results: Array<{ pageUrl: string; linkText: string }> = [];
  // href は絶対 URL で提供される場合と相対パスの場合がある
  const linkPattern =
    /href="((?:https?:\/\/www\.city\.iki\.nagasaki\.jp)?\/soshiki\/gikai_jimukyoku\/shigikai\/kaigiroku\/(\d+)\.html)"[^>]*>([\s\S]*?)<\/a>/gi;

  for (const match of html.matchAll(linkPattern)) {
    const href = match[1]!;
    const text = match[3]!.replace(/<[^>]+>/g, "").trim();
    if (!text) continue;

    // 絶対 URL であればそのまま、相対パスなら BASE_ORIGIN を付加
    const pageUrl = href.startsWith("http") ? href : `${BASE_ORIGIN}${href}`;

    results.push({
      pageUrl,
      linkText: text,
    });
  }

  // 重複除去
  const seen = new Set<string>();
  return results.filter((r) => {
    if (seen.has(r.pageUrl)) return false;
    seen.add(r.pageUrl);
    return true;
  });
}

/**
 * 年度別ページ HTML から「第N号」を含む PDF リンクを抽出する。
 *
 * h2 見出し → 年度、h3 見出し → 会議名として紐付ける。
 * 「第N号」を含むリンクテキストのみ取得（目次・審議期間日程・資料・一括は除外）。
 */
export function parseYearPage(
  html: string,
  headingYear: number,
): IkiPdfLink[] {
  const results: IkiPdfLink[] = [];

  // h3 見出しとその位置を収集（「定例会〇月会議」「臨時会〇月会議」など）
  const h3Pattern = /<h3[^>]*>([\s\S]*?)<\/h3>/gi;
  const sections: { title: string; position: number }[] = [];
  let hm: RegExpExecArray | null;
  while ((hm = h3Pattern.exec(html)) !== null) {
    const innerText = hm[1]!.replace(/<[^>]+>/g, "").trim();
    // 会議に関係するh3のみ（定例会・臨時会を含む）
    if (innerText.includes("定例会") || innerText.includes("臨時会")) {
      sections.push({ title: innerText, position: hm.index });
    }
  }

  if (sections.length === 0) return results;

  // 各セクションの範囲内で PDF リンクを抽出
  for (let i = 0; i < sections.length; i++) {
    const start = sections[i]!.position;
    const end =
      i + 1 < sections.length ? sections[i + 1]!.position : html.length;
    const section = html.slice(start, end);
    const sessionTitle = sections[i]!.title;
    const meetingType = detectMeetingType(sessionTitle);

    const linkPattern =
      /<a[^>]*href="([^"]*\.pdf)"[^>]*>([\s\S]*?)<\/a>/gi;
    let lm: RegExpExecArray | null;
    while ((lm = linkPattern.exec(section)) !== null) {
      const href = lm[1]!;
      const rawLinkText = lm[2]!.replace(/<[^>]+>/g, "").trim();

      // PDF 以外をスキップ（念のため）
      if (!href.toLowerCase().endsWith(".pdf")) continue;

      // 「第N号」を含むもののみ（会議録本体）
      if (!/第\d+号/.test(toHalfWidth(rawLinkText))) continue;

      const pdfUrl = resolveUrl(href);
      const heldOn = parseDateFromLinkText(rawLinkText, headingYear);

      results.push({
        title: `${sessionTitle} ${rawLinkText.replace(/\s*\(PDFファイル[^)]*\)/g, "").trim()}`,
        pdfUrl,
        meetingType,
        headingYear,
        heldOn,
      });
    }
  }

  return results;
}

/**
 * 指定年に対応する年度別ページ URL を年度一覧から取得する。
 *
 * 壱岐市では「令和6年本会議 会議録（PDFファイル）」のように表記される。
 * 1月〜3月は前年度（和暦）に属することに注意。
 * シンプルに「西暦が一致するか前後1年以内」で対象ページを絞り込む。
 */
export async function fetchYearPageUrl(year: number): Promise<string | null> {
  const html = await fetchPage(INDEX_URL);
  if (!html) return null;

  const pages = parseIndexPage(html);

  // リンクテキストの和暦から西暦に変換して比較
  for (const page of pages) {
    const westernYear = convertHeadingToWesternYear(page.linkText);
    if (westernYear === year) {
      return page.pageUrl;
    }
  }

  return null;
}

/**
 * 指定年の PDF リンク一覧を取得する。
 */
export async function fetchDocumentList(year: number): Promise<IkiPdfLink[]> {
  const yearPageUrl = await fetchYearPageUrl(year);
  if (!yearPageUrl) return [];

  const html = await fetchPage(yearPageUrl);
  if (!html) return [];

  return parseYearPage(html, year);
}
