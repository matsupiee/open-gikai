/**
 * 新温泉町議会 -- list フェーズ
 *
 * 1. トップページから年度別ページ ID を収集（既知 ID テーブルと合わせて使用）
 * 2. 対象年度のページから PDF リンクを収集
 *
 * 各 PDF リンクが1レコードとなり、fetchDetail に渡される。
 */

import {
  BASE_ORIGIN,
  TOP_URL,
  KNOWN_YEAR_PAGE_IDS,
  fetchPage,
  parseWarekiDate,
  detectMeetingType,
  delay,
} from "./shared";

export interface ShinonsenSessionInfo {
  /** 会議タイトル（例: "第135回定例会 1日目"） */
  title: string;
  /** 開催日 YYYY-MM-DD */
  heldOn: string;
  /** PDF の絶対 URL */
  pdfUrl: string;
  /** 会議種別 */
  meetingType: string;
  /** 会議名（accordion 見出しから取得） */
  sessionName: string;
}

const INTER_PAGE_DELAY_MS = 1500;

/**
 * 指定年度の全 PDF セッション日を収集する。
 */
export async function fetchSessionList(
  _baseUrl: string,
  year: number,
): Promise<ShinonsenSessionInfo[]> {
  // Step 1: 既知 ID テーブル + トップページから年度別ページ ID を収集
  const yearPageIds = await collectYearPageIds(year);

  const allSessions: ShinonsenSessionInfo[] = [];

  // Step 2: 各年度ページから PDF リンクを収集
  for (const pageId of yearPageIds) {
    const pageUrl = `${BASE_ORIGIN}/page/?mode=detail&page_id=${pageId}`;
    await delay(INTER_PAGE_DELAY_MS);

    const html = await fetchPage(pageUrl);
    if (!html) continue;

    const sessions = extractPdfRecords(html, pageUrl);
    allSessions.push(...sessions);
  }

  return allSessions;
}

/**
 * 指定年度のページ ID を収集する。
 * 既知テーブルにあるものはそのまま使い、トップページから新規 ID を検出する。
 */
async function collectYearPageIds(year: number): Promise<string[]> {
  // 既知テーブルから対象年度の ID を取得
  const knownIds = Object.entries(KNOWN_YEAR_PAGE_IDS)
    .filter(([, y]) => y === year)
    .map(([id]) => id);

  // トップページから追加の ID を検出
  const topHtml = await fetchPage(TOP_URL);
  if (topHtml) {
    const topIds = parseTopPageIds(topHtml);
    for (const { pageId, yearText } of topIds) {
      if (KNOWN_YEAR_PAGE_IDS[pageId] !== undefined) continue;

      // 年度テキストから西暦を推定
      const match = yearText.match(/(令和|平成)(元|\d+)年/);
      if (!match) continue;

      const era = match[1]!;
      const eraYearStr = match[2]!;
      const eraYear = eraYearStr === "元" ? 1 : parseInt(eraYearStr, 10);
      const calendarYear = era === "令和" ? 2018 + eraYear : 1988 + eraYear;

      if (calendarYear === year && !knownIds.includes(pageId)) {
        knownIds.push(pageId);
      }
    }
  }

  return knownIds;
}

/**
 * トップページ HTML から年度別ページ ID とリンクテキストを抽出する。
 */
export function parseTopPageIds(
  html: string,
): { pageId: string; yearText: string }[] {
  const results: { pageId: string; yearText: string }[] = [];
  const seen = new Set<string>();

  const pattern =
    /href="[^"]*mode=detail&amp;page_id=([a-f0-9]{32})"[^>]*>([^<]+)</gi;
  let m: RegExpExecArray | null;

  while ((m = pattern.exec(html)) !== null) {
    const pageId = m[1]!;
    const yearText = m[2]!.replace(/\s+/g, " ").trim();

    if (seen.has(pageId)) continue;
    seen.add(pageId);

    results.push({ pageId, yearText });
  }

  return results;
}

/**
 * 年度別ページ HTML から PDF リンクを抽出し、セッション情報を返す。
 *
 * ページ構造（jQuery accordion）:
 *   h3 または div.accordion-title: "第135回定例会"
 *     ul > li > a[href="/uppdf/{タイムスタンプ}.pdf"] "令和7年3月10日 第135回定例会 1日目 (450KB)"
 */
export function extractPdfRecords(
  html: string,
  _pageUrl: string,
): ShinonsenSessionInfo[] {
  const records: ShinonsenSessionInfo[] = [];

  // トークン（見出し or PDF リンク）を位置順に収集
  type Token =
    | { type: "heading"; text: string; pos: number }
    | { type: "link"; href: string; text: string; pos: number };

  const tokens: Token[] = [];

  // h3 見出しを抽出
  const headingPattern = /<h3[^>]*>([\s\S]*?)<\/h3>/gi;
  let hm: RegExpExecArray | null;
  while ((hm = headingPattern.exec(html)) !== null) {
    const text = hm[1]!
      .replace(/<[^>]+>/g, "")
      .replace(/\s+/g, " ")
      .trim();
    if (text) {
      tokens.push({ type: "heading", text, pos: hm.index });
    }
  }

  // accordion-title クラスの div も見出しとして扱う
  const accordionPattern =
    /<div[^>]*class="[^"]*accordion[^"]*"[^>]*>([\s\S]*?)<\/div>/gi;
  let am: RegExpExecArray | null;
  while ((am = accordionPattern.exec(html)) !== null) {
    const text = am[1]!
      .replace(/<[^>]+>/g, "")
      .replace(/\s+/g, " ")
      .trim();
    if (text && /第\d+回/.test(text)) {
      tokens.push({ type: "heading", text, pos: am.index });
    }
  }

  // /uppdf/*.pdf へのリンクを抽出
  const linkPattern =
    /href="((?:https?:\/\/www\.town\.shinonsen\.hyogo\.jp)?\/uppdf\/[^"]+\.pdf)"[^>]*>([^<]+)<\/a>/gi;
  let lm: RegExpExecArray | null;
  while ((lm = linkPattern.exec(html)) !== null) {
    const href = lm[1]!;
    const text = lm[2]!.replace(/\s+/g, " ").trim();
    tokens.push({ type: "link", href, text, pos: lm.index });
  }

  // 位置順にソート
  tokens.sort((a, b) => a.pos - b.pos);

  let currentSessionName = "";
  let currentMeetingType = "plenary";

  for (const token of tokens) {
    if (token.type === "heading") {
      currentSessionName = token.text;
      currentMeetingType = detectMeetingType(token.text);
      continue;
    }

    const { href, text } = token;

    // 絶対 URL に変換
    const absoluteUrl = href.startsWith("/")
      ? `${BASE_ORIGIN}${href}`
      : href;

    // リンクテキストから開催日を抽出
    // 例: "令和7年3月10日 第135回定例会 1日目 (450KB)"
    const heldOn = parseWarekiDate(text);
    if (!heldOn) continue;

    // リンクテキストから会議名を推定（括弧内のサイズ表記を除去）
    const cleanText = text
      .replace(/\s*\(\d+KB\)\s*$/i, "")
      .replace(/\s*\(\d+\.\d+KB\)\s*$/i, "")
      .trim();

    const title = currentSessionName
      ? `${currentSessionName} ${cleanText}`
      : cleanText;

    // セッション名が不明な場合はリンクテキストから抽出
    const sessionName =
      currentSessionName ||
      cleanText.replace(/(令和|平成)(元|\d+)年\d+月\d+日\s*/, "").trim();

    records.push({
      title,
      heldOn,
      pdfUrl: absoluteUrl,
      meetingType: currentMeetingType,
      sessionName,
    });
  }

  return records;
}
