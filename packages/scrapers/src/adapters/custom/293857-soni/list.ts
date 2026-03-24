/**
 * 曽爾村議会 -- list フェーズ
 *
 * 単一ページから PDF リンクを収集する:
 * 1. 一覧ページ (https://www.vill.soni.nara.jp/info/632) から <a href="...pdf"> タグを全件取得
 * 2. リンクテキストに「会議録」を含むものを選別し「議決結果」を除外する
 * 3. <h2> タグから年度を取得し、テーブル行から会議名を取得してメタ情報を付与する
 * 4. href は相対パス。BASE_ORIGIN を補完する
 *
 * 実際の HTML 構造:
 *   <h2>■　令和７年</h2>
 *   <h3>
 *     <table>
 *       <tr>
 *         <td>令和７年第４回（１２月）定例会</td>
 *         <td><a href="/div/gikai/pdf/HP/7_12giketu.pdf">議決結果</a></td>
 *       </tr>
 *       <tr>
 *         <td>令和７年第４回（１２月）定例会</td>
 *         <td><a href="/div/gikai/pdf/HP/7_12kaigiroku1.pdf">会議録➀</a></td>
 *       </tr>
 *       ...
 *     </table>
 *   </h3>
 *
 * 一覧ページ: https://www.vill.soni.nara.jp/info/632
 */

import {
  BASE_ORIGIN,
  LIST_PATH,
  eraToWesternYear,
  fetchPage,
  normalizeDigits,
} from "./shared";

export interface SoniMeeting {
  pdfUrl: string;
  /** リンクテキスト（「会議録」「会議録➀」「会議録➁」等） */
  linkText: string;
  /** 会議名（「令和7年第4回（12月）定例会」等）。HTML から抽出 */
  sessionName: string;
  /** 年度（西暦）。sessionName から抽出 */
  year: number;
  /** YYYY-MM-DD (PDF から抽出するため list 段階では null の場合あり) */
  heldOn: string | null;
}

/**
 * テーブル行（<tr>）から [sessionName, pdfUrl, linkText] を抽出する。
 * 各行の構造: <td>会議名</td><td><a href="...pdf">リンクテキスト</a></td>
 */
function parseTableRow(
  trHtml: string
): { sessionName: string; pdfUrl: string; linkText: string } | null {
  // セルを抽出
  const cells = [...trHtml.matchAll(/<td[^>]*>([\s\S]*?)<\/td>/gi)];
  if (cells.length < 2) return null;

  const sessionNameRaw = cells[0]![1]!.replace(/<[^>]+>/g, "").trim();
  const cellContent = cells[1]![1]!;

  // PDF リンクを探す
  const linkMatch = cellContent.match(/<a[^>]+href="([^"]+\.pdf)"[^>]*>([\s\S]*?)<\/a>/i);
  if (!linkMatch) return null;

  const rawHref = linkMatch[1]!;
  const rawLinkText = linkMatch[2]!.replace(/<[^>]+>/g, "").trim();

  // URL の組み立て
  const pdfUrl = rawHref.startsWith("/")
    ? `${BASE_ORIGIN}${rawHref}`
    : rawHref.startsWith("//")
      ? `https:${rawHref}`
      : rawHref;

  const sessionName = normalizeDigits(sessionNameRaw);

  return { sessionName, pdfUrl, linkText: rawLinkText };
}

/**
 * 一覧ページの HTML から会議録 PDF リンクを抽出する（テスト可能な純粋関数）。
 *
 * 構造:
 * - <h2> タグが年度ラベル（「■　令和７年」等）
 * - <h3> タグ内のテーブルに会議行が並ぶ
 * - 各行の第1列が会議名、第2列が PDF リンク
 * - リンクテキストが「議決結果」の行は除外
 * - リンクテキストに「会議録」を含む行のみ対象
 */
export function parseListPage(html: string): SoniMeeting[] {
  const results: SoniMeeting[] = [];

  // h2 タグで年度セクションを分割する
  const h2Positions: Array<{ index: number; endIndex: number; text: string }> = [];
  for (const m of html.matchAll(/<h2[^>]*>([\s\S]*?)<\/h2>/gi)) {
    const rawText = m[1]!.replace(/<[^>]+>/g, "").trim();
    if (/(令和|平成|昭和)/.test(rawText)) {
      h2Positions.push({
        index: m.index!,
        endIndex: m.index! + m[0].length,
        text: rawText,
      });
    }
  }

  // h2 が見つからない場合は全体を 1 セクションとして処理
  const sections: Array<{ yearText: string; content: string }> =
    h2Positions.length > 0
      ? h2Positions.map((current, i) => {
          const next = h2Positions[i + 1];
          const contentEnd = next ? next.index : html.length;
          return {
            yearText: current.text,
            content: html.slice(current.endIndex, contentEnd),
          };
        })
      : [{ yearText: "", content: html }];

  for (const section of sections) {
    const sectionYear = eraToWesternYear(normalizeDigits(section.yearText));

    // テーブル行（<tr>）を抽出して処理する
    for (const trMatch of section.content.matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/gi)) {
      const trHtml = trMatch[1]!;
      const row = parseTableRow(trHtml);
      if (!row) continue;

      const { sessionName, pdfUrl, linkText } = row;

      // 議決結果は除外
      if (linkText.includes("議決結果")) continue;

      // 会議録のみ対象
      if (!linkText.includes("会議録")) continue;

      // 年度の特定: 会議名から取得、フォールバックとしてセクション年度
      const yearFromSession = sessionName
        ? eraToWesternYear(normalizeDigits(sessionName))
        : null;
      const year = yearFromSession ?? sectionYear;

      if (year === null) continue;

      results.push({
        pdfUrl,
        linkText,
        sessionName,
        year,
        heldOn: null,
      });
    }
  }

  return results;
}

/**
 * 指定年の会議録 PDF リンク一覧を取得する。
 * 一覧ページは単一ページ（ページネーションなし）で全件掲載されている。
 * heldOn は PDF 本文から抽出するため、ここでは null のまま返す。
 */
export async function fetchDocumentList(
  _baseUrl: string,
  year: number
): Promise<SoniMeeting[]> {
  const listUrl = `${BASE_ORIGIN}${LIST_PATH}`;
  const html = await fetchPage(listUrl);
  if (!html) return [];

  const all = parseListPage(html);

  // 年度フィルタリング
  return all.filter((m) => m.year === year);
}
