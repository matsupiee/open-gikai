/**
 * 新居浜市議会 会議録 — list フェーズ
 *
 * 年度別一覧ページから各会議録のリンクを収集する。
 *
 * 一覧ページの構造:
 *   <h3>令和７年第１回定例会</h3>
 *   <table>
 *     <tr>
 *       <td><p><a href="/site/gikai/kaigiroku2025-1-1.html">第１号（２月25日）</a></p></td>
 *       <td>　議案上程、説明、質疑、委員会付託</td>
 *     </tr>
 *   </table>
 */

import { buildListUrl, fetchPage } from "./shared";

export interface NiihamaDocument {
  /** 年 */
  year: number;
  /** 回次（第N回） */
  session: number;
  /** 号数（第N号） */
  number: number;
  /** 会議タイトル（h3 から抽出: 例 "令和７年第１回定例会"） */
  sessionTitle: string;
  /** 開催日 YYYY-MM-DD */
  heldOn: string;
  /** 詳細ページの相対パス */
  path: string;
}

/**
 * 一覧ページ HTML からドキュメント一覧をパースする。
 */
export function parseListPage(html: string, _year: number): NiihamaDocument[] {
  const documents: NiihamaDocument[] = [];

  // h3 ごとにセクションを分割して処理
  // h3 テキスト例: "令和７年第１回定例会", "令和７年第２回臨時会"
  const h3Regex = /<h3[^>]*>(.*?)<\/h3>/gi;
  const h3Matches = [...html.matchAll(h3Regex)];

  for (let i = 0; i < h3Matches.length; i++) {
    const h3Match = h3Matches[i]!;
    const sessionTitle = h3Match[1]!.replace(/<[^>]+>/g, "").trim();

    // このh3からの次のh3までのHTML区間を取得
    const startIdx = h3Match.index! + h3Match[0].length;
    const endIdx = i + 1 < h3Matches.length ? h3Matches[i + 1]!.index! : html.length;
    const sectionHtml = html.slice(startIdx, endIdx);

    // セクション内のリンクを抽出
    const linkRegex =
      /<a\s+href="(\/site\/gikai\/kaigiroku(\d{4})-(\d+)-(\d+)\.html)"[^>]*>([^<]+)<\/a>/gi;

    for (const linkMatch of sectionHtml.matchAll(linkRegex)) {
      const path = linkMatch[1]!;
      const linkYear = parseInt(linkMatch[2]!, 10);
      const session = parseInt(linkMatch[3]!, 10);
      const number = parseInt(linkMatch[4]!, 10);
      const linkText = linkMatch[5]!;

      // リンクテキストから日付を抽出: "第１号（２月25日）" or "第１号（９月２日）"
      // 全角数字を半角に変換してからパース
      const normalizedText = linkText.replace(/[０-９]/g, (c) =>
        String.fromCharCode(c.charCodeAt(0) - 0xfee0),
      );
      const dateMatch = normalizedText.match(/（(\d+)月(\d+)日）/);
      let heldOn = "";
      if (dateMatch) {
        const month = parseInt(dateMatch[1]!, 10);
        const day = parseInt(dateMatch[2]!, 10);
        heldOn = `${linkYear}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
      }

      documents.push({
        year: linkYear,
        session,
        number,
        sessionTitle,
        heldOn,
        path,
      });
    }
  }

  return documents;
}

/**
 * 指定年の全会議録ドキュメント一覧を取得する。
 */
export async function fetchDocumentList(year: number): Promise<NiihamaDocument[]> {
  const url = buildListUrl(year);
  const html = await fetchPage(url);
  if (!html) return [];

  return parseListPage(html, year);
}
