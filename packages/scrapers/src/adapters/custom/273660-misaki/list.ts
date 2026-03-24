/**
 * 岬町議会 -- list フェーズ
 *
 * 年度別一覧ページから PDF リンクとメタ情報（リンクテキスト）を収集する。
 *
 * URL 構造:
 *   一覧トップ: /soshiki/gikai/chogikai/gijiroku/index.html
 *   年度別ページ: /soshiki/gikai/chogikai/gijiroku/{ページID}.html
 *   PDF: //www.town.misaki.osaka.jp/material/files/group/29/{ファイル名}.pdf
 */

import { BASE_ORIGIN, YEAR_PAGE_IDS, fetchPage, parseJapaneseDate } from "./shared";

export interface MisakiMeeting {
  pdfUrl: string;
  /** リンクテキスト（会議種別・日付情報を含む） */
  title: string;
  /** 開催日 YYYY-MM-DD（リンクテキストから推定可能な場合のみ） */
  heldOn: string | null;
  /** 会議セクション（本会議、常任委員会等） */
  section: string;
}

/**
 * 年度別一覧ページから PDF リンクを抽出する（テスト可能な純粋関数）。
 *
 * HTML 構造（例）:
 *   <h3>本会議</h3>
 *   <ul>
 *     <li><a href="//www.town.misaki.osaka.jp/material/files/group/29/r061224tei3.pdf">令和6年第4回定例会3日目（令和6年12月24日）</a></li>
 *     ...
 *   </ul>
 *   <h3>常任委員会</h3>
 *   <ul>
 *     <li><a href="//www.town.misaki.osaka.jp/material/files/group/29/r061211soumu.pdf">令和6年12月11日　総務文教委員会</a></li>
 *     ...
 *   </ul>
 */
export function parseListPage(html: string): MisakiMeeting[] {
  const results: MisakiMeeting[] = [];

  // h2/h3 見出しの位置を収集
  const sections: { index: number; heading: string }[] = [];
  const headingPattern = /<h[23][^>]*>([\s\S]*?)<\/h[23]>/g;
  for (const match of html.matchAll(headingPattern)) {
    const heading = match[1]!.replace(/<[^>]+>/g, "").trim();
    sections.push({ index: match.index!, heading });
  }

  // PDF リンクを抽出
  const linkPattern = /<a[^>]+href="([^"]*\.pdf)"[^>]*>([\s\S]*?)<\/a>/gi;

  for (const match of html.matchAll(linkPattern)) {
    const linkIndex = match.index!;
    const pdfHref = match[1]!;
    const linkText = match[2]!.replace(/<[^>]+>/g, "").trim();

    // /material/files/group/29/ 配下の PDF のみ対象
    if (!pdfHref.includes("/material/files/")) continue;

    // PDF の URL を絶対 URL に変換
    // href="//www.town.misaki.osaka.jp/..." のようなプロトコル相対 URL にも対応
    const pdfUrl = pdfHref.startsWith("http")
      ? pdfHref
      : pdfHref.startsWith("//")
        ? `https:${pdfHref}`
        : `${BASE_ORIGIN}${pdfHref.startsWith("/") ? "" : "/"}${pdfHref}`;

    // 現在のセクション見出しを特定（直前の h2/h3）
    let currentSection = "";
    for (const section of sections) {
      if (section.index < linkIndex) {
        currentSection = section.heading;
      }
    }

    // リンクテキストから日付を抽出
    const heldOn = parseDateFromLinkText(linkText);

    results.push({
      pdfUrl,
      title: linkText,
      heldOn,
      section: currentSection,
    });
  }

  return results;
}

/**
 * リンクテキストから開催日（YYYY-MM-DD）を抽出する。
 *
 * 岬町のリンクテキスト例:
 *   "令和6年第4回定例会3日目（令和6年12月24日）" → "2024-12-24"
 *   "令和6年12月11日　総務文教委員会" → "2024-12-11"
 *
 * @returns YYYY-MM-DD または null（解析できない場合）
 */
export function parseDateFromLinkText(text: string): string | null {
  const parsed = parseJapaneseDate(text);
  if (!parsed) return null;

  const { year, month, day } = parsed;
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

/**
 * 指定年の全 PDF リンクを取得する。
 */
export async function fetchDocumentList(
  _baseUrl: string,
  year: number
): Promise<MisakiMeeting[]> {
  const pageId = YEAR_PAGE_IDS[year];
  if (!pageId) {
    // 対応していない年度
    return [];
  }

  const yearPageUrl = `${BASE_ORIGIN}/soshiki/gikai/chogikai/gijiroku/${pageId}.html`;
  const html = await fetchPage(yearPageUrl);
  if (!html) return [];

  return parseListPage(html);
}
