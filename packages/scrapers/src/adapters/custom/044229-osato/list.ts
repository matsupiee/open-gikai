/**
 * 大郷町議会 — list フェーズ
 *
 * 一覧ページ（単一ページに全年度分掲載）から
 * 指定年の会議録 PDF リンクを収集する。
 *
 * HTML 構造（テーブル形式）:
 * - 年度は <th rowspan="N"> セル内の <span> テキスト（令和X年 / 平成X年）
 * - 会議種別は <td colspan="3"> セル内の <strong> テキスト（第N回（M月）定例会/臨時会）
 * - PDF リンクは <td> セル内の <a href="/uploaded/attachment/{ID}.pdf">
 * - rowspan を利用して年度・会議種別を複数行に跨って表示する構造
 *
 * パース戦略:
 * - テーブル全体を行ごとに処理し、<th> が現れたら年度を更新
 * - <td colspan="3"> または <td colspan> を含む行が現れたら会議種別を更新
 * - PDF リンクが見つかったら現在の年度・会議種別と組み合わせてレコードを生成
 */

import { BASE_ORIGIN, LIST_PATH, detectMeetingType, fetchPage, parseWarekiYear, toHankaku } from "./shared";

export interface OsatoMeeting {
  /** PDF の絶対 URL */
  pdfUrl: string;
  /** 会議タイトル（例: "令和7年 第4回（12月）定例会 12月5日会議録 [PDF]"） */
  title: string;
  /** 開催日 YYYY-MM-DD（解析できない場合は null） */
  heldOn: string | null;
  /** 会議種別 */
  meetingType: "plenary" | "extraordinary" | "committee";
}

/**
 * HTML テキストからタグを除去し、空白を正規化して返す。
 */
function stripTags(html: string): string {
  return html
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * 一覧ページ HTML から指定年の会議録 PDF 情報を抽出する（テスト可能な純粋関数）。
 *
 * テーブルを行単位で処理し、<th> で年度を更新、<td colspan="3"> で会議種別を更新、
 * PDF リンク <a> でレコードを生成する。
 */
export function parseListPage(
  html: string,
  targetYear: number
): OsatoMeeting[] {
  const results: OsatoMeeting[] = [];

  let currentYearText = "";
  let currentSessionText = "";

  // テーブル内の行を処理する
  // <tr> ごとに分割して各行を解析する
  const trPattern = /<tr[^>]*>([\s\S]*?)<\/tr>/gi;

  for (const trMatch of html.matchAll(trPattern)) {
    const rowHtml = trMatch[1]!;

    // <th> セルから年度テキストを取得する
    // 年次ヘッダー（「年次」テキスト）は無視する
    const thMatch = rowHtml.match(/<th[^>]*>([\s\S]*?)<\/th>/i);
    if (thMatch) {
      const thText = stripTags(thMatch[1]!);
      const year = parseWarekiYear(thText);
      if (year !== null) {
        currentYearText = thText;
        // 年度が変わったら会議種別もリセット
        currentSessionText = "";
      }
    }

    // <td colspan="3"> または <td colspan=3> セルから会議種別テキストを取得する
    // 会議種別テキストは「第N回」「定例会」「臨時会」「委員会」を含む
    const sessionCellMatch = rowHtml.match(/<td[^>]*colspan[^>]*>([\s\S]*?)<\/td>/i);
    if (sessionCellMatch) {
      const sessionText = stripTags(sessionCellMatch[1]!);
      if (
        sessionText.includes("定例会") ||
        sessionText.includes("臨時会") ||
        sessionText.includes("委員会")
      ) {
        currentSessionText = sessionText;
      }
    }

    // 現在の年度が対象年でなければ PDF リンクをスキップ
    const currentYear = parseWarekiYear(currentYearText);
    if (currentYear !== targetYear) continue;

    // PDF リンクを抽出する
    const pdfLinkPattern = /<a\s[^>]*href="([^"]*\/uploaded\/attachment\/[^"]*\.pdf)"[^>]*>([^<]*)<\/a>/gi;

    for (const linkMatch of rowHtml.matchAll(pdfLinkPattern)) {
      const href = linkMatch[1]!.trim();
      const linkText = linkMatch[2]!.trim();

      // リンクテキストから開催日を抽出
      // パターン: "12月5日会議録 [PDF]" → month=12, day=5
      const normalizedLinkText = toHankaku(linkText);
      const dateInLink = normalizedLinkText.match(/(\d{1,2})月(\d{1,2})日/);
      let heldOn: string | null = null;
      if (dateInLink?.[1] && dateInLink[2]) {
        const month = parseInt(dateInLink[1], 10);
        const day = parseInt(dateInLink[2], 10);
        heldOn = `${targetYear}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
      }

      // 絶対 URL に変換
      const pdfUrl = href.startsWith("http")
        ? href
        : `${BASE_ORIGIN}${href}`;

      // タイトルを組み立てる
      const titleParts = [currentYearText, currentSessionText].filter(Boolean);
      const title = titleParts.length > 0
        ? `${titleParts.join(" ")} ${linkText}`
        : linkText;

      results.push({
        pdfUrl,
        title,
        heldOn,
        meetingType: detectMeetingType(currentSessionText || linkText),
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
): Promise<OsatoMeeting[]> {
  const url = `${BASE_ORIGIN}${LIST_PATH}`;
  const html = await fetchPage(url);
  if (!html) return [];

  return parseListPage(html, year);
}
