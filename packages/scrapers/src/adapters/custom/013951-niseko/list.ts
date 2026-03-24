/**
 * ニセコ町議会 会議録 — list フェーズ
 *
 * 年度別一覧ページ https://www.town.niseko.lg.jp/chosei/gikai/kaigi/{年号}/ から
 * PDF リンクとメタ情報を収集する。
 *
 * HTML 構造:
 *   <h3>令和6年(2024年)第4回ニセコ町議会定例会</h3>
 *   <ul>
 *     <li>
 *       <a href="/resources/output/contents/file/release/10778/{ID}/20241219.pdf">
 *         12月19日
 *       </a>
 *     </li>
 *   </ul>
 *
 * 発言者パターン:
 *   "○議長（青羽雄士君）"
 *   "○町長（片山健也君）"
 *   "○3番（高木直良君）"
 */

import { BASE_ORIGIN, LIST_PAGE_URL, eraToWesternYear, fetchPage, yearToEraPath } from "./shared";

export interface NisekoMeeting {
  /** PDF の完全 URL */
  pdfUrl: string;
  /** 会議タイトル */
  title: string;
  /** 開催日 YYYY-MM-DD または null（解析不能の場合） */
  heldOn: string | null;
}

/**
 * リンクテキスト（日付）と h3 見出し（会議タイトル）から開催日を解析する。
 *
 * パターン例:
 *   タイトル: "令和6年(2024年)第4回ニセコ町議会定例会", テキスト: "12月19日"
 *     → heldOn=2024-12-19
 */
export function parseMeetingDate(
  meetingTitle: string,
  linkText: string,
): string | null {
  // タイトルから西暦年を取得（"(2024年)" のような括弧内西暦 or 和暦から推定）
  const westernYearMatch = meetingTitle.match(/\((\d{4})年\)/);
  let year: number | null = null;
  if (westernYearMatch) {
    year = parseInt(westernYearMatch[1]!, 10);
  } else {
    year = eraToWesternYear(meetingTitle);
  }

  if (!year) return null;

  // リンクテキストから月日を抽出: "12月19日" のようなパターン
  const dateMatch = linkText.match(/(\d{1,2})月(\d{1,2})日/);
  if (!dateMatch) return null;

  const month = parseInt(dateMatch[1]!, 10);
  const day = parseInt(dateMatch[2]!, 10);

  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

/**
 * 年度別ページ HTML から PDF リンクを抽出する。
 *
 * h3 見出しを会議タイトルとして記録し、
 * 続くリンク（PDF href）とリンクテキスト（日付）を関連付ける。
 */
export function parseYearlyPage(html: string): NisekoMeeting[] {
  const results: NisekoMeeting[] = [];

  // h3 見出しと PDF リンクを正規表現で解析
  // h3 の後に続く PDF リンクを会議に関連付ける
  const h3Pattern = /<h3[^>]*>([\s\S]*?)<\/h3>/gi;
  const linkPattern =
    /<a[^>]+href="([^"]*\.pdf)"[^>]*>([\s\S]*?)<\/a>/gi;

  // h3 の位置と内容を取得
  const headings: Array<{ index: number; title: string }> = [];
  for (const match of html.matchAll(h3Pattern)) {
    const title = match[1]!
      .replace(/<[^>]+>/g, "")
      .replace(/&nbsp;/g, " ")
      .replace(/&amp;/g, "&")
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">")
      .replace(/&quot;/g, '"')
      .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(Number(code)))
      .trim();
    if (title) {
      headings.push({ index: match.index!, title });
    }
  }

  // PDF リンクの位置と内容を取得
  const links: Array<{ index: number; href: string; text: string }> = [];
  for (const match of html.matchAll(linkPattern)) {
    const href = match[1]!;
    const text = match[2]!
      .replace(/<[^>]+>/g, "")
      .replace(/&nbsp;/g, " ")
      .replace(/&amp;/g, "&")
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">")
      .replace(/&quot;/g, '"')
      .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(Number(code)))
      .trim();
    links.push({ index: match.index!, href, text });
  }

  if (headings.length === 0 || links.length === 0) return results;

  // 各 PDF リンクを最も近い（直前の）h3 見出しに関連付ける
  for (const link of links) {
    // link より前の最後の heading を見つける
    let currentTitle = "";
    for (const heading of headings) {
      if (heading.index <= link.index) {
        currentTitle = heading.title;
      }
    }

    if (!currentTitle) continue;

    const heldOn = parseMeetingDate(currentTitle, link.text);

    // PDF の完全 URL を組み立て
    let pdfUrl: string;
    if (link.href.startsWith("http")) {
      pdfUrl = link.href;
    } else {
      pdfUrl = `${BASE_ORIGIN}${link.href}`;
    }

    results.push({ pdfUrl, title: currentTitle, heldOn });
  }

  return results;
}

/**
 * 指定年の全 PDF リンクを取得する。
 */
export async function fetchMeetingList(year: number): Promise<NisekoMeeting[]> {
  const eraPath = yearToEraPath(year);
  if (!eraPath) return [];

  const yearPageUrl = `${LIST_PAGE_URL}/${eraPath}/`;
  const html = await fetchPage(yearPageUrl);
  if (!html) return [];

  const allMeetings = parseYearlyPage(html);

  // 対象年でフィルタ（heldOn が null のものは除外）
  return allMeetings.filter((m) => {
    if (!m.heldOn) return false;
    const meetingYear = parseInt(m.heldOn.slice(0, 4), 10);
    return meetingYear === year;
  });
}
