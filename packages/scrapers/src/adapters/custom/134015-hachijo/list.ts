/**
 * 八丈町議会 — list フェーズ
 *
 * 単一の一覧ページ (kaigiroku.html) から全 PDF リンクを抽出する。
 * ページネーションなし。
 *
 * HTML 構造:
 *   <h3>令和7年　会議録</h3>
 *   <div class="h3text">
 *     <div><a><b>第一回定例会会議録</b></a></div>
 *     <div>
 *       <a href="pdf/kaigiroku/2025/20250101.pdf">（1号　R7.3.3）</a><br>
 *       <a href="pdf/kaigiroku/2025/20250102.pdf">（2号　R7.3.17）</a>
 *     </div>
 *   </div>
 */

import { BASE_ORIGIN, BASE_URL, fetchPage, parseDateText } from "./shared";

export interface HachijoMeeting {
  pdfUrl: string;
  title: string;
  heldOn: string;
  session: string;
}

/**
 * 一覧ページの HTML から指定年の PDF リンクを抽出する（テスト可能な純粋関数）。
 *
 * year に対応する和暦年のセクション（<h3>）内にある PDF リンクを返す。
 */
export function parseListPage(html: string, year: number): HachijoMeeting[] {
  const results: HachijoMeeting[] = [];

  // h3 見出しの位置を収集して年セクションの範囲を特定
  const h3Pattern = /<h3[^>]*>([^<]+)<\/h3>/gi;
  const sections: { index: number; label: string }[] = [];
  for (const match of html.matchAll(h3Pattern)) {
    sections.push({ index: match.index!, label: match[1]!.trim() });
  }

  // 対象年のセクションを見つける
  const targetLabel = yearToLabel(year);
  const targetIdx = sections.findIndex((s) => s.label.includes(targetLabel));
  if (targetIdx === -1) return [];

  const sectionStart = sections[targetIdx]!.index;
  const sectionEnd =
    targetIdx + 1 < sections.length ? sections[targetIdx + 1]!.index : html.length;
  const sectionHtml = html.slice(sectionStart, sectionEnd);

  // b / strong タグで会議名を収集（実際のサイトは <b> を使用）
  const headingPattern = /<(?:b|strong)[^>]*>([^<]+)<\/(?:b|strong)>/gi;
  const sessionHeadings: { index: number; name: string }[] = [];
  for (const match of sectionHtml.matchAll(headingPattern)) {
    const text = match[1]!.trim();
    // 会議録を含むもののみ
    if (!text.includes("会議録")) continue;
    sessionHeadings.push({
      index: match.index!,
      name: text,
    });
  }

  // PDF リンクを抽出
  const linkPattern =
    /<a[^>]+href="([^"]*\.pdf)"[^>]*>([\s\S]*?)<\/a>/gi;

  for (const match of sectionHtml.matchAll(linkPattern)) {
    const linkIndex = match.index!;
    const href = match[1]!;
    const linkText = match[2]!.replace(/<[^>]+>/g, "").trim();

    // 現在のセッション見出しを特定
    let currentSession = "";
    for (const heading of sessionHeadings) {
      if (heading.index < linkIndex) {
        currentSession = heading.name;
      }
    }

    // 日付を抽出
    const heldOn = parseDateText(linkText);
    if (!heldOn) continue;

    // PDF の完全 URL を構築
    let pdfUrl: string;
    if (href.startsWith("http")) {
      pdfUrl = href;
    } else {
      pdfUrl = `${BASE_ORIGIN}${href}`;
    }

    // タイトル構築: セッション名 + リンクテキスト（括弧を除去）
    const cleanLinkText = linkText.replace(/[（()）]/g, "").trim();
    const title = currentSession
      ? `${currentSession.replace(/会議録$/, "")} ${cleanLinkText}`
      : cleanLinkText;

    results.push({ pdfUrl, title, heldOn, session: currentSession });
  }

  return results;
}

/**
 * 西暦年から一覧ページの見出しテキストに使われる和暦ラベルを返す。
 * e.g., 2025 → "令和7年", 2019 → "平成31年" (一覧ページの見出しに合わせる)
 */
function yearToLabel(year: number): string {
  if (year >= 2020) return `令和${year - 2018}年`;
  if (year === 2019) return "平成31年";
  if (year >= 1989) {
    const eraYear = year - 1988;
    return eraYear === 1 ? "平成元年" : `平成${eraYear}年`;
  }
  return `${year}年`;
}

/**
 * 指定年の全 PDF リンクを取得する。
 */
export async function fetchMeetingList(year: number): Promise<HachijoMeeting[]> {
  const html = await fetchPage(BASE_URL);
  if (!html) return [];
  return parseListPage(html, year);
}
