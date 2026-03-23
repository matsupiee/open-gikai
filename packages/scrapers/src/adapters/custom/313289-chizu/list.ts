/**
 * 智頭町議会 会議録 -- list フェーズ
 *
 * 1. 会議録トップページから年度別ページ URL を収集
 * 2. 各年度ページから PDF リンクとメタ情報を抽出
 * 3. 平成24〜25年はトップページから直接 PDF リンクを収集
 *
 * トップページ構造:
 *   <a href="/chizu/gikaijimukyoku/gijiroku/{スラッグ}/">令和6年度会議録</a>
 *
 * 年度ページ構造:
 *   <h3>第4回定例会</h3>
 *   <a href="...pdf">初　日（R6.12.05）</a>
 *   <a href="...pdf">２日目（R6.12.06）　一般質問</a>
 *   <a href="...pdf">最終日（R6.12.12）</a>
 */

import {
  BASE_ORIGIN,
  INDEX_PATH,
  detectMeetingType,
  extractDateFromLabel,
  fetchPage,
  toWareki,
} from "./shared";

export interface ChizuMeeting {
  /** PDF の絶対 URL */
  pdfUrl: string;
  /** 会議タイトル（例: "第4回定例会 初日"） */
  title: string;
  /** 開催日 YYYY-MM-DD */
  heldOn: string;
  /** 会議種別（plenary / extraordinary） */
  meetingType: string;
}

/**
 * トップページ HTML から年度別ページ URL を抽出する。
 * /gijiroku/ 配下のサブページリンクを抽出し、リンクテキストから年度を判定する。
 */
export function parseTopPage(html: string): { year: number; url: string }[] {
  const results: { year: number; url: string }[] = [];

  // /gijiroku/ 配下のサブページへのリンクを抽出（PDF リンクやトップページ自体を除外）
  const linkPattern =
    /<a\s[^>]*href="([^"]*\/gijiroku\/[^"]+\/)"[^>]*>([\s\S]*?)<\/a>/gi;

  for (const match of html.matchAll(linkPattern)) {
    const href = match[1]!;
    const linkText = match[2]!.replace(/<[^>]+>/g, "").trim();

    // リンクテキストから年度を抽出（令和N年/平成N年、全角・半角数字対応）
    const eraMatch = linkText.match(/(令和|平成)([\d０-９]+|元)年/);
    if (!eraMatch) continue;

    const era = eraMatch[1]!;
    const eraYearStr = eraMatch[2]!;
    const toHalf = (s: string) =>
      s.replace(/[０-９]/g, (c) =>
        String.fromCharCode(c.charCodeAt(0) - 0xfee0),
      );
    const eraYear =
      eraYearStr === "元" ? 1 : parseInt(toHalf(eraYearStr), 10);
    const year = era === "令和" ? 2018 + eraYear : 1988 + eraYear;

    const url = href.startsWith("http")
      ? href
      : `${BASE_ORIGIN}${href.startsWith("/") ? "" : "/"}${href}`;

    results.push({ year, url });
  }

  return results;
}

/**
 * 年度ページ HTML から PDF リンクを抽出する。
 *
 * h3 で会議セクションが区切られ、その配下に PDF リンクがある。
 * アンカーテキストから日付と日目情報を取得する。
 */
export function parseYearPage(html: string): ChizuMeeting[] {
  const meetings: ChizuMeeting[] = [];

  // h3 ごとにセクションを分割
  const h3Pattern = /<h3[^>]*>([\s\S]*?)<\/h3>/gi;
  const h3Matches = [...html.matchAll(h3Pattern)];

  if (h3Matches.length === 0) {
    // h3 がない場合はページ全体から PDF を収集（平成24〜25年のトップページ対応）
    return extractPdfLinksFromSection(html, null);
  }

  for (let i = 0; i < h3Matches.length; i++) {
    const h3Match = h3Matches[i]!;
    const sectionTitle = h3Match[1]!.replace(/<[^>]+>/g, "").trim();

    const startIdx = h3Match.index! + h3Match[0].length;
    const endIdx =
      i + 1 < h3Matches.length ? h3Matches[i + 1]!.index! : html.length;
    const sectionHtml = html.slice(startIdx, endIdx);

    const sectionMeetings = extractPdfLinksFromSection(
      sectionHtml,
      sectionTitle,
    );
    meetings.push(...sectionMeetings);
  }

  return meetings;
}

/**
 * HTML セクションから PDF リンクを抽出する。
 */
function extractPdfLinksFromSection(
  sectionHtml: string,
  sectionTitle: string | null,
): ChizuMeeting[] {
  const meetings: ChizuMeeting[] = [];

  const pdfPattern =
    /<a\s[^>]*href="([^"]+\.pdf)"[^>]*>([\s\S]*?)<\/a>/gi;

  for (const pdfMatch of sectionHtml.matchAll(pdfPattern)) {
    let href = pdfMatch[1]!;
    const linkText = pdfMatch[2]!.replace(/<[^>]+>/g, "").trim();

    // 絶対 URL に変換
    if (href.startsWith("//")) {
      href = `https:${href}`;
    } else if (!href.startsWith("http")) {
      href = `${BASE_ORIGIN}${href.startsWith("/") ? "" : "/"}${href}`;
    }

    // アンカーテキストから開催日を抽出
    const heldOn = extractDateFromLabel(linkText);
    if (!heldOn) continue;

    // 日目情報を抽出
    const dayLabel = extractDayLabel(linkText);

    // タイトルを構築
    const title = sectionTitle
      ? `${sectionTitle} ${dayLabel}`
      : dayLabel;

    const meetingType = sectionTitle
      ? detectMeetingType(sectionTitle)
      : "plenary";

    meetings.push({
      pdfUrl: href,
      title,
      heldOn,
      meetingType,
    });
  }

  return meetings;
}

/**
 * アンカーテキストから日目のラベルを抽出する。
 *
 * 例: "初　日（R6.12.05）" → "初日"
 * 例: "２日目（R6.12.06）　一般質問" → "2日目"
 * 例: "最終日（R6.12.12）" → "最終日"
 * 例: "１日限り（R6.06.14）" → "1日限り"
 */
export function extractDayLabel(linkText: string): string {
  // 全角スペースを半角に正規化してからマッチ
  const normalized = linkText.replace(/\s+/g, " ").trim();

  if (/初\s*日/.test(normalized)) return "初日";
  if (/最終日/.test(normalized)) return "最終日";

  const dayMatch = normalized.match(/([０-９\d]+)日目/);
  if (dayMatch) {
    const dayNum = dayMatch[1]!.replace(/[０-９]/g, (c) =>
      String.fromCharCode(c.charCodeAt(0) - 0xfee0),
    );
    return `${dayNum}日目`;
  }

  const limitMatch = normalized.match(/([０-９\d]+)日限り/);
  if (limitMatch) {
    const dayNum = limitMatch[1]!.replace(/[０-９]/g, (c) =>
      String.fromCharCode(c.charCodeAt(0) - 0xfee0),
    );
    return `${dayNum}日限り`;
  }

  // 日付部分を除去して残りをラベルとする
  return normalized.replace(/[（(][^)）]*[)）]/, "").trim() || "本会議";
}

/**
 * トップページから直接掲載されている PDF リンクを抽出する（平成24〜25年用）。
 *
 * 年度でフィルタリングし、対象年に該当する PDF のみ返す。
 */
export function parseDirectPdfLinks(
  html: string,
  targetYear: number,
): ChizuMeeting[] {
  const meetings: ChizuMeeting[] = [];

  const pdfPattern =
    /<a\s[^>]*href="([^"]+\.pdf)"[^>]*>([\s\S]*?)<\/a>/gi;

  for (const pdfMatch of html.matchAll(pdfPattern)) {
    let href = pdfMatch[1]!;
    const linkText = pdfMatch[2]!.replace(/<[^>]+>/g, "").trim();

    // 絶対 URL に変換
    if (href.startsWith("//")) {
      href = `https:${href}`;
    } else if (!href.startsWith("http")) {
      href = `${BASE_ORIGIN}${href.startsWith("/") ? "" : "/"}${href}`;
    }

    // アンカーテキストから開催日を抽出
    const heldOn = extractDateFromLabel(linkText);
    if (!heldOn) continue;

    // 年度でフィルタリング（4月〜翌3月が年度）
    const date = new Date(heldOn);
    const fiscalYear =
      date.getMonth() < 3 ? date.getFullYear() - 1 : date.getFullYear();
    if (fiscalYear !== targetYear) continue;

    const dayLabel = extractDayLabel(linkText);

    meetings.push({
      pdfUrl: href,
      title: dayLabel,
      heldOn,
      meetingType: "plenary",
    });
  }

  return meetings;
}

/**
 * 指定年の全会議録 PDF 一覧を取得する。
 */
export async function fetchMeetingList(
  year: number,
): Promise<ChizuMeeting[]> {
  const wareki = toWareki(year);
  if (!wareki) return [];

  // Step 1: トップページを取得
  const indexUrl = `${BASE_ORIGIN}${INDEX_PATH}`;
  const indexHtml = await fetchPage(indexUrl);
  if (!indexHtml) return [];

  // Step 2: 年度別ページ URL を取得
  const yearPages = parseTopPage(indexHtml);
  const targetPage = yearPages.find((p) => p.year === year);

  if (targetPage) {
    // 年度別ページから PDF リンクを取得
    const yearHtml = await fetchPage(targetPage.url);
    if (!yearHtml) return [];
    return parseYearPage(yearHtml);
  }

  // 年度別ページがない場合（平成24〜25年）、トップページから直接 PDF を収集
  return parseDirectPdfLinks(indexHtml, year);
}
