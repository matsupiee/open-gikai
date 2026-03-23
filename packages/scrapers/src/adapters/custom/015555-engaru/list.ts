/**
 * 遠軽町議会 — list フェーズ
 *
 * https://engaru.jp/life/page.php?id=398 の単一ページから
 * 全年度・全会議種別の PDF リンクを収集する。
 *
 * HTML 構造:
 *   h3（年号: "令和７年" など）
 *   h5（会議種別: "第６回定例会" など）
 *   ul > li > a（PDF リンク: "１２月９日開催　PDFファイル　779KB"）
 */

import {
  BASE_URL,
  PDF_BASE_URL,
  eraToWesternYear,
  normalizeNumbers,
  fetchPage,
} from "./shared";

export interface EngaruMeeting {
  /** PDF の完全 URL */
  pdfUrl: string;
  /** 会議タイトル（例: "第6回定例会 12月9日"） */
  title: string;
  /** 開催日 YYYY-MM-DD */
  heldOn: string;
  /** 会議種別（例: "第6回定例会"） */
  category: string;
}

/**
 * 和暦年号と日付テキストから YYYY-MM-DD を組み立てる。
 * 全角数字にも対応する。
 * e.g., "令和７年", "１２月９日開催" → "2025-12-09"
 */
export function buildDate(
  eraYearText: string,
  dateText: string,
): string | null {
  const westernYear = eraToWesternYear(eraYearText);
  if (!westernYear) return null;

  const normalized = normalizeNumbers(dateText);
  const match = normalized.match(/(\d+)月\s*(\d+)日/);
  if (!match) return null;

  const month = parseInt(match[1]!, 10);
  const day = parseInt(match[2]!, 10);

  return `${westernYear}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

/** HTML タグを除去してプレーンテキストを返す */
function stripHtml(html: string): string {
  return html.replace(/<[^>]+>/g, "").trim();
}

/**
 * 一覧ページ HTML をパースして PDF リンク一覧を返す（テスト可能な純粋関数）。
 *
 * 構造:
 *   h3 で年度を区切り、h5 で会議種別を区切る。
 *   各 h5 セクション内の a[href$=".pdf"] から PDF URL と開催日を抽出する。
 */
export function parseListPage(html: string): EngaruMeeting[] {
  const results: EngaruMeeting[] = [];

  // h3 見出しの位置と内容を収集（年度）
  const h3Pattern = /<h3[^>]*>([\s\S]*?)<\/h3>/gi;
  const h3s: { index: number; text: string }[] = [];
  for (const match of html.matchAll(h3Pattern)) {
    h3s.push({ index: match.index!, text: stripHtml(match[1]!) });
  }

  // h5 見出しの位置と内容を収集（会議種別）
  const h5Pattern = /<h5[^>]*>([\s\S]*?)<\/h5>/gi;
  const h5s: { index: number; text: string }[] = [];
  for (const match of html.matchAll(h5Pattern)) {
    h5s.push({ index: match.index!, text: stripHtml(match[1]!) });
  }

  // PDF リンクを収集
  const linkPattern = /<a[^>]+href="([^"]*\.pdf)"[^>]*>([\s\S]*?)<\/a>/gi;

  for (const linkMatch of html.matchAll(linkPattern)) {
    const linkIndex = linkMatch.index!;
    const href = linkMatch[1]!;
    const linkText = stripHtml(linkMatch[2]!);

    // 現在の h3（年度）を特定
    let currentYear = "";
    for (const h3 of h3s) {
      if (h3.index < linkIndex) {
        currentYear = h3.text;
      }
    }
    if (!currentYear) continue;

    // 現在の h5（会議種別）を特定
    let currentCategory = "";
    for (const h5 of h5s) {
      if (h5.index < linkIndex) {
        currentCategory = h5.text;
      }
    }
    if (!currentCategory) continue;

    // 日付を抽出
    const heldOn = buildDate(currentYear, linkText);
    if (!heldOn) continue;

    // PDF の完全 URL を構築
    let pdfUrl: string;
    if (href.startsWith("http")) {
      pdfUrl = href;
    } else if (href.startsWith("../common/img/content/")) {
      // 相対パスを解決: ../common/img/content/xxx.pdf → https://engaru.jp/common/img/content/xxx.pdf
      const filename = href.replace("../common/img/content/", "");
      pdfUrl = `${PDF_BASE_URL}${filename}`;
    } else if (href.startsWith("/")) {
      pdfUrl = `https://engaru.jp${href}`;
    } else {
      pdfUrl = `https://engaru.jp/life/${href}`;
    }

    // 会議種別を正規化（全角数字→半角）
    const normalizedCategory = normalizeNumbers(currentCategory);

    // 日付部分を抽出してタイトルを構築
    const dateMatch = normalizeNumbers(linkText).match(/(\d+月\s*\d+日)/);
    const dateStr = dateMatch ? dateMatch[1]! : "";
    const title = `${normalizedCategory} ${dateStr}`;

    results.push({
      pdfUrl,
      title,
      heldOn,
      category: normalizedCategory,
    });
  }

  return results;
}

/**
 * 指定年の会議録 PDF リンクを取得する。
 */
export async function fetchMeetingList(
  year: number,
): Promise<EngaruMeeting[]> {
  const html = await fetchPage(BASE_URL);
  if (!html) return [];

  const allMeetings = parseListPage(html);

  // 指定年でフィルタ
  return allMeetings.filter((m) => {
    const meetingYear = parseInt(m.heldOn.split("-")[0]!, 10);
    return meetingYear === year;
  });
}
