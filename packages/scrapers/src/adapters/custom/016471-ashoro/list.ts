/**
 * 足寄町議会 — list フェーズ
 *
 * page_6.html の単一ページから全年度・全会議種別の PDF リンクを収集する。
 *
 * HTML 構造:
 *   h2（年号: "令和７年" など）
 *   table
 *     tr
 *       td（会議種別: "第１回定例会" など）
 *       td（PDF リンク: <a href="...pdf">1月24日</a> が複数）
 */

import {
  BASE_ORIGIN,
  LIST_PAGE_URL,
  eraToWesternYear,
  normalizeNumbers,
  fetchPage,
} from "./shared";

export interface AshoroMeeting {
  /** PDF の完全 URL */
  pdfUrl: string;
  /** 会議タイトル（例: "第1回定例会 3月4日"） */
  title: string;
  /** 開催日 YYYY-MM-DD */
  heldOn: string;
  /** 会議種別（例: "第1回定例会"） */
  category: string;
}

/**
 * 和暦年号と日付テキストから YYYY-MM-DD を組み立てる。
 * 全角数字にも対応する。
 * e.g., "令和７年", "3月4日" → "2025-03-04"
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
 *   h2 で年度を区切り、その直後の table 内の tr 行から
 *   1列目: 会議種別、2列目: PDF リンク（複数）を抽出する。
 */
export function parseListPage(html: string): AshoroMeeting[] {
  const results: AshoroMeeting[] = [];

  // h2 見出しの位置と内容を収集
  const h2Pattern = /<h2[^>]*>([\s\S]*?)<\/h2>/gi;
  const h2s: { index: number; text: string }[] = [];
  for (const match of html.matchAll(h2Pattern)) {
    const text = stripHtml(match[1]!);
    h2s.push({ index: match.index!, text });
  }

  // tr 行を収集し、各行の td を抽出
  const trPattern = /<tr[^>]*>([\s\S]*?)<\/tr>/gi;

  for (const trMatch of html.matchAll(trPattern)) {
    const trIndex = trMatch.index!;
    const trContent = trMatch[1]!;

    // 現在の h2（年度）を特定
    let currentYear = "";
    for (const h2 of h2s) {
      if (h2.index < trIndex) {
        currentYear = h2.text;
      }
    }
    if (!currentYear) continue;

    // td を抽出
    const tdPattern = /<td[^>]*>([\s\S]*?)<\/td>/gi;
    const tds: string[] = [];
    for (const tdMatch of trContent.matchAll(tdPattern)) {
      tds.push(tdMatch[1]!);
    }

    if (tds.length < 2) continue;

    // 1列目: 会議種別
    const category = stripHtml(tds[0]!).replace(/[\s　]+/g, "");

    // ヘッダー行（名称/開催日）をスキップ
    if (category === "名称" || !category) continue;

    // 2列目: PDF リンクを抽出
    const linkPattern = /<a[^>]+href="([^"]*\.pdf)"[^>]*>([\s\S]*?)<\/a>/gi;
    for (const linkMatch of tds[1]!.matchAll(linkPattern)) {
      const href = linkMatch[1]!;
      const linkText = stripHtml(linkMatch[2]!).replace(/^[・]+/, "").trim();

      // 日付を構築
      const heldOn = buildDate(currentYear, linkText);
      if (!heldOn) continue;

      // PDF の完全 URL を構築
      let pdfUrl: string;
      if (href.startsWith("http")) {
        pdfUrl = href;
      } else if (href.startsWith("/")) {
        pdfUrl = `${BASE_ORIGIN}${href}`;
      } else {
        pdfUrl = `${BASE_ORIGIN}/${href}`;
      }

      const title = category ? `${category} ${linkText}` : linkText;

      results.push({
        pdfUrl,
        title,
        heldOn,
        category,
      });
    }
  }

  return results;
}

/**
 * 指定年の会議録 PDF リンクを取得する。
 */
export async function fetchMeetingList(
  year: number,
): Promise<AshoroMeeting[]> {
  const html = await fetchPage(LIST_PAGE_URL);
  if (!html) return [];

  const allMeetings = parseListPage(html);

  // 指定年でフィルタ
  return allMeetings.filter((m) => {
    const meetingYear = parseInt(m.heldOn.split("-")[0]!, 10);
    return meetingYear === year;
  });
}
