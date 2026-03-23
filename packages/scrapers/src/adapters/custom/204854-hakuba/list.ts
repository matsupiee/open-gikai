/**
 * 白馬村議会 -- list フェーズ
 *
 * 会議録一覧ページ (1871.html) から全 PDF リンクを収集する。
 *
 * 一覧ページは単一ページ（ページネーションなし）で、
 * 全年度の会議録が1ページに掲載されている。
 *
 * 構造:
 *   <h2 class="head-title" id="h_idx_iw_flex_1_X">
 *     <span class="bg"><span class="bg2">令和7年（2025年）</span></span>
 *   </h2>
 *   <div class="wysiwyg">
 *     <table>
 *       <tr><td>定例会</td><td>臨時会</td></tr>
 *       <tr>
 *         <td><a href="//...pdf">第1回(PDFファイル:922.1KB)</a></td>
 *         <td><a href="//...pdf">第1回(PDFファイル:370.5KB)</a></td>
 *       </tr>
 *     </table>
 *   </div>
 *
 * テーブルの左列が定例会、右列が臨時会。
 * 臨時会がない行は &nbsp; が入る。
 * 開催日はページ上に掲載されていないため、PDF 本文から抽出する（detail フェーズで実施）。
 */

import { fetchPage, parseHeadingYear, toHalfWidth } from "./shared";

export interface HakubaPdfLink {
  /** 会議タイトル（例: "令和7年 第1回定例会"） */
  title: string;
  /** PDF の絶対 URL */
  pdfUrl: string;
  /** 会議種別 */
  meetingType: string;
  /** 年の見出しから取得した西暦年 */
  headingYear: number;
}

/**
 * プロトコル相対 URL を絶対 URL に変換する。
 * "//www.vill.hakuba.lg.jp/..." → "https://www.vill.hakuba.lg.jp/..."
 */
export function resolveUrl(href: string): string {
  if (href.startsWith("http")) return href;
  if (href.startsWith("//")) return `https:${href}`;
  return href;
}

/**
 * リンクテキストから回数を抽出する。
 * 「第1回(PDFファイル:922.1KB)」→ "第1回"
 */
export function extractSessionLabel(linkText: string): string | null {
  const normalized = toHalfWidth(linkText.trim());
  const match = normalized.match(/第(\d+)回/);
  if (!match) return null;
  return `第${match[1]}回`;
}

/**
 * 一覧ページ HTML から PDF リンクをパースする。
 *
 * h2.head-title の見出しから年度を取得し、
 * 後続の table 内の a[href] から PDF リンクを収集する。
 * テーブルの列位置（0=定例会, 1=臨時会）から会議種別を判定する。
 */
export function parseListPage(html: string): HakubaPdfLink[] {
  const results: HakubaPdfLink[] = [];

  // 全ての h2.head-title とその位置を取得
  const headingPattern =
    /<h2\s[^>]*class="[^"]*head-title[^"]*"[^>]*>([\s\S]*?)<\/h2>/gi;
  const headings: { year: number; yearText: string; position: number }[] = [];
  let hm: RegExpExecArray | null;
  while ((hm = headingPattern.exec(html)) !== null) {
    const innerText = hm[1]!.replace(/<[^>]+>/g, "").trim();
    const year = parseHeadingYear(innerText);
    if (year) {
      headings.push({ year, yearText: innerText.trim(), position: hm.index });
    }
  }

  // 全ての table を取得
  const tablePattern = /<table[^>]*>([\s\S]*?)<\/table>/gi;
  let tm: RegExpExecArray | null;
  while ((tm = tablePattern.exec(html)) !== null) {
    const tablePosition = tm.index;
    const tableContent = tm[1]!;

    // この table の直前の h2 見出しを見つける
    let currentHeading: { year: number; yearText: string } | null = null;
    for (const h of headings) {
      if (h.position < tablePosition) {
        currentHeading = h;
      }
    }
    if (!currentHeading) continue;

    // ヘッダー行から列の種別を判定
    // 最初の tr を取得
    const rowPattern = /<tr[^>]*>([\s\S]*?)<\/tr>/gi;
    const rows: string[] = [];
    let rm: RegExpExecArray | null;
    while ((rm = rowPattern.exec(tableContent)) !== null) {
      rows.push(rm[1]!);
    }
    if (rows.length < 2) continue;

    // ヘッダー行の td テキストから列種別を判定
    const headerRow = rows[0]!;
    const headerCellPattern = /<td[^>]*>([\s\S]*?)<\/td>/gi;
    const columnTypes: string[] = [];
    let hcm: RegExpExecArray | null;
    while ((hcm = headerCellPattern.exec(headerRow)) !== null) {
      const cellText = hcm[1]!.replace(/<[^>]+>/g, "").trim();
      if (cellText.includes("臨時会")) {
        columnTypes.push("extraordinary");
      } else if (cellText.includes("定例会")) {
        columnTypes.push("plenary");
      } else {
        columnTypes.push("plenary");
      }
    }

    // データ行を処理
    for (let i = 1; i < rows.length; i++) {
      const row = rows[i]!;
      const cellPattern = /<td[^>]*>([\s\S]*?)<\/td>/gi;
      let colIdx = 0;
      let cm: RegExpExecArray | null;
      while ((cm = cellPattern.exec(row)) !== null) {
        const cellContent = cm[1]!;

        // セル内の a タグを探す
        const linkMatch = cellContent.match(
          /<a\s[^>]*href="([^"]*)"[^>]*>([\s\S]*?)<\/a>/i,
        );
        if (linkMatch) {
          const href = linkMatch[1]!;
          const linkText = linkMatch[2]!.replace(/<[^>]+>/g, "").trim();

          if (href.toLowerCase().endsWith(".pdf")) {
            const pdfUrl = resolveUrl(href);
            const sessionLabel = extractSessionLabel(linkText);
            const meetingType = columnTypes[colIdx] ?? "plenary";
            const meetingTypeLabel =
              meetingType === "extraordinary" ? "臨時会" : "定例会";
            const title = sessionLabel
              ? `${sessionLabel}${meetingTypeLabel}`
              : meetingTypeLabel;

            results.push({
              title,
              pdfUrl,
              meetingType,
              headingYear: currentHeading.year,
            });
          }
        }

        colIdx++;
      }
    }
  }

  return results;
}

/**
 * 指定年の PDF リンクを収集する。
 *
 * baseUrl を取得し、全 PDF リンクをパースした後、
 * 対象年のものだけをフィルタリングして返す。
 */
export async function fetchDocumentList(
  baseUrl: string,
  year: number,
): Promise<HakubaPdfLink[]> {
  const html = await fetchPage(baseUrl);
  if (!html) return [];

  const allLinks = parseListPage(html);
  return allLinks.filter((link) => link.headingYear === year);
}
