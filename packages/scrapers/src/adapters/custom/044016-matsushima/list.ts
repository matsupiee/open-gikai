/**
 * 松島町議会 — list フェーズ
 *
 * 定例会・臨時会一覧ページ（1ページに全年度分掲載）から
 * 指定年の会議録 PDF リンクを収集する。
 *
 * HTML 構造:
 * - <h4>令和8年(2026年)</h4> で年度ごとに区切られる
 * - <table> 内に定例会・臨時会ごとの行
 * - 会議録リンクはテキストに「会議録」を含む <a> タグ
 * - 付議案件・会期日程・一般質問・議決結果は除外
 */

import { BASE_ORIGIN, LIST_PATH, detectMeetingType, fetchPage } from "./shared";

export interface MatsushimaMeeting {
  /** PDF の絶対 URL */
  pdfUrl: string;
  /** 会議タイトル（例: "令和7年第4回定例会 12月15日会議録"） */
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
 * 1. <h4> タグから年度を抽出し、currentYear を更新する
 * 2. 直後の <table> 内で <a> テキストに「会議録」を含むリンクを収集する
 * 3. 各リンクからタイトルと開催日を組み立てる
 */
export function parseListPage(
  html: string,
  targetYear: number
): MatsushimaMeeting[] {
  const results: MatsushimaMeeting[] = [];

  // h4 タグとその後の table を処理するため、html を h4 区切りでブロック分割する
  // パターン: <h4>...</h4> の後に続くコンテンツ
  const blockRegex = /<h4[^>]*>([\s\S]*?)<\/h4>([\s\S]*?)(?=<h4|$)/gi;

  for (const blockMatch of html.matchAll(blockRegex)) {
    const h4Text = blockMatch[1]!;
    const blockContent = blockMatch[2]!;

    // h4 から西暦年を抽出
    // パターン1: "令和8年(2026年)" → 2026
    // パターン2: "令和7年（2025年）" (全角括弧)
    const westernYearMatch = h4Text.match(/[（(](\d{4})年[）)]/);
    if (!westernYearMatch?.[1]) continue;

    const blockYear = parseInt(westernYearMatch[1], 10);
    if (blockYear !== targetYear) continue;

    // このブロック内から会議録リンクを抽出
    // <td> 内のセッション名（<strong> タグ）を取得して context を構築する
    const sessions = extractSessionsFromBlock(blockContent, blockYear);
    results.push(...sessions);
  }

  return results;
}

/**
 * 年度ブロック内の HTML からセッション情報を抽出する。
 */
function extractSessionsFromBlock(
  html: string,
  year: number
): MatsushimaMeeting[] {
  const results: MatsushimaMeeting[] = [];

  // <tr> 単位で処理する
  const trRegex = /<tr[^>]*>([\s\S]*?)<\/tr>/gi;

  for (const trMatch of html.matchAll(trRegex)) {
    const trContent = trMatch[1]!;

    // セッション名を <strong> または最初の <td> テキストから取得
    const sessionMatch = trContent.match(/<strong[^>]*>([\s\S]*?)<\/strong>/i);
    const sessionText = sessionMatch
      ? sessionMatch[1]!
          .replace(/<[^>]+>/g, "")
          .replace(/\s+/g, " ")
          .trim()
      : "";

    // 会議録リンクを抽出（テキストに「会議録」を含む <a> タグのみ）
    const linkRegex = /<a\s[^>]*href="([^"]*\.pdf)"[^>]*>([^<]*)<\/a>/gi;

    for (const linkMatch of trContent.matchAll(linkRegex)) {
      const href = linkMatch[1]!.trim();
      const linkText = linkMatch[2]!.trim();

      // 「会議録」を含むリンクのみ対象
      if (!linkText.includes("会議録")) continue;

      // 絶対 URL に変換
      const pdfUrl = href.startsWith("http")
        ? href
        : `${BASE_ORIGIN}${href}`;

      // 開催日をリンクテキストから抽出
      // パターン: "12月15日会議録" → month=12, day=15
      const dateInLink = linkText.match(/(\d{1,2})月(\d{1,2})日会議録/);
      let heldOn: string | null = null;
      if (dateInLink?.[1] && dateInLink[2]) {
        const month = parseInt(dateInLink[1], 10);
        const day = parseInt(dateInLink[2], 10);
        heldOn = `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
      }

      // タイトルを組み立てる
      const title = sessionText
        ? `${sessionText} ${linkText}`
        : linkText;

      results.push({
        pdfUrl,
        title,
        heldOn,
        meetingType: detectMeetingType(sessionText || linkText),
      });
    }
  }

  return results;
}

/**
 * 一覧ページから指定年の全会議録 PDF 情報を取得する。
 */
export async function fetchMeetingList(
  year: number
): Promise<MatsushimaMeeting[]> {
  const url = `${BASE_ORIGIN}${LIST_PATH}`;
  const html = await fetchPage(url);
  if (!html) return [];

  return parseListPage(html, year);
}
