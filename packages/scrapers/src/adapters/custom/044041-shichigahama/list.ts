/**
 * 七ヶ浜町議会 — list フェーズ
 *
 * 会議録一覧ページ（全年度が単一ページに掲載）から
 * 指定年の会議録 PDF リンクを収集する。
 *
 * HTML 構造:
 * - <h2>令和X年定例会等会議録</h2> で年度ごとに区切られる
 * - 各 PDF へのリンクが列挙される
 * - ページネーションなし
 */

import { LIST_URL, detectMeetingType, fetchPage, toHankaku } from "./shared";

export interface ShichigahamaMeeting {
  /** PDF の絶対 URL */
  pdfUrl: string;
  /** 会議タイトル（例: "令和7年定例会6月会議"） */
  title: string;
  /** 開催日 YYYY-MM-DD（解析できない場合は null） */
  heldOn: string | null;
  /** 会議種別 */
  meetingType: "plenary" | "extraordinary" | "committee";
}

/**
 * 一覧ページ HTML から指定年の会議録 PDF 情報を抽出する（テスト可能な純粋関数）。
 *
 * アルゴリズム:
 * 1. <h2> タグから和暦年を抽出し、西暦年に変換する
 * 2. 指定年と一致するブロック内の PDF リンクを収集する
 * 3. リンクテキストからタイトルを取得する
 */
export function parseListPage(
  html: string,
  targetYear: number
): ShichigahamaMeeting[] {
  const results: ShichigahamaMeeting[] = [];

  // <h2> タグとその後のコンテンツをブロック分割する
  const blockRegex = /<h2[^>]*>([\s\S]*?)<\/h2>([\s\S]*?)(?=<h2|$)/gi;

  for (const blockMatch of html.matchAll(blockRegex)) {
    const h2Text = toHankaku(blockMatch[1]!.replace(/<[^>]+>/g, "").trim());
    const blockContent = blockMatch[2]!;

    // h2 から和暦年を抽出して西暦に変換
    // パターン: "令和7年定例会等会議録" → 2025
    const reiwaMatch = h2Text.match(/令和(元|\d+)年/);
    if (!reiwaMatch?.[1]) continue;

    const eraYear = reiwaMatch[1] === "元" ? 1 : parseInt(reiwaMatch[1], 10);
    const blockYear = 2018 + eraYear;

    if (blockYear !== targetYear) continue;

    // このブロック内の PDF リンクを抽出
    const meetings = extractMeetingsFromBlock(blockContent, blockYear, h2Text);
    results.push(...meetings);
  }

  return results;
}

/**
 * 年度ブロック内の HTML から会議録情報を抽出する。
 */
function extractMeetingsFromBlock(
  html: string,
  year: number,
  _h2Text: string
): ShichigahamaMeeting[] {
  const results: ShichigahamaMeeting[] = [];

  // PDF リンクを抽出
  // パターン: <a href="...pdf">リンクテキスト</a>
  const linkRegex = /<a\s[^>]*href="([^"]*\.pdf)"[^>]*>([\s\S]*?)<\/a>/gi;

  for (const linkMatch of html.matchAll(linkRegex)) {
    const href = linkMatch[1]!.trim();
    const rawText = linkMatch[2]!.replace(/<[^>]+>/g, "").trim();
    const linkText = toHankaku(rawText);

    if (!linkText) continue;

    // 絶対 URL に変換
    // href は相対パスの場合がある（例: ../../benricho/joho/assets/...）
    let pdfUrl: string;
    try {
      pdfUrl = new URL(
        href,
        "https://www.shichigahama.com/benricho/joho/gikai4-010-10126.html"
      ).toString();
    } catch {
      continue;
    }

    // リンクテキストから会議タイトルを取得（.pdf 拡張子を除去）
    const title = linkText.replace(/\.pdf$/i, "").trim();

    // 開催日をタイトルから推測する
    // パターン: "令和7年定例会6月会議" → 6月の会議
    // 正確な日付は PDF 内にしかないため、月のみで1日として設定
    const heldOn = extractHeldOnFromTitle(title, year);

    results.push({
      pdfUrl,
      title,
      heldOn,
      meetingType: detectMeetingType(title),
    });
  }

  return results;
}

/**
 * タイトルから開催日を推測する。
 * 月のみ特定できる場合は月の1日を返す。
 * 解析できない場合は null を返す。
 */
export function extractHeldOnFromTitle(
  title: string,
  year: number
): string | null {
  // パターン: "定例会6月会議" → 6月
  const monthMatch = title.match(/(\d{1,2})月/);
  if (monthMatch?.[1]) {
    const month = parseInt(monthMatch[1], 10);
    if (month >= 1 && month <= 12) {
      return `${year}-${String(month).padStart(2, "0")}-01`;
    }
  }
  return null;
}

/**
 * 一覧ページから指定年の全会議録 PDF 情報を取得する。
 */
export async function fetchMeetingList(
  year: number
): Promise<ShichigahamaMeeting[]> {
  const html = await fetchPage(LIST_URL);
  if (!html) return [];

  return parseListPage(html, year);
}
