/**
 * 山梨県南部町議会 -- list フェーズ
 *
 * 会議録一覧ページ (kaigiroku.html) は単一ページで
 * ページネーションなし。全 PDF リンクが 1 ページに掲載されている。
 *
 * 各 PDF リンクは h2 で示された年度（例: 令和７年(2025年)）に属し、
 * リンクテキストに会議種別（定例会・臨時会）が記載されている。
 *
 * DOM 構造:
 *   <h2>令和７年(2025年)</h2>
 *   <table>
 *     <tr>
 *       <td><a href="files/Gikai-TeireiRec202512re.pdf">第４回定例会(12月）</a></td>
 *     </tr>
 *   </table>
 */

import {
  BASE_ORIGIN,
  LIST_PATH,
  detectMeetingType,
  parseWarekiYear,
  fetchPage,
} from "./shared";

export interface NanbuYamanashiSessionInfo {
  /** 会議タイトル（例: "令和６年第４回定例会(12月）"） */
  title: string;
  /** 西暦年 */
  year: number;
  /** PDF の絶対 URL */
  pdfUrl: string;
  /** 会議種別 */
  meetingType: string;
}

const LIST_URL = `${BASE_ORIGIN}${LIST_PATH}`;

/**
 * 指定年度の全セッションを収集する。
 * 一覧ページからすべての PDF リンクを取得し、対象年度に絞り込む。
 */
export async function fetchSessionList(
  _baseUrl: string,
  year: number,
): Promise<NanbuYamanashiSessionInfo[]> {
  const html = await fetchPage(LIST_URL);
  if (!html) return [];

  const allRecords = parseListPage(html);

  return allRecords.filter((r) => r.year === year);
}

/**
 * 一覧ページ HTML から全 PDF リンクとメタ情報を抽出する（純粋関数）。
 *
 * h2 要素から年度を取得し、後続のテーブル内の PDF リンクに年度を付与する。
 * DOM の正規表現パースで処理する。
 */
export function parseListPage(html: string): NanbuYamanashiSessionInfo[] {
  const records: NanbuYamanashiSessionInfo[] = [];

  // h2 タグの位置と年度情報を収集する
  const h2Pattern = /<h2[^>]*>([\s\S]*?)<\/h2>/gi;
  const headings: { year: number; eraYear: string; position: number }[] = [];
  let hm: RegExpExecArray | null;

  while ((hm = h2Pattern.exec(html)) !== null) {
    const innerText = hm[1]!.replace(/<[^>]+>/g, "").trim();
    const year = parseWarekiYear(innerText);
    if (!year) continue;

    // 和暦表記を抽出（例: "令和６年"）- 全角数字も含む
    const eraMatch = innerText.match(/(令和|平成)([０-９\d]+|元)年/);
    const eraYear = eraMatch ? eraMatch[0] : `${year}年`;

    headings.push({ year, eraYear, position: hm.index });
  }

  if (headings.length === 0) return records;

  // files/*.pdf へのリンクを抽出
  const linkPattern =
    /<a\s[^>]*href="([^"]*files\/[^"]+\.pdf)"[^>]*>([\s\S]*?)<\/a>/gi;
  let am: RegExpExecArray | null;

  while ((am = linkPattern.exec(html)) !== null) {
    const href = am[1]!;
    const linkText = am[2]!.replace(/<[^>]+>/g, "").trim();
    if (!linkText) continue;

    const linkPosition = am.index;

    // リンクの直前にある最後の h2 見出しを特定する
    let currentYear: number | null = null;
    let currentEraYear: string | null = null;
    for (const h of headings) {
      if (h.position < linkPosition) {
        currentYear = h.year;
        currentEraYear = h.eraYear;
      }
    }
    if (!currentYear || !currentEraYear) continue;

    // PDF の絶対 URL を組み立てる
    let pdfUrl: string;
    if (href.startsWith("http")) {
      pdfUrl = href;
    } else if (href.startsWith("/")) {
      pdfUrl = `${BASE_ORIGIN}${href}`;
    } else {
      // 相対パス（例: "files/xxx.pdf"）→ /kakuka/gikai/ 配下
      pdfUrl = `${BASE_ORIGIN}/kakuka/gikai/${href}`;
    }

    const meetingType = detectMeetingType(linkText);
    const title = `${currentEraYear}${linkText}`;

    records.push({ title, year: currentYear, pdfUrl, meetingType });
  }

  return records;
}
