/**
 * 東彼杵町議会 -- list フェーズ
 *
 * 会議録一覧ページ (795.html) から全 PDF リンクを収集する。
 *
 * 一覧ページは単一ページ（ページネーションなし）で、
 * 全年度の会議録が1ページに掲載されている。
 *
 * 構造:
 *   <h2>令和7年議会会議録</h2>
 *   <h3>定例会</h3>
 *   <a href="//www.town.higashisonogi.lg.jp/material/files/group/44/xxx.pdf">
 *     第4回定例会（令和7年12月11日開催） (PDFファイル: 493.7KB)
 *   </a>
 *   <h3>臨時会</h3>
 *   <a href="//www.town.higashisonogi.lg.jp/material/files/group/44/xxx.pdf">
 *     第1回臨時会（令和7年1月29日開催） (PDFファイル: 100.5KB)
 *   </a>
 *
 * リンクテキストから開催日を抽出可能。
 */

import {
  convertHeadingToWesternYear,
  detectMeetingType,
  fetchPage,
  toHalfWidth,
} from "./shared";

export interface HigashisonogiPdfLink {
  /** 会議タイトル（例: "第4回定例会"） */
  title: string;
  /** PDF の絶対 URL */
  pdfUrl: string;
  /** 会議種別 */
  meetingType: string;
  /** 年の見出しから取得した西暦年 */
  headingYear: number;
  /** 開催日（YYYY-MM-DD） */
  heldOn: string;
}

/**
 * リンクテキストから会議情報を抽出する。
 *
 * 例: "第4回定例会（令和7年12月11日開催） (PDFファイル: 493.7KB)"
 *   → { sessionTitle: "第4回定例会", heldOn: "2025-12-11" }
 */
export function parseLinkText(text: string): {
  sessionTitle: string;
  heldOn: string;
} | null {
  const normalized = toHalfWidth(text.replace(/\s+/g, " ").trim());

  const match = normalized.match(
    /第(\d+)回(定例会|臨時会)（(令和|平成)(元|\d+)年(\d+)月(\d+)日開催）/,
  );
  if (!match) return null;

  const sessionNum = match[1]!;
  const sessionType = match[2]!;
  const era = match[3]!;
  const eraYear = match[4] === "元" ? 1 : Number(match[4]);
  const baseYear = era === "令和" ? 2018 : 1988;
  const westernYear = baseYear + eraYear;
  const month = Number(match[5]);
  const day = Number(match[6]);

  const heldOn = `${westernYear}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
  const sessionTitle = `第${sessionNum}回${sessionType}`;

  return { sessionTitle, heldOn };
}

/**
 * プロトコル相対 URL を絶対 URL に変換する。
 * "//www.town.higashisonogi.lg.jp/..." → "https://www.town.higashisonogi.lg.jp/..."
 */
export function resolveUrl(href: string): string {
  if (href.startsWith("http")) return href;
  if (href.startsWith("//")) return `https:${href}`;
  return href;
}

/**
 * 一覧ページ HTML から PDF リンクをパースする。
 *
 * h2 見出しから年度を取得し、h3 見出しとの間にある a[href] から PDF リンクを収集する。
 */
export function parseListPage(html: string): HigashisonogiPdfLink[] {
  const results: HigashisonogiPdfLink[] = [];

  // h2 タグから年度見出しとその位置を取得
  const h2Pattern = /<h2[^>]*>([\s\S]*?)<\/h2>/gi;
  const headings: { year: number; position: number }[] = [];
  let hm: RegExpExecArray | null;
  while ((hm = h2Pattern.exec(html)) !== null) {
    const innerText = hm[1]!.replace(/<[^>]+>/g, "").trim();
    const year = convertHeadingToWesternYear(innerText);
    if (year) {
      headings.push({ year, position: hm.index });
    }
  }

  if (headings.length === 0) return results;

  // 各年度見出しの範囲内で PDF リンクを抽出
  for (let i = 0; i < headings.length; i++) {
    const start = headings[i]!.position;
    const end =
      i + 1 < headings.length ? headings[i + 1]!.position : html.length;
    const section = html.slice(start, end);
    const currentYear = headings[i]!.year;

    // セクション内の全 a タグを抽出
    const linkPattern = /<a\s[^>]*href="([^"]*)"[^>]*>([\s\S]*?)<\/a>/gi;
    let am: RegExpExecArray | null;
    while ((am = linkPattern.exec(section)) !== null) {
      const href = am[1]!;
      const linkText = am[2]!.replace(/<[^>]+>/g, "").trim();

      // PDF 以外をスキップ
      if (!href.toLowerCase().endsWith(".pdf")) continue;

      const parsed = parseLinkText(linkText);
      if (!parsed) continue;

      const pdfUrl = resolveUrl(href);
      const meetingType = detectMeetingType(parsed.sessionTitle);

      results.push({
        title: parsed.sessionTitle,
        pdfUrl,
        meetingType,
        headingYear: currentYear,
        heldOn: parsed.heldOn,
      });
    }
  }

  return results;
}

/**
 * 指定年の PDF リンクを収集する。
 *
 * baseUrl を取得し、全 PDF リンクをパースした後、
 * 対象年のものだけをフィルタリングして返す。
 */
export async function fetchDocumentList(
  baseUrl: string,
  year: number,
): Promise<HigashisonogiPdfLink[]> {
  const html = await fetchPage(baseUrl);
  if (!html) return [];

  const allLinks = parseListPage(html);
  return allLinks.filter((link) => link.headingYear === year);
}
