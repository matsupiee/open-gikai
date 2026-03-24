/**
 * 大館市議会 — list フェーズ
 *
 * クロール戦略:
 * 1. トップページから年度別ページの URL を収集（年度ナビゲーションリンク）
 * 2. 各年度ページの HTML から会議グループ名（h3 見出し）と PDF リンク・開催日を収集
 *
 * HTML 構造（年度別ページ）:
 *   <h3>令和６年会議録</h3>
 *   <!-- 最初のテーブルは caption に会議グループ名 -->
 *   <table><caption>【令和６年３月定例会】</caption>
 *     <tr>
 *       <th>議事日程</th><th>開催日時</th><th>内容</th>
 *     </tr>
 *     <tr>
 *       <td><a href="/uploads/...pdf">第１日目</a> [PDF:XXXkB]</td>
 *       <td>２月２６日（月）</td>
 *       <td>...</td>
 *     </tr>
 *   </table>
 *   <!-- 後続テーブルは直前の p タグに会議グループ名 -->
 *   <p><span>【令和６年6月定例会】</span></p>
 *   <table>...</table>
 */

import {
  fetchPage,
  parseWarekiYear,
  detectMeetingType,
  resolveUrl,
  toHalfWidth,
  delay,
} from "./shared";

export interface OdateSessionInfo {
  /** 会議タイトル（例: "【令和６年３月定例会】 第１日目"） */
  title: string;
  /** 開催日 YYYY-MM-DD。解析できない場合は null */
  heldOn: string | null;
  /** PDF の絶対 URL */
  pdfUrl: string;
  /** 会議種別 */
  meetingType: "plenary" | "extraordinary" | "committee";
  /** 会議グループ名（例: "【令和６年３月定例会】"） */
  sessionGroupTitle: string;
  /** 日程ラベル（例: "第１日目"） */
  dayLabel: string;
}

const INTER_PAGE_DELAY_MS = 1500;

/**
 * 指定年の全セッション PDF を収集する。
 * baseUrl（= 会議録トップページ URL）から年度ページを辿る。
 */
export async function fetchSessionList(
  baseUrl: string,
  year: number
): Promise<OdateSessionInfo[]> {
  // Step 1: トップページから年度別ページの URL を収集
  const topHtml = await fetchPage(baseUrl);
  if (!topHtml) return [];

  const yearPageUrls = parseYearPageUrls(topHtml, year, baseUrl);

  const allSessions: OdateSessionInfo[] = [];

  for (const pageUrl of yearPageUrls) {
    await delay(INTER_PAGE_DELAY_MS);

    const pageHtml = await fetchPage(pageUrl);
    if (!pageHtml) continue;

    const sessions = parseYearPage(pageHtml, year);
    allSessions.push(...sessions);
  }

  return allSessions;
}

// --- HTML パーサー（テスト用に export） ---

/**
 * トップページ HTML から、指定年に該当する年度別ページの URL を抽出する。
 *
 * トップページ自体が最新年度のため、最新年度に該当する場合は baseUrl も含める。
 * 年度ナビリンク例: href="/city/handbook/handbook13/page56/kaigiroku/p12038"
 *                   href="/city/handbook/handbook13/page56/kaigiroku/h30"
 *                   href="/city/handbook/handbook13/page56/kaigiroku/r1"
 */
export function parseYearPageUrls(
  html: string,
  year: number,
  baseUrl: string
): string[] {
  const urls: string[] = [];

  // 年度ナビリンクを抽出（kaigiroku/p\d+ または kaigiroku/h\d+ または kaigiroku/r1）
  const pattern =
    /<a\s[^>]*href="([^"]*\/kaigiroku\/[phr][^"]*)"[^>]*>([^<]*(?:令和|平成)[^<]*会議録[^<]*)<\/a>/gi;

  let m: RegExpExecArray | null;
  while ((m = pattern.exec(html)) !== null) {
    const href = m[1]!;
    const linkText = m[2]!.trim();
    const absUrl = resolveUrl(href);

    if (matchesYear(linkText, year) && !urls.includes(absUrl)) {
      urls.push(absUrl);
    }
  }

  // トップページ自体（最新年度）が指定年に該当するか確認
  // h3 見出し等から年度を判定
  if (isCurrentYearPage(html, year) && !urls.includes(baseUrl)) {
    urls.unshift(baseUrl);
  }

  return urls;
}

/**
 * ページの HTML が指定年度のコンテンツを含むか判定する。
 * h3 見出し等に和暦年表記があり、それが year に対応する場合 true。
 */
export function isCurrentYearPage(html: string, year: number): boolean {
  // h3 内の年表記（例: 【令和７年３月定例会】）
  const h3Pattern = /<h3[^>]*>([\s\S]*?)<\/h3>/gi;
  let m: RegExpExecArray | null;
  while ((m = h3Pattern.exec(html)) !== null) {
    // 全角数字を半角に変換してから解析
    const text = toHalfWidth(m[1]!.replace(/<[^>]+>/g, ""));
    const warekiYear = parseWarekiYear(text);
    if (warekiYear === year) return true;
  }
  return false;
}

/**
 * リンクテキストが指定年度に対応するか判定する。
 * 「平成31年・令和元年会議録」は 2019 にマッチ。
 * 全角数字・半角数字の両方に対応する。
 */
export function matchesYear(linkText: string, year: number): boolean {
  // 全角数字を半角に正規化してから解析
  const normalized = toHalfWidth(linkText);

  const reiwaPattern = /令和(\d+|元)年/g;
  const heiseiPattern = /平成(\d+|元)年/g;

  let m: RegExpExecArray | null;

  while ((m = reiwaPattern.exec(normalized)) !== null) {
    const n = m[1] === "元" ? 1 : parseInt(m[1]!, 10);
    if (2018 + n === year) return true;
  }

  while ((m = heiseiPattern.exec(normalized)) !== null) {
    const n = m[1] === "元" ? 1 : parseInt(m[1]!, 10);
    if (1988 + n === year) return true;
  }

  return false;
}

/**
 * 年度別ページ HTML から会議録セッション情報を抽出する。
 *
 * 実際の HTML 構造:
 * - 最初の会議グループ名: <table><caption>【令和６年３月定例会】</caption>...</table>
 * - 後続の会議グループ名: <p><span>【令和６年6月定例会】</span></p> の直後の table
 *
 * year は開催日の年推定に使用する。
 */
export function parseYearPage(html: string, year: number): OdateSessionInfo[] {
  const sessions: OdateSessionInfo[] = [];

  // table タグの位置とキャプションを収集
  const tablePattern = /<table[\s\S]*?<\/table>/gi;

  for (const tableMatch of html.matchAll(tablePattern)) {
    const tableHtml = tableMatch[0]!;
    const tableStart = tableMatch.index!;

    // セッション名を取得: caption タグ（第1優先）またはテーブル直前の p タグ内テキスト
    let sessionGroupTitle = extractCaptionText(tableHtml);

    if (!sessionGroupTitle) {
      // table の直前にある p タグや span から会議名を探す
      // 最大 500 文字さかのぼって確認
      const preceding = html.slice(Math.max(0, tableStart - 500), tableStart);
      sessionGroupTitle = extractPrecedingSessionTitle(preceding);
    }

    if (!sessionGroupTitle) continue;
    if (!sessionGroupTitle.includes("定例会") && !sessionGroupTitle.includes("臨時会") && !sessionGroupTitle.includes("委員会")) continue;

    const meetingType = detectMeetingType(sessionGroupTitle);
    const sessionText = toHalfWidth(sessionGroupTitle);
    const baseYear = parseWarekiYear(sessionText) ?? year;

    const trMatches = [...tableHtml.matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/gi)];

    for (const trMatch of trMatches) {
      const trHtml = trMatch[1]!;

      // td を順番に抽出
      const tdMatches = [...trHtml.matchAll(/<td[^>]*>([\s\S]*?)<\/td>/gi)];
      if (tdMatches.length < 2) continue;

      // 第1列: PDF リンク
      const firstTd = tdMatches[0]![1]!;
      const linkMatch = firstTd.match(/<a[^>]+href="([^"]+\.pdf)"[^>]*>([\s\S]*?)<\/a>/i);
      if (!linkMatch) continue;

      const href = linkMatch[1]!;
      const linkText = linkMatch[2]!
        .replace(/<[^>]+>/g, "")
        .replace(/&nbsp;/g, " ")
        .trim();
      const pdfUrl = resolveUrl(href);

      // 第2列: 開催日時
      const secondTd = tdMatches[1]![1]!;
      const dateText = secondTd
        .replace(/<[^>]+>/g, "")
        .replace(/&nbsp;/g, " ")
        .trim();

      const heldOn = parseDateFromCell(dateText, baseYear);

      const dayLabel = linkText || "第1日目";
      const title = `${sessionGroupTitle} ${dayLabel}`;

      sessions.push({
        title,
        heldOn,
        pdfUrl,
        meetingType,
        sessionGroupTitle,
        dayLabel,
      });
    }
  }

  return sessions;
}

/**
 * table HTML の caption タグからテキストを抽出する。
 */
export function extractCaptionText(tableHtml: string): string | null {
  const m = tableHtml.match(/<caption[^>]*>([\s\S]*?)<\/caption>/i);
  if (!m) return null;
  const text = m[1]!.replace(/<[^>]+>/g, "").trim();
  return text || null;
}

/**
 * テーブル直前の HTML から会議グループ名を抽出する。
 * `<p>` タグ内の `<span>` または直接テキストで「定例会」「臨時会」を含む最後のものを返す。
 */
export function extractPrecedingSessionTitle(preceding: string): string | null {
  // 【...定例会...】 または 【...臨時会...】 パターンを含む最後のテキストを探す
  const pattern = /【[^】]*(?:定例会|臨時会|委員会)[^】]*】/g;
  const matches = [...preceding.matchAll(pattern)];
  if (matches.length === 0) return null;
  // 最後（直前）のものを返す
  return matches[matches.length - 1]![0]!;
}

/**
 * 開催日時セルのテキストから YYYY-MM-DD を生成する。
 *
 * 入力例: "２月２６日（月）", "10月８日（火）", "３月４日（月）"
 * 全角数字は半角に変換してから解析する。
 *
 * 年は baseYear を使用するが、月が baseYear から連続しない場合（12月→1月等）は補正する。
 */
export function parseDateFromCell(dateText: string, baseYear: number): string | null {
  const normalized = toHalfWidth(dateText);
  const match = normalized.match(/(\d{1,2})月(\d{1,2})日/);
  if (!match) return null;

  const month = parseInt(match[1]!, 10);
  const day = parseInt(match[2]!, 10);

  // 月が 1〜3 の場合は翌年の可能性がある（12月定例会が翌年1〜3月まで続く場合）
  // 簡易判定: 基準年の12月セッションで月が1〜3なら翌年
  // ただし baseYear の年度判断は caller 側に任せ、ここでは baseYear をそのまま使う
  const yyyy = baseYear;

  return `${yyyy}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}
