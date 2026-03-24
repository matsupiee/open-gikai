/**
 * 中之条町議会（群馬県） — list フェーズ
 *
 * 一覧ページ（単一ページ）から PDF リンクを収集し、
 * リンクテキストをパースして年度・会議種別・開催日を取得する。
 *
 * URL: https://www.town.nakanojo.gunma.jp/site/nakanojo-gikai/1097.html
 * PDF リンクパターン: /uploaded/attachment/{ID}.pdf
 *
 * リンクテキスト例:
 *   "第1回定例会招集会議(1月16日)"
 *   "第1回定例会12月定例会議(12月3日～16日)"
 *   "第1回定例会第3回臨時会議(10月21日)"
 *
 * 年度は HTML 内の見出し（h2 等）から取得する。
 */

import {
  BASE_ORIGIN,
  LIST_PAGE_PATH,
  detectMeetingType,
  eraToWestern,
  fetchPage,
  normalizeFullWidth,
  delay,
} from "./shared";

export interface NakanojoSessionInfo {
  /** 会議タイトル（リンクテキストから生成） */
  title: string;
  /** 開催年（西暦） */
  year: number;
  /** 開催月（1〜12）。解析できない場合は null */
  month: number | null;
  /** 開催日（1〜31）。解析できない場合は null */
  day: number | null;
  /** PDF の絶対 URL */
  pdfUrl: string;
  /** 会議種別 */
  meetingType: "plenary" | "extraordinary";
}

const INTER_PAGE_DELAY_MS = 1500;

/**
 * 一覧ページ HTML から PDF リンクを抽出する。
 *
 * 各リンクには近傍の h2 見出しから取得した年度情報を付与する。
 */
export function extractPdfLinks(
  html: string,
): Array<{ pdfUrl: string; linkText: string; year: number | null }> {
  const results: Array<{ pdfUrl: string; linkText: string; year: number | null }> = [];

  // HTML を行単位でパースして年度コンテキストを追跡する
  // まず h2 タグと a タグを両方含む形でトークン化する

  // 現在の年度コンテキスト
  let currentYear: number | null = null;

  // h2 見出しから年度を抽出するパターン
  const h2EraPattern = /(令和|平成|昭和)(元|\d+)年/;

  // タグを順に処理: h2 タグと a[href=*.pdf] タグ
  const tokenPattern =
    /<h[1-4][^>]*>([\s\S]*?)<\/h[1-4]>|<a\s[^>]*href="([^"]*\.pdf)"[^>]*>([\s\S]*?)<\/a>/gi;

  let m: RegExpExecArray | null;
  while ((m = tokenPattern.exec(html)) !== null) {
    const headingContent = m[1];
    const pdfHref = m[2];
    const linkContent = m[3];

    if (headingContent !== undefined) {
      // 見出しタグ: 年度を抽出する
      const plainText = headingContent.replace(/<[^>]+>/g, "").trim();
      const eraMatch = h2EraPattern.exec(plainText);
      if (eraMatch) {
        currentYear = eraToWestern(eraMatch[1]!, eraMatch[2]!);
      }
    } else if (pdfHref !== undefined && linkContent !== undefined) {
      // PDF リンク
      const rawText = linkContent.replace(/<[^>]+>/g, "").trim();
      // サイズ表記などを除去
      const text = rawText.replace(/\(PDF[^)]*\)/g, "").trim();
      if (!text || !pdfHref) continue;

      const pdfUrl = pdfHref.startsWith("http")
        ? pdfHref
        : `${BASE_ORIGIN}${pdfHref}`;

      results.push({ pdfUrl, linkText: text, year: currentYear });
    }
  }

  return results;
}

/**
 * リンクテキストと年度から開催月日を抽出する。
 *
 * テキスト例:
 *   "第1回定例会招集会議(1月16日)" → month=1, day=16
 *   "第1回定例会12月定例会議(12月3日～16日)" → month=12, day=3
 *   "第1回定例会第3回臨時会議(10月21日)" → month=10, day=21
 */
export function parseMonthDay(text: string): { month: number | null; day: number | null } {
  // 全角数字・全角括弧を半角に変換
  const normalized = normalizeFullWidth(text)
    .replace(/（/g, "(")
    .replace(/）/g, ")");

  // パターン: (月日) または (月日～月日)
  const match = normalized.match(/\((\d+)月(\d+)日/);
  if (match) {
    return {
      month: parseInt(match[1]!, 10),
      day: parseInt(match[2]!, 10),
    };
  }

  return { month: null, day: null };
}

/**
 * リンクテキストと年度から NakanojoSessionInfo を生成する。
 * /uploaded/attachment/{ID}.pdf 形式の PDF リンクのみ対象とする。
 */
export function parseLinkInfo(
  linkText: string,
  pdfUrl: string,
  year: number | null,
): NakanojoSessionInfo | null {
  if (!year) return null;

  // /uploaded/attachment/{ID}.pdf パターンのリンクのみ対象
  if (!pdfUrl.includes("/uploaded/attachment/")) return null;

  const { month, day } = parseMonthDay(linkText);

  const title = `${linkText}`;

  return {
    title,
    year,
    month,
    day,
    pdfUrl,
    meetingType: detectMeetingType(linkText),
  };
}

/**
 * 一覧ページ HTML からセッション情報を収集する。
 */
export function parsePdfLinks(html: string): NakanojoSessionInfo[] {
  const links = extractPdfLinks(html);
  const results: NakanojoSessionInfo[] = [];

  for (const { pdfUrl, linkText, year } of links) {
    const info = parseLinkInfo(linkText, pdfUrl, year);
    if (info) {
      results.push(info);
    }
  }

  return results;
}

/**
 * 指定年の会議録セッション一覧を取得する。
 */
export async function fetchSessionList(year: number): Promise<NakanojoSessionInfo[]> {
  const url = `${BASE_ORIGIN}${LIST_PAGE_PATH}`;
  const html = await fetchPage(url);
  if (!html) return [];

  await delay(INTER_PAGE_DELAY_MS);

  const all = parsePdfLinks(html);
  return all.filter((s) => s.year === year);
}
