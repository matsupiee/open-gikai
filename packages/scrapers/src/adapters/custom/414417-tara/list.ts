/**
 * 太良町議会 — list フェーズ
 *
 * 1. トップページ（/chosei/_1010/_1414.html）から年度別ページへのリンクを収集
 * 2. 決算審査特別委員会ページ（/chosei/_1010/_1414/_1454.html）を別途収集
 * 3. 各年度ページから /var/rev0/ 配下の PDF リンクを抽出
 *
 * ページ構造:
 *   <h3>12月定例会</h3>
 *   <ul>
 *     <li><a href="/var/rev0/...">日程表</a></li>
 *     <li><a href="/var/rev0/...">目次</a></li>
 *     <li><a href="/var/rev0/...">1日目</a></li>
 *     <li><a href="/var/rev0/...">2日目</a></li>
 *   </ul>
 *
 * 日程表・目次は除外し、N日目のみを収集する。
 * 日付は会議名の月（例: 12月定例会 → 12月）と日付の代わりに日番号（1日目→1日）を使う。
 */

import {
  BASE_ORIGIN,
  TOP_PAGE_PATH,
  KESSANKAISHU_PAGE_PATH,
  detectMeetingType,
  fetchPage,
  parseJapaneseYear,
  buildHeldOn,
} from "./shared";

export interface TaraPdfRecord {
  /** 会議タイトル（例: "令和6年12月定例会 1日目"） */
  title: string;
  /** 開催日 YYYY-MM-DD（月は会議名から、日はN日目のN） */
  heldOn: string;
  /** PDF の絶対 URL */
  pdfUrl: string;
  /** 会議種別 */
  meetingType: "plenary" | "extraordinary" | "committee";
  /** 年度ページの絶対 URL */
  yearPageUrl: string;
}

export interface YearPageLink {
  /** 西暦年 */
  year: number;
  /** 絶対 URL */
  url: string;
}

/**
 * トップページの HTML から年度別ページへのリンクを抽出する。
 * `/chosei/_1010/_1414/_XXXX.html` 形式のリンクを対象とする。
 */
export function parseTopPageLinks(html: string): YearPageLink[] {
  const links: YearPageLink[] = [];
  const seen = new Set<string>();

  // /chosei/_1010/_1414/_XXXX.html 形式のリンクを抽出
  const pattern = /<a\s[^>]*href=["']([^"']*\/chosei\/_1010\/_1414\/_\d+\.html)["'][^>]*>([\s\S]*?)<\/a>/gi;

  for (const m of html.matchAll(pattern)) {
    const href = m[1]!;
    const linkText = m[2]!
      .replace(/<[^>]+>/g, "")
      .replace(/&nbsp;/g, " ")
      .replace(/&amp;/g, "&")
      .trim();

    const url = href.startsWith("http") ? href : `${BASE_ORIGIN}${href}`;
    if (seen.has(url)) continue;

    const year = parseJapaneseYear(linkText);
    if (year === null) continue;

    seen.add(url);
    links.push({ year, url });
  }

  return links;
}

/**
 * 会議名（例: "12月定例会"）から月を抽出する。
 * 解析できない場合は null を返す。
 */
export function parseSessionMonth(sessionName: string): number | null {
  // 全角数字を半角に正規化
  const normalized = sessionName.replace(/[０-９]/g, (c) =>
    String.fromCharCode(c.charCodeAt(0) - 0xff10 + 0x30)
  );

  const match = normalized.match(/(\d{1,2})月/);
  if (match) {
    const month = parseInt(match[1]!, 10);
    if (month >= 1 && month <= 12) return month;
  }
  return null;
}

/**
 * リンクテキスト（例: "1日目", "2日目"）から日番号を抽出する。
 * 解析できない場合は null を返す。
 */
export function parseDayNumber(text: string): number | null {
  // 全角数字を半角に正規化
  const normalized = text.replace(/[０-９]/g, (c) =>
    String.fromCharCode(c.charCodeAt(0) - 0xff10 + 0x30)
  );

  const match = normalized.match(/^(\d+)日目/);
  if (match) {
    return parseInt(match[1]!, 10);
  }
  return null;
}

/**
 * 年度別ページの HTML から PDF レコードを抽出する。
 *
 * HTML 構造:
 *   - h3 タグに会議種別（"12月定例会", "9月定例会", "5月臨時会" など）
 *   - 各 h3 の後に PDF リンクのリスト
 *   - リンクテキスト: "日程表", "目次", "1日目", "2日目", ...
 *
 * 除外対象:
 *   - 「日程表」「目次」
 *
 * heldOn: 会議名の月（例: 12月定例会 → 12月）と日番号（N日目 → N日）から生成する。
 *
 * @param html 年度別ページの HTML
 * @param yearPageUrl 年度別ページの絶対 URL
 * @param pageYear 西暦年
 */
export function parseYearPagePdfs(
  html: string,
  yearPageUrl: string,
  pageYear: number
): TaraPdfRecord[] {
  const records: TaraPdfRecord[] = [];

  // 要素を位置順に収集して処理
  const elements: Array<{
    type: "heading" | "link";
    text: string;
    href?: string;
    pos: number;
  }> = [];

  // h2/h3 見出し要素を収集
  const headingRegex = /<h[23][^>]*>([\s\S]*?)<\/h[23]>/gi;
  for (const m of html.matchAll(headingRegex)) {
    const text = m[1]!
      .replace(/<[^>]+>/g, "")
      .replace(/&nbsp;/g, " ")
      .replace(/&amp;/g, "&")
      .trim();
    if (text) {
      elements.push({ type: "heading", text, pos: m.index! });
    }
  }

  // /var/rev0/ パスの PDF リンクを収集
  const linkRegex = /<a\s[^>]*href=["']([^"']*\/var\/rev0\/[^"']*\.pdf)["'][^>]*>([\s\S]*?)<\/a>/gi;
  for (const m of html.matchAll(linkRegex)) {
    const href = m[1]!;
    const text = m[2]!
      .replace(/<[^>]+>/g, "")
      .replace(/&nbsp;/g, " ")
      .replace(/&amp;/g, "&")
      .trim();
    elements.push({ type: "link", text, href, pos: m.index! });
  }

  elements.sort((a, b) => a.pos - b.pos);

  let currentSessionName = "";
  let currentMonth: number | null = null;

  for (const el of elements) {
    if (el.type === "heading") {
      // 会議種別を含む見出しを現在のセッション名として記録
      if (
        el.text.includes("定例会") ||
        el.text.includes("臨時会") ||
        el.text.includes("委員会") ||
        el.text.includes("審査")
      ) {
        currentSessionName = el.text;
        currentMonth = parseSessionMonth(el.text);
      }
      continue;
    }

    // PDF リンクの処理
    const linkText = el.text;
    const href = el.href!;
    const pdfUrl = href.startsWith("http") ? href : `${BASE_ORIGIN}${href}`;

    // 「日程表」「目次」は除外
    if (linkText.includes("日程表") || linkText.includes("目次")) {
      continue;
    }

    // N日目のみ対象
    const dayNumber = parseDayNumber(linkText);
    if (dayNumber === null) continue;

    // heldOn を生成: 月は会議名から、日はN日目のN
    const month = currentMonth;
    if (month === null) continue;

    const heldOn = buildHeldOn(pageYear, month, dayNumber);

    // タイトルを構成
    const sessionLabel = currentSessionName
      ? `${pageYear >= 2019 ? `令和${pageYear - 2018}年` : `平成${pageYear - 1988}年`}${currentSessionName}`
      : `${pageYear}年`;
    const fullTitle = `${sessionLabel} ${linkText}`;

    records.push({
      title: fullTitle,
      heldOn,
      pdfUrl,
      meetingType: detectMeetingType(currentSessionName || linkText),
      yearPageUrl,
    });
  }

  return records;
}

/**
 * 対象年の全 PDF レコードを収集する。
 *
 * 戦略:
 * 1. トップページから全年度 URL を収集
 * 2. 対象年度のページから PDF レコードを抽出
 * 3. 決算審査特別委員会ページから該当年度の PDF を抽出
 */
export async function fetchPdfList(
  _baseUrl: string,
  year: number
): Promise<TaraPdfRecord[]> {
  // Step 1: トップページから年度別ページ URL を取得
  const topUrl = `${BASE_ORIGIN}${TOP_PAGE_PATH}`;
  const topHtml = await fetchPage(topUrl);

  const yearLinks: YearPageLink[] = topHtml ? parseTopPageLinks(topHtml) : [];

  const allRecords: TaraPdfRecord[] = [];

  // Step 2: 対象年度ページから PDF レコードを抽出
  const targetLink = yearLinks.find((l) => l.year === year);
  if (targetLink) {
    const yearHtml = await fetchPage(targetLink.url);
    if (yearHtml) {
      const records = parseYearPagePdfs(yearHtml, targetLink.url, year);
      allRecords.push(...records);
    }
  }

  // Step 3: 決算審査特別委員会ページから該当年度の PDF を抽出
  // 決算審査特別委員会は通常 9月頃に開催されるため、その年度の9月を対象にフィルタリング
  const kessanUrl = `${BASE_ORIGIN}${KESSANKAISHU_PAGE_PATH}`;
  const kessanHtml = await fetchPage(kessanUrl);
  if (kessanHtml) {
    const kessanRecords = parseKessanPage(kessanHtml, kessanUrl, year);
    allRecords.push(...kessanRecords);
  }

  return allRecords;
}

/**
 * 決算審査特別委員会ページから指定年度の PDF レコードを抽出する。
 *
 * 決算審査特別委員会ページには複数年度の会議録が含まれるため、
 * 見出しテキストから年度を判断して対象年のみを収集する。
 */
export function parseKessanPage(
  html: string,
  pageUrl: string,
  targetYear: number
): TaraPdfRecord[] {
  const records: TaraPdfRecord[] = [];

  // 要素を位置順に収集して処理
  const elements: Array<{
    type: "heading" | "link";
    text: string;
    href?: string;
    pos: number;
  }> = [];

  // h2/h3/h4 見出し要素を収集
  const headingRegex = /<h[234][^>]*>([\s\S]*?)<\/h[234]>/gi;
  for (const m of html.matchAll(headingRegex)) {
    const text = m[1]!
      .replace(/<[^>]+>/g, "")
      .replace(/&nbsp;/g, " ")
      .replace(/&amp;/g, "&")
      .trim();
    if (text) {
      elements.push({ type: "heading", text, pos: m.index! });
    }
  }

  // /var/rev0/ パスの PDF リンクを収集
  const linkRegex = /<a\s[^>]*href=["']([^"']*\/var\/rev0\/[^"']*\.pdf)["'][^>]*>([\s\S]*?)<\/a>/gi;
  for (const m of html.matchAll(linkRegex)) {
    const href = m[1]!;
    const text = m[2]!
      .replace(/<[^>]+>/g, "")
      .replace(/&nbsp;/g, " ")
      .replace(/&amp;/g, "&")
      .trim();
    elements.push({ type: "link", text, href, pos: m.index! });
  }

  elements.sort((a, b) => a.pos - b.pos);

  let currentYear: number | null = null;
  let currentSessionName = "";

  for (const el of elements) {
    if (el.type === "heading") {
      // 見出しから年度を抽出
      const year = parseJapaneseYear(el.text);
      if (year !== null) {
        currentYear = year;
      }
      if (
        el.text.includes("委員会") ||
        el.text.includes("審査")
      ) {
        currentSessionName = el.text;
      }
      continue;
    }

    // 対象年度のみ処理
    if (currentYear !== targetYear) continue;

    const linkText = el.text;
    const href = el.href!;
    const pdfUrl = href.startsWith("http") ? href : `${BASE_ORIGIN}${href}`;

    // 「日程表」「目次」は除外
    if (linkText.includes("日程表") || linkText.includes("目次")) {
      continue;
    }

    // N日目のみ対象
    const dayNumber = parseDayNumber(linkText);
    if (dayNumber === null) continue;

    // 決算審査特別委員会は通常9月開催
    const heldOn = buildHeldOn(targetYear, 9, dayNumber);

    const sessionLabel = currentSessionName || "決算審査特別委員会";
    const yearLabel = targetYear >= 2019
      ? `令和${targetYear - 2018}年度`
      : `平成${targetYear - 1988}年度`;
    // セッション名に既に年度ラベルが含まれている場合は付加しない
    const fullTitle = sessionLabel.includes(yearLabel)
      ? `${sessionLabel} ${linkText}`
      : `${yearLabel}${sessionLabel} ${linkText}`;

    records.push({
      title: fullTitle,
      heldOn,
      pdfUrl,
      meetingType: "committee",
      yearPageUrl: pageUrl,
    });
  }

  return records;
}
