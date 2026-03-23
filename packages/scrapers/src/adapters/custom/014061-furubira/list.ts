/**
 * 古平町議会 -- list フェーズ
 *
 * 会議録一覧ページ (detail.php?id=59) から全 PDF リンクを収集する。
 *
 * 一覧ページは単一ページ（ページネーションなし）で、
 * 全年度の会議録が1ページに掲載されている。
 *
 * 構造:
 *   <h2 class="sec-title06"><span>令和X年</span></h2>
 *   <ul class="pdf-list">
 *     <li><a href="../common/img/content/xxx.pdf">第１回定例会（第１号）</a></li>
 *   </ul>
 *
 * 1つの年度見出しに対して複数の <ul class="pdf-list"> が存在する場合がある。
 * 開催日はページ上に掲載されていないため、PDF 本文から抽出する（detail フェーズで実施）。
 */

import {
  BASE_ORIGIN,
  convertHeadingToWesternYear,
  detectMeetingType,
  fetchPage,
  toHalfWidth,
} from "./shared";

export interface FurubiraPdfLink {
  /** 会議タイトル（例: "第1回定例会（第1号）"） */
  title: string;
  /** PDF の絶対 URL */
  pdfUrl: string;
  /** 会議種別 */
  meetingType: string;
  /** 年の見出しから取得した西暦年 */
  headingYear: number;
}

/**
 * リンクテキストから会議タイトルを正規化する。
 * 全角数字を半角に変換し、余分な空白を除去する。
 */
export function normalizeLinkText(text: string): string {
  return toHalfWidth(text.replace(/\s+/g, " ").trim());
}

/**
 * 相対パスを絶対 URL に変換する。
 * "../common/img/content/xxx.pdf" → "https://www.town.furubira.lg.jp/common/img/content/xxx.pdf"
 */
export function resolveUrl(href: string): string {
  if (href.startsWith("http")) return href;

  // "../common/img/content/xxx.pdf" → "/common/img/content/xxx.pdf"
  const resolved = href.replace(/^\.\.\//, "/");
  return `${BASE_ORIGIN}${resolved.startsWith("/") ? "" : "/"}${resolved}`;
}

/**
 * 一覧ページ HTML から PDF リンクをパースする。
 *
 * h2.sec-title06 の見出しから年度を取得し、
 * 後続の ul.pdf-list 内の a[href] から PDF リンクを収集する。
 */
export function parseListPage(html: string): FurubiraPdfLink[] {
  const results: FurubiraPdfLink[] = [];

  // h2.sec-title06 タグから年度を抽出して、後続の pdf-list リンクと紐付ける
  // DOM を正規表現でパースする（cheerio 不使用）
  // 戦略: h2.sec-title06 と ul.pdf-list の出現順で紐付ける

  // 全ての h2.sec-title06 とその位置を取得
  const headingPattern =
    /<h2\s[^>]*class="[^"]*sec-title06[^"]*"[^>]*>([\s\S]*?)<\/h2>/gi;
  const headings: { year: number; position: number }[] = [];
  let hm: RegExpExecArray | null;
  while ((hm = headingPattern.exec(html)) !== null) {
    const innerText = hm[1]!.replace(/<[^>]+>/g, "").trim();
    const year = convertHeadingToWesternYear(innerText);
    if (year) {
      headings.push({ year, position: hm.index });
    }
  }

  // 全ての ul.pdf-list 内の a タグを取得
  const listPattern =
    /<ul\s[^>]*class="[^"]*pdf-list[^"]*"[^>]*>([\s\S]*?)<\/ul>/gi;
  let lm: RegExpExecArray | null;
  while ((lm = listPattern.exec(html)) !== null) {
    const listPosition = lm.index;
    const listContent = lm[1]!;

    // この ul の直前の h2 見出しを見つける
    let currentYear: number | null = null;
    for (const h of headings) {
      if (h.position < listPosition) {
        currentYear = h.year;
      }
    }
    if (!currentYear) continue;

    // ul 内の a タグを抽出
    const linkPattern = /<a\s[^>]*href="([^"]*)"[^>]*>([\s\S]*?)<\/a>/gi;
    let am: RegExpExecArray | null;
    while ((am = linkPattern.exec(listContent)) !== null) {
      const href = am[1]!;
      const linkText = am[2]!.replace(/<[^>]+>/g, "").trim();

      // PDF 以外をスキップ（.docx 等）
      if (!href.toLowerCase().endsWith(".pdf")) continue;

      const title = normalizeLinkText(linkText);
      if (!title) continue;

      const pdfUrl = resolveUrl(href);
      const meetingType = detectMeetingType(title);

      results.push({
        title,
        pdfUrl,
        meetingType,
        headingYear: currentYear,
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
 *
 * 古平町は年度（4月〜3月）ではなく暦年（1月〜12月）で区切られているため、
 * headingYear でフィルタする。
 */
export async function fetchDocumentList(
  baseUrl: string,
  year: number,
): Promise<FurubiraPdfLink[]> {
  const html = await fetchPage(baseUrl);
  if (!html) return [];

  const allLinks = parseListPage(html);
  return allLinks.filter((link) => link.headingYear === year);
}
