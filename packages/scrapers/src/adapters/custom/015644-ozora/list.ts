/**
 * 大空町議会 — list フェーズ
 *
 * https://www.town.ozora.hokkaido.jp/machinoshirase/chogikai/1/1/2213.html から
 * 全年度・全会議種別の PDF リンクを収集する。
 *
 * HTML 構造:
 *   テーブル形式で「区分」列と「PDF」列が並ぶ。
 *   区分列には会議名と日程が含まれる（例: 第1回定例会（令和6年3月6日～3月13日））
 *   PDF列にはPDFファイルへのリンクがある。
 */

import {
  LIST_URL,
  PDF_BASE_URL,
  eraToWesternYear,
  normalizeNumbers,
  fetchPage,
} from "./shared";

export interface OzoraMeeting {
  /** PDF の完全 URL */
  pdfUrl: string;
  /** 会議タイトル（例: 第1回定例会（令和6年3月6日～3月13日）） */
  title: string;
  /** 開催日 YYYY-MM-DD（日程の最初の日） */
  heldOn: string;
  /** 会議種別（例: 第1回定例会） */
  category: string;
}

/**
 * 区分テキスト（例: "第1回定例会（令和6年3月6日～3月13日）"）から
 * 開催日 YYYY-MM-DD を抽出する。
 * 複数日にまたがる場合は最初の日を返す。
 */
export function parseDateFromCategory(categoryText: string): string | null {
  const normalized = normalizeNumbers(categoryText);

  // 和暦年を抽出（例: 令和6年、平成28年）
  const eraMatch = normalized.match(/(令和|平成)(元|\d+)年/);
  if (!eraMatch) return null;

  const westernYear = eraToWesternYear(eraMatch[0]);
  if (!westernYear) return null;

  // 月日を抽出（最初に出現するもの）
  const dateMatch = normalized.match(/(\d+)月(\d+)日/);
  if (!dateMatch) return null;

  const month = parseInt(dateMatch[1]!, 10);
  const day = parseInt(dateMatch[2]!, 10);

  return `${westernYear}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

/**
 * 区分テキストから会議種別を抽出する。
 * 例: "第1回定例会（令和6年3月6日～3月13日）" → "第1回定例会"
 */
export function parseCategoryName(categoryText: string): string {
  const normalized = normalizeNumbers(categoryText);
  // 括弧より前の部分を取り出す
  const match = normalized.match(/^([^（(]+)/);
  if (match) return match[1]!.trim();
  return normalized.trim();
}

/**
 * 一覧ページ HTML をパースして PDF リンク一覧を返す（テスト可能な純粋関数）。
 *
 * 構造:
 *   テーブルの各データ行は <th scope="row">区分テキスト</th> と <td>PDFリンク</td> で構成される。
 *   ヘッダー行は <th scope="row">区分</th><th scope="col">PDF</th> の形式。
 */
export function parseListPage(html: string): OzoraMeeting[] {
  const results: OzoraMeeting[] = [];

  // テーブル行を抽出（改行・タブを含む複数行）
  const trPattern = /<tr[^>]*>([\s\S]*?)<\/tr>/gi;

  for (const trMatch of html.matchAll(trPattern)) {
    const rowHtml = trMatch[1]!;

    // PDF リンクがない行はスキップ
    const linkMatch = rowHtml.match(/<a[^>]+href="([^"]*\.pdf)"[^>]*>/i);
    if (!linkMatch) continue;

    // th[scope="row"] から区分テキストを抽出
    const thMatch = rowHtml.match(/<th[^>]+scope="row"[^>]*>([\s\S]*?)<\/th>/i);
    if (!thMatch) continue;

    const categoryText = thMatch[1]!
      .replace(/<[^>]+>/g, " ")
      .replace(/\s+/g, " ")
      .trim();

    if (!categoryText) continue;

    let href = linkMatch[1]!;

    // URL を正規化
    if (href.startsWith("//")) {
      href = `https:${href}`;
    } else if (href.startsWith("/")) {
      href = `${PDF_BASE_URL}${href}`;
    } else if (!href.startsWith("http")) {
      href = `${PDF_BASE_URL}/${href}`;
    }

    const heldOn = parseDateFromCategory(categoryText);
    if (!heldOn) continue;

    const category = parseCategoryName(categoryText);

    results.push({
      pdfUrl: href,
      title: normalizeNumbers(categoryText),
      heldOn,
      category,
    });
  }

  return results;
}

/**
 * 指定年の会議録 PDF リンクを取得する。
 */
export async function fetchMeetingList(
  year: number,
): Promise<OzoraMeeting[]> {
  const html = await fetchPage(LIST_URL);
  if (!html) return [];

  const allMeetings = parseListPage(html);

  // 指定年でフィルタ
  return allMeetings.filter((m) => {
    const meetingYear = parseInt(m.heldOn.split("-")[0]!, 10);
    return meetingYear === year;
  });
}
