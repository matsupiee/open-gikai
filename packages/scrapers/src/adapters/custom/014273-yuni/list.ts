/**
 * 由仁町議会 — list フェーズ
 *
 * 定例会ページ・臨時会ページから会議録 PDF のリンクを収集する。
 *
 * - 定例会: https://www.town.yuni.lg.jp/chosei/gikai/teireikai
 * - 臨時会: https://www.town.yuni.lg.jp/chosei/gikai/rinjikai
 *
 * 各ページの HTML を取得し、wp-content/uploads/ を含む PDF リンクを抽出する。
 * 会議結果 PDF（「議決結果」を含むリンクテキスト）は除外する。
 */

import {
  BASE_ORIGIN,
  TEIREIKAI_URL,
  RINJIKAI_URL,
  detectMeetingType,
  fetchPage,
  parseDateString,
  toHalfWidth,
  eraToWestern,
} from "./shared";

export interface YuniMinutesLink {
  /** PDF の絶対 URL */
  pdfUrl: string;
  /** リンクテキスト（例: "R07_1定_01.pdf"） */
  linkText: string;
  /** 会議種別 */
  meetingType: string;
  /** ページ種別 */
  pageType: "teireikai" | "rinjikai";
}

/**
 * HTML から会議録 PDF リンクを抽出する。
 * 「議決結果」を含むリンクは除外する。
 */
export function parseListPage(
  html: string,
  pageType: "teireikai" | "rinjikai",
): YuniMinutesLink[] {
  const links: YuniMinutesLink[] = [];

  // <a> タグを抽出
  const aPattern = /<a\s[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi;

  for (const aMatch of html.matchAll(aPattern)) {
    const href = aMatch[1]!.trim();
    const rawText = aMatch[2]!
      .replace(/<[^>]+>/g, "")
      .replace(/\s+/g, " ")
      .trim();

    if (!href || !rawText) continue;

    // wp-content/uploads/ を含む PDF リンクのみ対象
    if (!href.includes("wp-content/uploads/") || !href.endsWith(".pdf")) {
      continue;
    }

    // 「議決結果」を含むリンクは除外（会議結果 PDF）
    if (rawText.includes("議決結果")) {
      continue;
    }

    // 絶対 URL に変換
    const pdfUrl = href.startsWith("http") ? href : `${BASE_ORIGIN}${href}`;

    // 臨時会ページにあるリンクか、リンクテキストに「臨」が含まれるかで判定
    const title = pageType === "rinjikai" ? "臨時会" : rawText;
    const meetingType = detectMeetingType(title);

    links.push({
      pdfUrl,
      linkText: rawText,
      meetingType,
      pageType,
    });
  }

  return links;
}

/**
 * PDF URL から西暦年を推定する。
 * URL パターン: /wp-content/uploads/{年}/{月}/{ファイル名}.pdf
 */
export function extractYearFromUrl(url: string): number | null {
  const match = url.match(/\/wp-content\/uploads\/(\d{4})\//);
  if (!match) return null;
  return parseInt(match[1]!, 10);
}

/**
 * ファイル名から令和年度を推定する。
 * パターン: R{年度}_{回数}{定|臨}_{日数}.pdf
 */
export function extractYearFromFilename(filename: string): number | null {
  // 全角→半角変換
  const normalized = toHalfWidth(filename);
  // R07_1定_01 形式
  const match = normalized.match(/^R(\d+)_/);
  if (!match) return null;
  const reiwa = parseInt(match[1]!, 10);
  return eraToWestern("令和", String(reiwa));
}

/**
 * 定例会・臨時会の両ページから指定年の会議録 PDF リンクを取得する。
 */
export async function fetchMinutesLinks(
  year: number,
): Promise<YuniMinutesLink[]> {
  const [teireikaiHtml, rinjikaiHtml] = await Promise.all([
    fetchPage(TEIREIKAI_URL),
    fetchPage(RINJIKAI_URL),
  ]);

  const allLinks: YuniMinutesLink[] = [];

  if (teireikaiHtml) {
    allLinks.push(...parseListPage(teireikaiHtml, "teireikai"));
  }
  if (rinjikaiHtml) {
    allLinks.push(...parseListPage(rinjikaiHtml, "rinjikai"));
  }

  // 指定年でフィルタリング（URL の年 or ファイル名の年で判定）
  return allLinks.filter((link) => {
    const urlYear = extractYearFromUrl(link.pdfUrl);
    if (urlYear !== null) {
      return urlYear === year;
    }
    // URL から年が取れない場合はファイル名から推定
    const filename = link.pdfUrl.split("/").pop() ?? "";
    const filenameYear = extractYearFromFilename(filename);
    return filenameYear === year;
  });
}

export { parseDateString };
