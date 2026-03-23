/**
 * 江田島市議会 — list フェーズ
 *
 * 2段階で PDF リンクを収集する:
 * 1. 一覧ページから対象年度のページ URL を取得
 * 2. 年度別ページから PDF リンクとメタ情報を抽出
 *
 * セクション見出し形式: 令和X年第Y回定例会（令和X年Z月）
 * PDF リンクテキスト形式: 第X回定例会会議録（Y日目　PDF）
 */

import { BASE_ORIGIN, fetchPage, toHalfWidth, toJapaneseEra } from "./shared";

export interface EtajimaMeeting {
  pdfUrl: string;
  title: string;
  heldOn: string;
  section: string;
}

/**
 * 一覧ページから年度別ページのリンクを抽出する。
 * 各リンクのテキスト（例: "令和7年度会議録"）とURLを返す。
 */
export function parseTopPage(
  html: string
): { label: string; url: string }[] {
  const results: { label: string; url: string }[] = [];

  // /cms/articles/show/{ID} 形式のリンクを抽出
  const linkRegex =
    /<a[^>]+href="([^"]*\/cms\/articles\/show\/\d+)"[^>]*>([\s\S]*?)<\/a>/g;

  for (const match of html.matchAll(linkRegex)) {
    const href = match[1]!;
    const label = match[2]!.replace(/<[^>]+>/g, "").trim();

    // 会議録関連のリンクのみ（年度リンクは「会議録」「年」を含む）
    if (!label.includes("会議録") && !/(令和|平成).+年/.test(label)) continue;

    const url = href.startsWith("http")
      ? href
      : `${BASE_ORIGIN}${href.startsWith("/") ? "" : "/"}${href}`;

    results.push({ label, url });
  }

  return results;
}

/**
 * セクション見出しから和暦の年月を抽出し、YYYY-MM 形式を返す。
 * 例: "令和7年第1回定例会（令和7年3月）" → "2025-03"
 * 例: "平成31年第1回定例会（平成31年3月）" → "2019-03"
 */
export function parseSectionDate(section: string): string | null {
  // 全角数字を半角に正規化してからパース
  const normalized = toHalfWidth(section);

  // セクション見出しのカッコ内の年月を取得（「元」年にも対応）
  const match = normalized.match(
    /[（(](令和|平成)\s*(元|\d+)\s*年\s*(\d+)\s*月[）)]/
  );
  if (!match) {
    // カッコなしで先頭の年から推定
    const eraMatch = normalized.match(/(令和|平成)\s*(元|\d+)\s*年/);
    if (!eraMatch) return null;
    const era = eraMatch[1]!;
    const eraYear = eraMatch[2] === "元" ? 1 : parseInt(eraMatch[2]!, 10);
    const westernYear =
      era === "令和" ? eraYear + 2018 : eraYear + 1988;
    return `${westernYear}-01`;
  }

  const [, era, eraYearStr, monthStr] = match;
  const eraYear = eraYearStr === "元" ? 1 : parseInt(eraYearStr!, 10);
  const month = parseInt(monthStr!, 10);

  let westernYear: number;
  if (era === "令和") westernYear = eraYear + 2018;
  else if (era === "平成") westernYear = eraYear + 1988;
  else return null;

  return `${westernYear}-${String(month).padStart(2, "0")}`;
}

/**
 * 年度別ページの HTML から PDF リンクを抽出する（テスト可能な純粋関数）。
 *
 * 構造:
 * - セクション見出し: 令和X年第Y回定例会（令和X年Z月）
 * - PDF リンク: 第X回定例会会議録（Y日目　PDF）
 *
 * 表紙・目次 PDF はスキップし、「X日目」のPDFのみ取得する。
 */
export function parseYearPage(
  html: string,
  pageUrl: string
): EtajimaMeeting[] {
  const results: EtajimaMeeting[] = [];

  // セクション見出しの位置を収集
  // 形式: 令和X年第Y回定例会（令和X年Z月）/ 令和X年第Y回臨時会（令和X年Z月）
  // 実際のHTML: <strong>令和６年第１回定例会（令和６年２月）</strong>
  const sections: { index: number; name: string }[] = [];

  // セクション見出しパターン: 年号+年+第X回+定例会/臨時会（+カッコ内の月情報）
  // href 属性を含むタグ（= リンク）の中身は除外
  const sectionHeadingPattern =
    /(?:令和|平成)[０-９0-9\s]*年第[０-９0-9\s]*回(?:定例会|臨時会)(?:[（(][^）)]*[）)])?/g;

  for (const match of html.matchAll(sectionHeadingPattern)) {
    const text = match[0]!.trim();
    const pos = match.index!;

    // このマッチが <a> タグ内（PDF リンクテキスト内）かチェック
    // 直前の最も近い <a か </a> を探す
    const before = html.slice(Math.max(0, pos - 500), pos);
    const lastAOpen = before.lastIndexOf("<a ");
    const lastAClose = before.lastIndexOf("</a>");
    const insideLink = lastAOpen > lastAClose;

    if (insideLink) continue;

    // 重複を避ける
    if (!sections.some((s) => s.name === text)) {
      sections.push({ index: pos, name: text });
    }
  }

  sections.sort((a, b) => a.index - b.index);

  // PDF リンクを抽出
  const linkPattern = /<a[^>]+href="([^"]+\.pdf)"[^>]*>([\s\S]*?)<\/a>/gi;

  for (const match of html.matchAll(linkPattern)) {
    const linkIndex = match.index!;
    const href = match[1]!;
    const linkText = match[2]!.replace(/<[^>]+>/g, "").trim();

    // 表紙・目次のPDFはスキップ
    if (
      linkText.includes("表紙") ||
      linkText.includes("目次")
    ) {
      continue;
    }

    // 「X日目」を含む PDF リンクのみ対象
    if (!linkText.includes("日目")) continue;

    // 現在のセクションを特定
    let currentSection = "";
    for (const section of sections) {
      if (section.index < linkIndex) {
        currentSection = section.name;
      }
    }

    // セクション見出しから YYYY-MM を取得
    const yearMonth = parseSectionDate(currentSection);

    // リンクテキストから日目の数字を取得して日付推定
    // 正確な日付は PDF 内から取得する必要があるが、YYYY-MM-01 をデフォルトとする
    if (!yearMonth) continue;
    const heldOn = `${yearMonth}-01`;

    // PDF の完全 URL を構築
    let pdfUrl: string;
    if (href.startsWith("http")) {
      pdfUrl = href;
    } else if (href.startsWith("/")) {
      pdfUrl = `${BASE_ORIGIN}${href}`;
    } else {
      // 相対パスの場合
      const baseUrl = pageUrl.replace(/\/[^/]*$/, "/");
      pdfUrl = baseUrl + href;
    }

    // タイトルを構築
    // リンクテキストから PDF サイズ情報を除去
    // 例: "第１回定例会会議録（１日目　PDF738KB）" → "第１回定例会会議録 １日目"
    const cleanLinkText = linkText
      .replace(/[\s　]*PDF[^\s）)]*/, "")
      .replace(/[（(]/g, " ")
      .replace(/[）)]/g, "")
      .replace(/\s+/g, " ")
      .trim();
    const title = currentSection
      ? `${currentSection.replace(/[（(].*[）)]/, "").trim()} ${cleanLinkText}`
      : cleanLinkText;

    results.push({ pdfUrl, title, heldOn, section: currentSection });
  }

  return results;
}

/**
 * 指定年の全 PDF リンクを取得する。
 */
export async function fetchMeetingList(
  baseUrl: string,
  year: number
): Promise<EtajimaMeeting[]> {
  // Step 1: 一覧ページから年度別ページのリンクを取得
  const topHtml = await fetchPage(baseUrl);
  if (!topHtml) return [];

  const yearPages = parseTopPage(topHtml);
  const eraTexts = toJapaneseEra(year);

  // 対象年度のページを見つける
  const targetPages = yearPages.filter((p) =>
    eraTexts.some((era) => p.label.includes(era))
  );
  if (targetPages.length === 0) return [];

  // Step 2: 各年度ページから PDF リンクを抽出
  const allMeetings: EtajimaMeeting[] = [];

  for (const targetPage of targetPages) {
    const yearHtml = await fetchPage(targetPage.url);
    if (!yearHtml) continue;

    const meetings = parseYearPage(yearHtml, targetPage.url);
    allMeetings.push(...meetings);
  }

  return allMeetings;
}
