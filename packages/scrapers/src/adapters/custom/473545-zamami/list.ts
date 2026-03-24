/**
 * 座間味村議会 会議録 — list フェーズ
 *
 * 単一HTMLページにすべての会議録PDFリンクが掲載されているため、
 * 1回のHTTPリクエストで全リンクを収集できる。
 *
 * HTML階層:
 *   年度見出し（h4相当） → 会期見出し（strong/太字） → PDF リンク（li > a）
 *
 * リンクテキストパターン:
 *   {和暦}年{月}月{日}日（第{号数}号）
 *   {和暦}年{月}月{日}日（第{号数}号）一般質問
 */

import {
  LIST_URL,
  BASE_ORIGIN,
  eraToWesternYear,
  fetchPage,
  normalizeUrl,
  toHalfWidth,
} from "./shared";

export interface ZamamiMeeting {
  /** PDF の完全 URL */
  pdfUrl: string;
  /** 会議タイトル（例: "令和6年第4回定例会"） */
  title: string;
  /** 開催日 YYYY-MM-DD（解析できない場合は null） */
  heldOn: string | null;
  /** 会議種別（"plenary" / "extraordinary"） */
  category: string;
  /** 外部 ID 用のキー（例: "473545_d96f9e12a9c9..."） */
  pdfKey: string;
  /** 号数 */
  issueNumber: number | null;
}

/**
 * リンクテキストから開催日を解析する。
 * e.g., "令和7年12月16日（第1号）" → "2025-12-16"
 */
export function parseDateFromLinkText(text: string): string | null {
  const halfWidth = toHalfWidth(text);
  const match = halfWidth.match(/(令和|平成)(元|\d+)年(\d+)月(\d+)日/);
  if (!match) return null;

  const year = eraToWesternYear(`${match[1]}${match[2]}年`);
  if (!year) return null;

  const month = parseInt(match[3]!, 10);
  const day = parseInt(match[4]!, 10);
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

/**
 * リンクテキストから号数を抽出する。
 * e.g., "令和7年12月16日（第1号）" → 1
 */
export function parseIssueNumber(text: string): number | null {
  const halfWidth = toHalfWidth(text);
  const match = halfWidth.match(/第(\d+)号/);
  if (!match) return null;
  return parseInt(match[1]!, 10);
}

/**
 * 会期見出しテキストから会議種別を判別する。
 * e.g., "令和7年第4回定例会" → "plenary"
 *       "令和7年第1回臨時会" → "extraordinary"
 */
export function parseCategoryFromSession(sessionText: string): string {
  if (sessionText.includes("臨時会")) return "extraordinary";
  return "plenary";
}

/**
 * PDF URL からキーを生成する。
 * e.g., ".../d96f9e12a9c9e54b48c141887748094ced5c735d.pdf" → "473545_d96f9e12..."
 *       ".../250308gijiroku.pdf" → "473545_250308gijiroku"
 */
export function extractPdfKey(pdfUrl: string): string {
  const match = pdfUrl.match(/\/([^/]+)\.pdf$/i);
  const fileName = match ? match[1]! : pdfUrl;
  return `473545_${fileName}`;
}

/**
 * 会議録一覧HTMLをパースし、ZamamiMeetingの配列を返す。
 *
 * HTML構造:
 *   - h4タグ: 年度見出し（例: <h4>令和7年</h4>）または同等の見出し
 *   - strongタグ: 会期見出し（例: <strong>令和7年第4回定例会</strong>）
 *   - li > a: PDF リンク（例: <li><a href="...">令和7年12月16日（第1号）</a></li>）
 *
 * 対象年のリンクのみを返す（year が指定された場合）。
 */
export function parseListPage(
  html: string,
  targetYear: number | null = null,
): ZamamiMeeting[] {
  const meetings: ZamamiMeeting[] = [];
  let currentSession = "";
  let currentCategory = "plenary";

  // HTMLを行単位で処理するのではなく、ブロック単位でタグを抽出する
  // strong タグ（会期見出し）と a タグ（PDFリンク）を走査する

  // タグシーケンスを抽出するための正規表現
  // strong タグの会期見出し: <strong>令和7年第4回定例会</strong>
  // a タグの PDF リンク: <a href="...pdf">リンクテキスト</a>
  const tagPattern =
    /<(strong|h4|h3|h2)[^>]*>([\s\S]*?)<\/\1>|<a\s+[^>]*href="([^"]+\.pdf)"[^>]*>([\s\S]*?)<\/a>/gi;

  for (const match of html.matchAll(tagPattern)) {
    if (match[1]) {
      // strong / h4 / h3 / h2 タグ: 会期見出しまたは年度見出し
      const tagName = match[1].toLowerCase();
      const tagText = match[2]!.replace(/<[^>]+>/g, "").trim();

      if (tagName === "strong") {
        // 会期見出し: "令和7年第4回定例会" など
        if (/(?:令和|平成)/.test(tagText) && /(?:定例会|臨時会)/.test(tagText)) {
          currentSession = tagText;
          currentCategory = parseCategoryFromSession(tagText);
        }
      }
      // h4/h3/h2 は年度見出しとして処理（currentSession はリセットしない）
    } else if (match[3]) {
      // a タグ: PDF リンク
      const href = match[3]!;
      const linkText = match[4]!.replace(/<[^>]+>/g, "").trim();

      const pdfUrl = normalizeUrl(href.startsWith("/") ? href : href.startsWith("http") ? href : `${BASE_ORIGIN}/info/${href}`);

      // 開催日をリンクテキストから抽出
      const heldOn = parseDateFromLinkText(linkText);

      // 対象年フィルタリング
      if (targetYear !== null && heldOn) {
        const meetingYear = parseInt(heldOn.slice(0, 4), 10);
        if (meetingYear !== targetYear) continue;
      }

      const issueNumber = parseIssueNumber(linkText);
      const pdfKey = extractPdfKey(pdfUrl);

      // タイトルを構成: 会期見出し + 号数
      const issueLabel =
        issueNumber !== null ? `（第${issueNumber}号）` : "";
      const hasGeneralQuestion = /一般質問/.test(linkText);
      const generalQuestionLabel = hasGeneralQuestion ? " 一般質問" : "";
      const title = currentSession
        ? `${currentSession}${issueLabel}${generalQuestionLabel}`
        : linkText;

      meetings.push({
        pdfUrl,
        title,
        heldOn,
        category: currentCategory,
        pdfKey,
        issueNumber,
      });
    }
  }

  return meetings;
}

/**
 * 指定年の会議一覧を取得する。
 */
export async function fetchMeetingList(year: number): Promise<ZamamiMeeting[]> {
  const html = await fetchPage(LIST_URL);
  if (!html) return [];

  return parseListPage(html, year);
}
