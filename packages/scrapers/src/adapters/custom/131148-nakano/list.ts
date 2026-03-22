/**
 * 中野区議会 議事録検索システム — list フェーズ
 *
 * search.html に GET リクエストを送り、gijiroku_id ベースの会議一覧を取得する。
 *
 * HTML 構造:
 *   <tr class="td2" id="tr{gijiroku_id}" ...>
 *     <td ...><a href="view.html?gijiroku_id={id}...">タイトル</a></td>
 *     <td ...>令和7年12月10日</td>
 *     <td ...>-</td>
 *   </tr>
 *
 * ページネーション: 20件/ページ、page= パラメータで制御
 */

import { buildListUrl, fetchPage, parseJapaneseDate } from "./shared";

export interface NakanoDocument {
  /** 議事録 ID（gijiroku_id パラメータ） */
  gijirokuId: string;
  /** 会議タイトル */
  title: string;
  /** 開催日 YYYY-MM-DD */
  heldOn: string;
}

/**
 * 検索結果 HTML から会議ドキュメント一覧をパースする。
 */
export function parseListPage(html: string): NakanoDocument[] {
  const documents: NakanoDocument[] = [];
  const seen = new Set<string>();

  // id="tr{gijiroku_id}" の行を検出
  const rowPattern = /id="tr(\d+)"/g;

  for (const rowMatch of html.matchAll(rowPattern)) {
    const gijirokuId = rowMatch[1]!;
    if (seen.has(gijirokuId)) continue;
    seen.add(gijirokuId);

    // この行の周辺 HTML からタイトルと日付を抽出
    const rowStart = rowMatch.index!;
    const rowEnd = html.indexOf("</tr>", rowStart);
    if (rowEnd < 0) continue;

    const rowHtml = html.substring(rowStart, rowEnd);

    // タイトル: <a href="...view.html?gijiroku_id=...">タイトル</a>
    const titleMatch = rowHtml.match(
      /view\.html\?gijiroku_id=\d+[^>]*>([^<]+)<\/a>/i
    );
    if (!titleMatch) continue;

    const title = titleMatch[1]!.trim();

    // 日付: 2番目の <td> 内のテキスト
    const tdPattern = /<td[^>]*>([\s\S]*?)<\/td>/gi;
    let tdIndex = 0;
    let dateLabel = "";

    for (const tdMatch of rowHtml.matchAll(tdPattern)) {
      tdIndex++;
      if (tdIndex === 2) {
        dateLabel = tdMatch[1]!.replace(/<[^>]+>/g, "").trim();
        break;
      }
    }

    // 日付を YYYY-MM-DD に変換（dateLabel またはタイトルから）
    const heldOn = parseJapaneseDate(dateLabel) ?? parseJapaneseDate(title) ?? "";
    if (!heldOn) continue;

    documents.push({ gijirokuId, title, heldOn });
  }

  return documents;
}

/**
 * 指定年の全ページからドキュメント一覧を取得する。
 */
export async function fetchDocumentList(
  year: number,
): Promise<NakanoDocument[]> {
  const allDocuments: NakanoDocument[] = [];
  let page = 1;

  while (true) {
    const url = buildListUrl(year, page);
    const html = await fetchPage(url);
    if (!html) break;

    const documents = parseListPage(html);
    if (documents.length === 0) break;

    for (const doc of documents) {
      if (!allDocuments.some((d) => d.gijirokuId === doc.gijirokuId)) {
        allDocuments.push(doc);
      }
    }

    // 次のページがあるか確認
    if (!html.includes(`page=${page + 1}`)) break;
    page++;
  }

  return allDocuments;
}
