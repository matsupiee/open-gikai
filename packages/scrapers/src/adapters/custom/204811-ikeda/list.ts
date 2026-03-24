/**
 * 池田町議会（長野県北安曇郡） — list フェーズ
 *
 * 全年度・全会議の PDF リンクが 1 ページに集約されている。
 * h3 で年度セクション（"令和7年"、"平成30年" など）を分け、
 * ul > li > a で PDF リンクを掲載。
 *
 * リンクテキスト例:
 *   "3月定例会 (PDF形式、○○KB)"
 *   "10月臨時会 (PDF形式、○○KB)"
 */

import { BASE_ORIGIN, LIST_URL, eraToWesternYear, fetchPage } from "./shared";

export interface IkedaMeeting {
  pdfUrl: string;
  title: string;
  heldOn: string;
  section: string;
}

/**
 * h3 見出しテキストから西暦年を抽出する。
 * e.g., "令和7年" → 2025, "平成30年" → 2018
 */
export function parseH3Year(heading: string): number | null {
  const match = heading.match(/(令和|平成)(元|\d+)年/);
  if (!match) return null;
  return eraToWesternYear(match[1]!, match[2]!);
}

/**
 * a タグのリンクテキストから会議種別と月を抽出する。
 *
 * 定例会: "3月定例会 (PDF形式、○○KB)"
 *   → { month: 3, section: "定例会" }
 *
 * 臨時会: "10月臨時会 (PDF形式、○○KB)"
 *   → { month: 10, section: "臨時会" }
 */
export function parseLinkText(linkText: string): {
  month: number;
  section: string;
} | null {
  // ファイルサイズ情報を除去
  const cleaned = linkText.replace(/\s*\(PDF[^)]*\)\s*$/, "").trim();

  const teireikai = cleaned.match(/^(\d+)月定例会/);
  if (teireikai) {
    return { month: Number(teireikai[1]), section: "定例会" };
  }

  const rinji = cleaned.match(/^(\d+)月臨時会/);
  if (rinji) {
    return { month: Number(rinji[1]), section: "臨時会" };
  }

  return null;
}

/**
 * 一覧ページの HTML をパースして PDF リンク一覧を返す（テスト可能な純粋関数）。
 *
 * 構造:
 *   <h3>令和7年</h3>
 *   <ul>
 *     <li><a href="./cmsfiles/contents/0000000/115/R7.12T.pdf">12月定例会 (PDF形式、...)</a></li>
 *     ...
 *   </ul>
 */
export function parseListPage(html: string): IkedaMeeting[] {
  const results: IkedaMeeting[] = [];

  // h3 見出しの位置と年を収集
  const h3Pattern = /<h3[^>]*>([\s\S]*?)<\/h3>/gi;
  const h3Sections: { index: number; year: number }[] = [];
  for (const match of html.matchAll(h3Pattern)) {
    const text = match[1]!.replace(/<[^>]+>/g, "").trim();
    const year = parseH3Year(text);
    if (year) {
      h3Sections.push({ index: match.index!, year });
    }
  }

  // PDF リンクを抽出（cmsfiles/contents/0000000/115/ パターン）
  const linkPattern =
    /<a[^>]+href="([^"]*cmsfiles\/contents\/0000000\/115\/[^"]+\.pdf)"[^>]*>([\s\S]*?)<\/a>/gi;

  for (const match of html.matchAll(linkPattern)) {
    const linkIndex = match.index!;
    const href = match[1]!;
    const linkText = match[2]!.replace(/<[^>]+>/g, "").trim();

    // PDF URL を構築
    let pdfUrl: string;
    if (href.startsWith("http")) {
      pdfUrl = href;
    } else if (href.startsWith("//")) {
      pdfUrl = `https:${href}`;
    } else if (href.startsWith("/")) {
      pdfUrl = `${BASE_ORIGIN}${href}`;
    } else if (href.startsWith("./")) {
      pdfUrl = `${BASE_ORIGIN}/${href.slice(2)}`;
    } else {
      pdfUrl = `${BASE_ORIGIN}/${href}`;
    }

    // リンクテキストから月・会議種別を抽出
    const parsed = parseLinkText(linkText);
    if (!parsed) continue;

    // 直前の h3 から年を取得
    const currentH3 = h3Sections.filter((s) => s.index < linkIndex).pop();
    if (!currentH3) continue;

    const year = currentH3.year;
    const month = String(parsed.month).padStart(2, "0");
    const heldOn = `${year}-${month}-01`;
    const title = `${linkText.replace(/\s*\(PDF[^)]*\)\s*$/, "").trim()}`;

    results.push({
      pdfUrl,
      title,
      heldOn,
      section: parsed.section,
    });
  }

  return results;
}

/**
 * 指定年の PDF リンクのみを返す。
 */
export function filterByYear(
  meetings: IkedaMeeting[],
  year: number
): IkedaMeeting[] {
  return meetings.filter((m) => m.heldOn.startsWith(`${year}-`));
}

/**
 * 一覧ページを取得して指定年のミーティング一覧を返す。
 */
export async function fetchMeetingList(year: number): Promise<IkedaMeeting[]> {
  const html = await fetchPage(LIST_URL);
  if (!html) return [];

  const all = parseListPage(html);
  return filterByYear(all, year);
}
