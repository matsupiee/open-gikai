/**
 * あわら市議会 — list フェーズ
 *
 * 年度別ページから PDF リンクと会議メタ情報を収集する。
 *
 * 各年度ページのテーブルには以下の構造でデータが並ぶ:
 *   行1: 回次（第N回）
 *   行2: PDF リンク（N月定例会 / N月臨時会）
 *
 * PDF リンクは相対パスで記載されるため、ページ URL から絶対 URL を構築する。
 */

import {
  BASE_ORIGIN,
  YEAR_PAGE_MAP,
  buildHeldOn,
  buildPdfBaseUrl,
  detectMeetingType,
  fetchPage,
} from "./shared";

export interface AwaraMeeting {
  /** 会議タイトル（例: "第120回 3月定例会"） */
  title: string;
  /** PDF の絶対 URL */
  pdfUrl: string;
  /** 会議種別 */
  meetingType: string;
  /** 開催日（YYYY-MM-DD 形式、日は月初固定） */
  heldOn: string;
  /** 年度ページパス（externalId 用） */
  pagePath: string;
}

/**
 * 年度別ページの HTML から PDF リンクとメタ情報を抽出する（テスト可能な純粋関数）。
 *
 * テーブルは2行構成:
 *   行1の各 <td>: 回次（第N回）
 *   行2の各 <td>: PDF リンク（N月定例会 / N月臨時会）
 *
 * 列インデックスで回次と PDF リンクを対応付ける。
 */
export function parseYearPage(
  html: string,
  pagePath: string,
  year: number,
): AwaraMeeting[] {
  const results: AwaraMeeting[] = [];
  const pdfBaseUrl = buildPdfBaseUrl(pagePath);

  // テーブルの各行から <td> の内容を抽出
  const trPattern = /<tr[^>]*>([\s\S]*?)<\/tr>/gi;
  const tdPattern = /<td[^>]*>([\s\S]*?)<\/td>/gi;

  const rows: string[][] = [];
  for (const trMatch of html.matchAll(trPattern)) {
    const cells: string[] = [];
    for (const tdMatch of trMatch[1]!.matchAll(tdPattern)) {
      cells.push(tdMatch[1]!);
    }
    if (cells.length > 0) {
      rows.push(cells);
    }
  }

  // 回次行と PDF リンク行を特定
  // 回次行: 「第N回」を含む行
  // PDF リンク行: PDF リンクを含む行
  const sessionRow = rows.find((row) =>
    row.some((cell) => /第\d+回/.test(cell)),
  );
  const pdfRow = rows.find((row) =>
    row.some((cell) => /\.pdf/i.test(cell)),
  );

  if (pdfRow) {
    // 回次情報を列インデックスで取得
    const sessionNums: (string | null)[] = [];
    if (sessionRow) {
      for (const cell of sessionRow) {
        const m = cell.match(/第(\d+)回/);
        sessionNums.push(m?.[1] ?? null);
      }
    }

    // PDF リンク行の各セルからリンクを抽出
    const linkPattern = /<a[^>]+href="([^"]*\.pdf)"[^>]*>([^<]*)<\/a>/i;

    for (let i = 0; i < pdfRow.length; i++) {
      const cell = pdfRow[i]!;
      const linkMatch = cell.match(linkPattern);
      if (!linkMatch) continue;

      const href = linkMatch[1]!;
      const linkText = linkMatch[2]!.trim();

      // 空テキストや非会議録リンクをスキップ
      if (!linkText) continue;
      if (!linkText.includes("定例会") && !linkText.includes("臨時会"))
        continue;

      // PDF URL を構築
      const pdfUrl = resolvePdfUrl(href, pdfBaseUrl);

      const sessionNum = sessionNums[i] ?? null;
      const meetingType = detectMeetingType(linkText);
      const title = sessionNum ? `第${sessionNum}回 ${linkText}` : linkText;
      const heldOn = buildHeldOn(linkText, year);

      results.push({
        title,
        pdfUrl,
        meetingType,
        heldOn,
        pagePath,
      });
    }
  }

  // テーブル外の PDF リンクもフォールバックで収集
  // （テーブル構造でない場合や関連ファイルセクションの重複を除く）
  if (results.length === 0) {
    const globalLinkPattern =
      /<a[^>]+href="([^"]*\.pdf)"[^>]*>([^<]*)<\/a>/gi;

    for (const match of html.matchAll(globalLinkPattern)) {
      const href = match[1]!;
      const linkText = match[2]!.trim();

      if (!linkText) continue;
      if (!linkText.includes("定例会") && !linkText.includes("臨時会"))
        continue;

      const pdfUrl = resolvePdfUrl(href, pdfBaseUrl);

      // 重複チェック
      if (results.some((r) => r.pdfUrl === pdfUrl)) continue;

      results.push({
        title: linkText,
        pdfUrl,
        meetingType: detectMeetingType(linkText),
        heldOn: buildHeldOn(linkText, year),
        pagePath,
      });
    }
  }

  return results;
}

/** 相対パスの PDF href を絶対 URL に変換する */
function resolvePdfUrl(href: string, pdfBaseUrl: string): string {
  if (href.startsWith("http")) {
    return href;
  }
  if (href.startsWith("/")) {
    return `${BASE_ORIGIN}${href}`;
  }
  // 相対パス: ./pageId_d/fil/filename.pdf or pageId_d/fil/filename.pdf
  const fileName = href.split("/").pop()!;
  return `${pdfBaseUrl}${fileName}`;
}

/**
 * 指定年度の全 PDF リンクを取得する。
 */
export async function fetchMeetingList(
  year: number,
): Promise<AwaraMeeting[]> {
  const pagePath = YEAR_PAGE_MAP[year];
  if (!pagePath) return [];

  const url = `${BASE_ORIGIN}${pagePath}`;
  const html = await fetchPage(url);
  if (!html) return [];

  return parseYearPage(html, pagePath, year);
}
