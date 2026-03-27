/**
 * 砥部町議会（愛媛県）-- list フェーズ
 *
 * 2 段階クロール:
 *  1. 年度一覧トップ (index.html) から年度別ページ URL を収集
 *  2. 各年度別ページ ({ID}.html) から PDF リンクを直接収集
 *
 * 年度別ページには詳細ページはなく、PDF リンクが直接掲載される。
 * fetchDetail は MeetingData | null を1件返すため、
 * list フェーズでは PDF リンク単位に1レコードを返す。
 */

import {
  BASE_ORIGIN,
  detectMeetingType,
  parseWarekiYear,
  fetchPage,
  delay,
} from "./shared";

export interface TobeSessionInfo {
  /** 会議タイトル（例: "第4回定例会（12月5日から12月13日まで）"） */
  title: string;
  /** 開催年度から算出した開催日 YYYY-MM-DD */
  heldOn: string | null;
  /** PDF の絶対 URL */
  pdfUrl: string;
  /** 会議種別 */
  meetingType: string;
  /** 年度ページの ID（externalId 生成用） */
  yearPageId: string;
}

const INTER_PAGE_DELAY_MS = 1500;

const TOP_URL = `${BASE_ORIGIN}/soshikikarasagasu/gikaijimukyoku/teireikai/index.html`;

/**
 * 指定年の全 PDF セッション情報を収集する。
 */
export async function fetchSessionList(
  _baseUrl: string,
  year: number
): Promise<TobeSessionInfo[]> {
  const allSessions: TobeSessionInfo[] = [];

  // Step 1: 年度一覧トップから年度別ページリンクを収集
  const topHtml = await fetchPage(TOP_URL);
  if (!topHtml) return [];

  const yearPageLinks = parseYearPageLinks(topHtml);

  // Step 2: 各年度別ページから PDF リンクを直接収集（対象年度のみ）
  for (const yearLink of yearPageLinks) {
    await delay(INTER_PAGE_DELAY_MS);

    const yearHtml = await fetchPage(yearLink.url);
    if (!yearHtml) continue;

    // 年度ページの <h1> から年度を判定
    const pageYear = extractYearFromH1(yearHtml);
    if (pageYear !== null && pageYear !== year) continue;

    const pdfLinks = parsePdfLinksWithYear(yearHtml, yearLink.id, pageYear ?? year);
    allSessions.push(...pdfLinks);
  }

  return allSessions;
}

// --- HTML パーサー（テスト用に export） ---

export interface YearPageLink {
  url: string;
  id: string;
}

/**
 * 年度一覧トップページ HTML から年度別ページリンクを抽出する。
 * パターン: /soshikikarasagasu/gikaijimukyoku/teireikai/{ID}.html
 * index.html は除外する。
 */
export function parseYearPageLinks(html: string): YearPageLink[] {
  const links: YearPageLink[] = [];
  const seen = new Set<string>();

  const pattern =
    /href="(?:https?:\/\/www\.town\.tobe\.ehime\.jp)?(\/soshikikarasagasu\/gikaijimukyoku\/teireikai\/(\d+)\.html)"/gi;
  let m: RegExpExecArray | null;
  while ((m = pattern.exec(html)) !== null) {
    const path = m[1]!;
    const id = m[2]!;
    if (seen.has(id)) continue;
    seen.add(id);
    links.push({ url: `${BASE_ORIGIN}${path}`, id });
  }

  return links;
}

/**
 * 年度別ページの <h1> からページ年度（西暦）を抽出する。
 * 例: "令和6年定例会・臨時会" → 2024
 */
export function extractYearFromH1(html: string): number | null {
  const h1Match = html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i);
  if (!h1Match) return null;
  const h1Text = h1Match[1]!.replace(/<[^>]+>/g, "").trim();
  return parseWarekiYear(h1Text);
}

export interface ParsedH2Info {
  session: number;
  type: string;
  month: number;
  startDay: number | null;
}

/**
 * h2 テキストをパースして会議情報を抽出する。
 *
 * パターン例:
 *   "第4回定例会（12月5日から12月13日まで）"
 *   "第3回臨時会（6月27日）"
 */
export function parseH2Text(h2Text: string): ParsedH2Info | null {
  const pattern = /第(\d+)回(定例会|臨時会)[（(](.+?)[）)]/;
  const m = h2Text.match(pattern);
  if (!m) return null;

  const session = parseInt(m[1]!, 10);
  const type = m[2]!;
  const period = m[3]!;

  // 開始月・日を抽出: "12月5日から12月13日まで" → month=12, startDay=5
  //                  "6月27日" → month=6, startDay=27
  const monthMatch = period.match(/(\d{1,2})月(\d{1,2})日/);
  if (!monthMatch) return null;

  const month = parseInt(monthMatch[1]!, 10);
  const startDay = parseInt(monthMatch[2]!, 10);

  return { session, type, month, startDay };
}

/**
 * 年度別ページ HTML から年度と PDF リンクを組み合わせて TobeSessionInfo[] を生成する。
 * 会議結果 PDF は除外し、会議録のみ取得する。
 */
export function parsePdfLinksWithYear(
  html: string,
  yearPageId: string,
  year: number
): TobeSessionInfo[] {
  const sessions: TobeSessionInfo[] = [];
  const seen = new Set<string>();

  const h2Pattern = /<h2[^>]*>([\s\S]*?)<\/h2>/gi;
  const pdfPattern =
    /<p\s+class="file-link-item">\s*<a[^>]+href="(\/\/[^"]+\.pdf)"[^>]*>([^<]+)<\/a>\s*<\/p>/gi;

  interface H2Block {
    start: number;
    end: number;
    text: string;
  }

  const h2Blocks: H2Block[] = [];
  let h2Match: RegExpExecArray | null;
  while ((h2Match = h2Pattern.exec(html)) !== null) {
    const raw = h2Match[1]!.replace(/<[^>]+>/g, "").trim();
    h2Blocks.push({
      start: h2Match.index,
      end: h2Match.index + h2Match[0].length,
      text: raw,
    });
  }

  for (let i = 0; i < h2Blocks.length; i++) {
    const block = h2Blocks[i]!;
    const nextStart = h2Blocks[i + 1]?.start ?? html.length;
    const segment = html.slice(block.end, nextStart);

    const h2Text = block.text;
    const parsed = parseH2Text(h2Text);
    if (!parsed) continue;

    pdfPattern.lastIndex = 0;
    let pdfMatch: RegExpExecArray | null;
    while ((pdfMatch = pdfPattern.exec(segment)) !== null) {
      const rawHref = pdfMatch[1]!;
      const linkText = pdfMatch[2]!.replace(/\s+/g, " ").trim();

      // 会議結果は除外し、会議録のみ取得
      if (linkText.includes("会議結果")) continue;

      // プロトコル相対 URL を絶対 URL に変換
      const pdfUrl = rawHref.startsWith("//")
        ? `https:${rawHref}`
        : rawHref;

      if (seen.has(pdfUrl)) continue;
      seen.add(pdfUrl);

      const heldOn =
        year > 0
          ? `${year}-${String(parsed.month).padStart(2, "0")}-${String(parsed.startDay ?? 1).padStart(2, "0")}`
          : null;

      sessions.push({
        title: h2Text,
        heldOn,
        pdfUrl,
        meetingType: detectMeetingType(h2Text),
        yearPageId,
      });
    }
  }

  return sessions;
}
