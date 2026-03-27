/**
 * 鬼北町議会 会議録 — list フェーズ
 *
 * 年度一覧ページ → 年度別インデックスページ → PDF リンクを収集する。
 */

import { BASE_ORIGIN, INDEX_URL, fetchPage, parseJapaneseDate } from "./shared";

export interface KihokuPdfRecord {
  /** PDF の絶対 URL */
  pdfUrl: string;
  /** リンクテキスト（元のまま） */
  linkText: string;
  /** 開催日 YYYY-MM-DD。解析不能な場合は null */
  heldOn: string | null;
  /** 会議種別: 定例会 or 臨時会 */
  meetingKind: "定例会" | "臨時会";
  /** 回次（例: 1） */
  sessionNumber: number | null;
}

/**
 * 年度一覧ページ HTML から年度別インデックスページの URL を抽出する。
 * `/site/gikai/{数値}.html` パターンのみ対象。
 */
export function parseIndexUrls(html: string): string[] {
  const urls: string[] = [];
  // href="/site/gikai/{数値}.html" のパターンを抽出
  const linkRegex = /href="(\/site\/gikai\/(\d+)\.html)"/g;
  for (const match of html.matchAll(linkRegex)) {
    const path = match[1];
    if (!path) continue;
    const url = `${BASE_ORIGIN}${path}`;
    if (!urls.includes(url)) {
      urls.push(url);
    }
  }
  return urls;
}

/**
 * 年度別インデックスページ HTML から PDF レコードを抽出する。
 *
 * `<h3>定例会</h3>` / `<h3>臨時会</h3>` でセクションを分け、
 * 各セクション内の `/uploaded/life/...misc.pdf` リンクを収集する。
 *
 * 実際のリンクテキスト例:
 *   「第1回鬼北町議会定例会（1日目・3月7日開催）」
 * 年号が含まれないため、year パラメータから西暦年を補う。
 */
export function parseYearIndexPage(
  html: string,
  year?: number
): KihokuPdfRecord[] {
  const records: KihokuPdfRecord[] = [];

  // h3 タグで区切って各セクションを処理する
  const sectionRegex = /<h3[^>]*>([\s\S]*?)<\/h3>([\s\S]*?)(?=<h3|$)/gi;
  // 実際の形式: 第N回鬼北町議会定例会（N日目・N月N日開催）
  // 年号なしの形式と年号ありの形式の両方に対応する
  const titlePatternWithYear =
    /第(\d+)回鬼北町議会(定例会|臨時会)（(令和|平成)(\d+)年(\d+)月(\d+)日開催）/;
  const titlePatternNoYear =
    /第(\d+)回鬼北町議会(定例会|臨時会)（.+?・(\d+)月(\d+)日開催）/;
  const pdfPattern = /^\/uploaded\/life\/.+_misc\.pdf$/;

  for (const sectionMatch of html.matchAll(sectionRegex)) {
    const h3Text = sectionMatch[1]?.replace(/<[^>]+>/g, "").trim() ?? "";
    const sectionHtml = sectionMatch[2] ?? "";

    // セクションの会議種別を判定
    let meetingKind: "定例会" | "臨時会" | null = null;
    if (h3Text.includes("定例会")) meetingKind = "定例会";
    else if (h3Text.includes("臨時会")) meetingKind = "臨時会";
    if (!meetingKind) continue;

    // PDF リンクを抽出
    const linkRegex = /href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/gi;
    for (const linkMatch of sectionHtml.matchAll(linkRegex)) {
      const href = linkMatch[1]?.trim() ?? "";
      const rawText = (linkMatch[2] ?? "")
        .replace(/<[^>]+>/g, "")
        .replace(/\s+/g, " ")
        .trim();

      if (!pdfPattern.test(href)) continue;

      const pdfUrl = `${BASE_ORIGIN}${href}`;

      // リンクテキストから開催日と回次を抽出
      let heldOn: string | null = null;
      let sessionNumber: number | null = null;

      // まず年号あり形式を試みる
      const matchWithYear = rawText.match(titlePatternWithYear);
      if (matchWithYear) {
        sessionNumber = parseInt(matchWithYear[1]!, 10);
        const dateText = `${matchWithYear[3]}${matchWithYear[4]}年${matchWithYear[5]}月${matchWithYear[6]}日`;
        heldOn = parseJapaneseDate(dateText);
      } else {
        // 年号なし形式（実際のページ）: year パラメータから補う
        const matchNoYear = rawText.match(titlePatternNoYear);
        if (matchNoYear) {
          sessionNumber = parseInt(matchNoYear[1]!, 10);
          if (year != null) {
            const month = parseInt(matchNoYear[3]!, 10);
            const day = parseInt(matchNoYear[4]!, 10);
            const mm = String(month).padStart(2, "0");
            const dd = String(day).padStart(2, "0");
            heldOn = `${year}-${mm}-${dd}`;
          }
        }
      }

      records.push({
        pdfUrl,
        linkText: rawText,
        heldOn,
        meetingKind,
        sessionNumber,
      });
    }
  }

  return records;
}

/**
 * 指定年の PDF レコード一覧を取得する。
 *
 * 1. 年度一覧ページから年度別インデックス URL を収集
 * 2. 各年度インデックスページを取得して PDF レコードを収集
 * 3. heldOn が year に一致するレコードのみ返す
 */
export async function fetchPdfList(year: number): Promise<KihokuPdfRecord[]> {
  const indexHtml = await fetchPage(INDEX_URL);
  if (!indexHtml) return [];

  const yearIndexUrls = parseIndexUrls(indexHtml);

  const allRecords: KihokuPdfRecord[] = [];

  for (const url of yearIndexUrls) {
    const html = await fetchPage(url);
    if (!html) continue;

    const records = parseYearIndexPage(html, year);
    for (const record of records) {
      allRecords.push(record);
    }
  }

  // heldOn から year を絞り込む
  return allRecords.filter((r) => {
    if (!r.heldOn) return false;
    return r.heldOn.startsWith(`${year}-`);
  });
}
