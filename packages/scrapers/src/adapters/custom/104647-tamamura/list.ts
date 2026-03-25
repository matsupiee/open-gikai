/**
 * 玉村町議会（群馬県） — list フェーズ
 *
 * 2段階で PDF リンクを収集する:
 * 1. トップページから年度別ページへのリンクを収集（または既知のドキュメント ID マッピングを使用）
 * 2. 年度別ページからテーブル内の PDF リンクとメタ情報を抽出
 *
 * 目次 PDF（「会議録目次」テキストを含むリンク）はスキップする。
 */

import {
  BASE_ORIGIN,
  YEAR_DOC_IDS,
  detectMeetingType,
  fetchPage,
  delay,
} from "./shared";

export interface TamamuraMeeting {
  /** 会議タイトル（例: "令和7年第4回定例会(12月議会)"） */
  title: string;
  /** 開催日（YYYY-MM-DD）または null */
  heldOn: string | null;
  /** PDF の絶対 URL */
  pdfUrl: string;
  /** 会議種別 */
  meetingType: "plenary" | "extraordinary" | "committee";
}

const INTER_PAGE_DELAY_MS = 1500;

/**
 * トップページの HTML から年度別ページへのリンクを抽出する。
 *
 * パターン: <a href="/docs/{ドキュメントID}/">
 */
export function parseTopPage(
  html: string,
): { year: number; docId: string; url: string }[] {
  const results: { year: number; docId: string; url: string }[] = [];

  // /docs/{docId}/ 形式のリンクを抽出
  const linkRegex = /<a[^>]+href="\/docs\/(\d+)\/"[^>]*>([\s\S]*?)<\/a>/gi;

  for (const match of html.matchAll(linkRegex)) {
    const docId = match[1]!;
    const rawText = match[2]!.replace(/<[^>]+>/g, "").trim();

    // テキストから和暦年を解析
    const eraMatch = rawText.match(/(令和|平成)(元|\d+)年/);
    if (!eraMatch) continue;

    const era = eraMatch[1]!;
    const eraYearStr = eraMatch[2]!;
    const eraYear = eraYearStr === "元" ? 1 : parseInt(eraYearStr, 10);
    const year = era === "令和" ? eraYear + 2018 : eraYear + 1988;

    const url = `${BASE_ORIGIN}/docs/${docId}/`;

    if (!results.some((r) => r.docId === docId)) {
      results.push({ year, docId, url });
    }
  }

  return results;
}

/**
 * 年度別ページの HTML から会議名を取得する。
 *
 * 玉村町の構造:
 * - 定例会: <th colspan="3" scope="col" ...>令和7年第4回定例会(12月議会)</th>
 * - 臨時会: <p>令和7年第5回臨時会(12月22日)</p> または <th>...</th>
 *
 * テーブルを走査してセルと会議名の対応を把握する。
 */
export function parseYearPage(
  html: string,
  docId: string,
): TamamuraMeeting[] {
  const results: TamamuraMeeting[] = [];

  let currentTitle = "";
  let currentHeldOn: string | null = null;

  // <th>, <p>, <td> タグを走査するために行に分割
  // まず <br> をニューラインに変換
  const normalized = html
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/\r\n/g, "\n");

  // テーブル行・セルごとに処理
  // th または span 等の会議名らしきものを検出してから PDF リンクを収集
  const lines = normalized.split("\n");

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line) continue;

    // <th> タグから会議名を抽出（定例会・臨時会のタイトル）
    const thMatch = line.match(/<th[^>]*>([\s\S]*?)<\/th>/i);
    if (thMatch) {
      const thText = thMatch[1]!.replace(/<[^>]+>/g, "").trim();
      if (/(?:定例会|臨時会)/.test(thText)) {
        currentTitle = thText;
        currentHeldOn = parseMeetingDate(thText);
      }
      continue;
    }

    // <p> タグから臨時会の会議名を抽出
    const pMatch = line.match(/<p[^>]*>([\s\S]*?)<\/p>/i);
    if (pMatch) {
      const pText = pMatch[1]!.replace(/<[^>]+>/g, "").trim();
      if (/(?:定例会|臨時会)/.test(pText)) {
        currentTitle = pText;
        currentHeldOn = parseMeetingDate(pText);
      }
      continue;
    }

    // PDF リンクを抽出
    const pdfLinkRegex =
      /<a[^>]+class="[^"]*iconPdf[^"]*"[^>]+href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/gi;
    let pdfMatch: RegExpExecArray | null;

    while ((pdfMatch = pdfLinkRegex.exec(line)) !== null) {
      const href = pdfMatch[1]!;
      const linkText = pdfMatch[2]!.replace(/<[^>]+>/g, "").trim();

      // 目次 PDF はスキップ
      if (linkText.includes("目次")) continue;

      // 絶対 URL を構築
      let pdfUrl: string;
      if (href.startsWith("http")) {
        pdfUrl = href;
      } else if (href.startsWith("/")) {
        pdfUrl = `${BASE_ORIGIN}${href}`;
      } else {
        // 相対パス: file_contents/xxx.pdf
        pdfUrl = `${BASE_ORIGIN}/docs/${docId}/${href}`;
      }

      if (currentTitle) {
        results.push({
          title: currentTitle,
          heldOn: currentHeldOn ?? parseMeetingDateFromPdfLink(linkText, currentTitle),
          pdfUrl,
          meetingType: detectMeetingType(currentTitle),
        });
      }
    }
  }

  return results;
}

/**
 * 会議名テキストから開催日（YYYY-MM-DD）を推定する。
 *
 * 例:
 *   "令和7年第4回定例会(12月議会)" → "2025-12-01"（月のみ）
 *   "令和7年第5回臨時会(12月22日)" → "2025-12-22"（月日あり）
 *   "令和6年第4回定例会[12月議会]" → "2024-12-01"（角括弧形式）
 *
 * 解析できない場合は null を返す。
 */
export function parseMeetingDate(title: string): string | null {
  // 和暦年を解析
  const eraMatch = title.match(/(令和|平成)(元|\d+)年/);
  if (!eraMatch) return null;

  const era = eraMatch[1]!;
  const eraYearStr = eraMatch[2]!;
  const eraYear = eraYearStr === "元" ? 1 : parseInt(eraYearStr, 10);
  const year = era === "令和" ? eraYear + 2018 : eraYear + 1988;

  // 月日パターン（括弧・角括弧両方対応）
  // "臨時会(12月22日)" → 月=12, 日=22
  const dayMatch = title.match(/[(\[（【](\d+)月(\d+)日[)\]）】]/);
  if (dayMatch) {
    const month = parseInt(dayMatch[1]!, 10);
    const day = parseInt(dayMatch[2]!, 10);
    return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
  }

  // "定例会(12月議会)" → 月=12, 日=01（近似）
  const monthMatch = title.match(/[(\[（【](\d+)月/);
  if (monthMatch) {
    const month = parseInt(monthMatch[1]!, 10);
    return `${year}-${String(month).padStart(2, "0")}-01`;
  }

  return null;
}

/**
 * PDF リンクテキストから開催日を推定するフォールバック。
 *
 * 例: "第1号【12月1日】" から日付を取得
 */
export function parseMeetingDateFromPdfLink(
  linkText: string,
  meetingTitle: string,
): string | null {
  // 「第N号【M月D日】」パターン
  const dateMatch = linkText.match(/【(\d+)月(\d+)日】/);
  if (!dateMatch) return null;

  // 年は会議タイトルから
  const eraMatch = meetingTitle.match(/(令和|平成)(元|\d+)年/);
  if (!eraMatch) return null;

  const era = eraMatch[1]!;
  const eraYearStr = eraMatch[2]!;
  const eraYear = eraYearStr === "元" ? 1 : parseInt(eraYearStr, 10);
  const year = era === "令和" ? eraYear + 2018 : eraYear + 1988;
  const month = parseInt(dateMatch[1]!, 10);
  const day = parseInt(dateMatch[2]!, 10);

  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

/**
 * 指定年の全 PDF リンクを取得する。
 */
export async function fetchMeetingList(
  baseUrl: string,
  year: number,
): Promise<TamamuraMeeting[]> {
  // 既知の docId マッピングから年度別ページ URL を特定
  let docId = YEAR_DOC_IDS[year];

  if (!docId) {
    // トップページから動的に収集（フォールバック）
    const topHtml = await fetchPage(baseUrl);
    if (!topHtml) return [];

    await delay(INTER_PAGE_DELAY_MS);

    const yearPages = parseTopPage(topHtml);
    const targetPage = yearPages.find((p) => p.year === year);
    if (!targetPage) return [];

    docId = targetPage.docId;
  }

  const yearPageUrl = `${BASE_ORIGIN}/docs/${docId}/`;
  const yearHtml = await fetchPage(yearPageUrl);
  if (!yearHtml) return [];

  await delay(INTER_PAGE_DELAY_MS);

  return parseYearPage(yearHtml, docId);
}

/** detectMeetingType を再エクスポート */
export { detectMeetingType };
