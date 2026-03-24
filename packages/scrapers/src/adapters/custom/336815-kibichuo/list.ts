/**
 * 吉備中央町議会 -- list フェーズ
 *
 * 会議録ページ (7847.html) から全 PDF リンクを収集する。
 *
 * 会議録は全年度分が1ページにまとめて掲載されており、
 * ページネーションは不要。
 *
 * 構造:
 *   <h2 ...>2024年(令和6年)</h2>
 *   <h3 ...>第6回12月定例会</h3>
 *   <a href="/uploaded/attachment/{ID}.pdf">一般質問概要書</a>
 *   <a href="/uploaded/attachment/{ID}.pdf">1日目</a>
 *   ...
 *
 * 「一般質問概要書」は発言録でないのでスキップする。
 * 開催日は PDF 本文から抽出する（detail フェーズで実施）。
 */

import {
  BASE_ORIGIN,
  convertHeadingToWesternYear,
  detectMeetingType,
  fetchPage,
  LIST_PAGE_URL,
  toHalfWidth,
} from "./shared";

export interface KibiChuoPdfLink {
  /** 会議タイトル（例: "第6回12月定例会 1日目"） */
  title: string;
  /** PDF の絶対 URL */
  pdfUrl: string;
  /** 会議種別 */
  meetingType: string;
  /** 年度（西暦） */
  headingYear: number;
}

/**
 * 一覧ページ HTML から PDF リンクをパースする。
 *
 * HTML 構造:
 *   <p><strong>2024年(令和6年)</strong></p>
 *   <p>・第6回12月定例会　<a href="/uploaded/attachment/11548.pdf">一般質問概要書 [PDFファイル／360KB]</a></p>
 *   <p>　<a href="/uploaded/attachment/11549.pdf">1日目 [PDFファイル／362KB]</a></p>
 *
 * 年情報: <p><strong>...年...</strong></p> パターン
 * 会議情報: <p>の中に「定例会」「臨時会」「委員会」を含むテキスト
 * 「一般質問概要書」のリンクはスキップする。
 */
export function parseListPage(html: string): KibiChuoPdfLink[] {
  const results: KibiChuoPdfLink[] = [];

  // 年情報と会議名の位置を収集
  const yearHeadings: { year: number; position: number }[] = [];
  const sessionHeadings: { session: string; position: number }[] = [];

  // 年見出し: <p><strong>2024年(令和6年)</strong></p>
  // または h2/h3 内の年情報
  const yearHeadingPattern = /<(?:p|h[2-4])[^>]*>\s*(?:<strong[^>]*>)?\s*((?:\d{4}年|令和|平成)[^<]*)\s*(?:<\/strong>)?\s*<\/(?:p|h[2-4])>/gi;
  let hm: RegExpExecArray | null;
  while ((hm = yearHeadingPattern.exec(html)) !== null) {
    const innerText = hm[1]!.replace(/<[^>]+>/g, "").trim();
    const year = convertHeadingToWesternYear(innerText);
    if (year) {
      yearHeadings.push({ year, position: hm.index });
    }
  }

  // 会議見出し: <p> タグの中に「・第X回...定例会/臨時会」を含むもの
  // ただし a タグ内のテキストは除く
  const sessionPattern = /<p[^>]*>([\s\S]*?)<\/p>/gi;
  while ((hm = sessionPattern.exec(html)) !== null) {
    const innerText = hm[1]!.replace(/<a[^>]*>[\s\S]*?<\/a>/gi, "").replace(/<[^>]+>/g, "").trim();
    const normalized = toHalfWidth(innerText.replace(/^[・\s・]+/, "").replace(/\s+/g, " ").trim());
    if (normalized.includes("定例会") || normalized.includes("臨時会") || normalized.includes("委員会")) {
      // 重複チェック（近い位置に同じものがある場合はスキップ）
      if (!sessionHeadings.some((s) => Math.abs(s.position - hm!.index) < 200 && s.session === normalized)) {
        sessionHeadings.push({ session: normalized, position: hm.index });
      }
    }
  }

  // PDFリンクを抽出: /uploaded/attachment/{ID}.pdf
  const linkPattern = /<a\s[^>]*href="(\/uploaded\/attachment\/[^"]+\.pdf)"[^>]*>([\s\S]*?)<\/a>/gi;
  let am: RegExpExecArray | null;
  while ((am = linkPattern.exec(html)) !== null) {
    const href = am[1]!;
    const rawLinkText = am[2]!.replace(/<[^>]+>/g, "").trim();
    const linkPosition = am.index;

    // 「一般質問概要書」はスキップ
    if (rawLinkText.includes("一般質問概要書")) continue;

    // "[PDFファイル／...]" を除去してリンクテキストを正規化
    const linkText = toHalfWidth(
      rawLinkText.replace(/\[PDFファイル[^\]]*\]/g, "").replace(/\s+/g, " ").trim(),
    );
    if (!linkText) continue;

    // リンク直前の年見出しを取得
    let currentYear: number | null = null;
    for (const h of yearHeadings) {
      if (h.position < linkPosition) {
        currentYear = h.year;
      }
    }
    if (!currentYear) continue;

    // リンク直前の会議見出しを取得
    let currentSession = "";
    for (const s of sessionHeadings) {
      if (s.position < linkPosition) {
        currentSession = s.session;
      }
    }

    const title = currentSession ? `${currentSession} ${linkText}` : linkText;
    const pdfUrl = `${BASE_ORIGIN}${href}`;
    const meetingType = detectMeetingType(title);

    results.push({
      title,
      pdfUrl,
      meetingType,
      headingYear: currentYear,
    });
  }

  return results;
}

/**
 * 指定年の PDF リンクを収集する。
 *
 * LIST_PAGE_URL を取得し、全 PDF リンクをパースした後、
 * 対象年のものだけをフィルタリングして返す。
 */
export async function fetchDocumentList(
  year: number,
): Promise<KibiChuoPdfLink[]> {
  const html = await fetchPage(LIST_PAGE_URL);
  if (!html) return [];

  const allLinks = parseListPage(html);
  return allLinks.filter((link) => link.headingYear === year);
}
