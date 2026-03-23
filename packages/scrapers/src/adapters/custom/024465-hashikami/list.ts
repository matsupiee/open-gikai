/**
 * 階上町議会 — list フェーズ
 *
 * 単一ページに全会議録 PDF リンクが table 内に掲載されている。
 * テーブル行から会議名と PDF URL を抽出し、年度でフィルタリングする。
 */

import { BASE_ORIGIN, LIST_URL, fetchPage, parseEraYear } from "./shared";

export interface HashikamiMeeting {
  pdfUrl: string;
  title: string;
  year: number;
}

/**
 * 一覧ページの HTML をパースして会議録情報を抽出する（テスト可能な純粋関数）。
 *
 * 実際の構造:
 *   <table border="1">
 *     <tbody>
 *       <tr>
 *         <td style="text-align: center;">名称</td>
 *         <td style="text-align: center;">ファイル</td>
 *       </tr>
 *       <tr>
 *         <td><span style="font-size: 15.488px;">令和7年第7回階上町議会臨時会</span></td>
 *         <td><a href="/index.cfm/9,11528,c,html/11528/20260210-163525.pdf">...</a></td>
 *       </tr>
 *     </tbody>
 *   </table>
 *
 * - 1列目: 会議名（span 内、和暦 + 回次 + 種別）
 * - 2列目: PDF リンク
 * - 「発言訂正申出書」等はスキップ
 */
export function parseListPage(html: string): HashikamiMeeting[] {
  const results: HashikamiMeeting[] = [];

  // <tr> を抽出
  const trRegex = /<tr[^>]*>([\s\S]*?)<\/tr>/gi;

  for (const trMatch of html.matchAll(trRegex)) {
    const trContent = trMatch[1]!;

    // <td> を抽出
    const tdRegex = /<td[^>]*>([\s\S]*?)<\/td>/gi;
    const tds: string[] = [];
    for (const tdMatch of trContent.matchAll(tdRegex)) {
      tds.push(tdMatch[1]!);
    }

    if (tds.length < 2) continue;

    // 1列目: 会議名（タグを除去してテキストのみ）
    const title = tds[0]!.replace(/<[^>]+>/g, "").trim();

    // ヘッダー行をスキップ
    if (title === "名称") continue;

    // 「定例会」か「臨時会」を含まない行をスキップ
    if (!title.includes("定例会") && !title.includes("臨時会")) continue;

    // 補足資料（発言訂正申出書等）をスキップ
    if (title.includes("発言訂正申出書")) continue;

    // 2列目から PDF URL を抽出
    const linkMatch = tds[1]!.match(/<a[^>]+href="([^"]+\.pdf[^"]*)"/i);
    if (!linkMatch) continue;

    // URL をトリム（全角スペース等の除去）
    const rawHref = linkMatch[1]!.trim().replace(/[\s　]+$/, "");

    // 完全 URL を構築
    const pdfUrl = rawHref.startsWith("http")
      ? rawHref
      : `${BASE_ORIGIN}${rawHref.startsWith("/") ? "" : "/"}${rawHref}`;

    // 和暦から西暦年を取得
    const year = parseEraYear(title);
    if (!year) continue;

    results.push({ pdfUrl, title, year });
  }

  return results;
}

/**
 * 指定年の会議録一覧を取得する。
 */
export async function fetchMeetingList(
  _baseUrl: string,
  year: number
): Promise<HashikamiMeeting[]> {
  // DB の baseUrl はカンマ入り ColdFusion URL が正しく保存されない場合があるため、
  // 固定の LIST_URL を使用する
  const html = await fetchPage(LIST_URL);
  if (!html) return [];

  const all = parseListPage(html);

  // 指定年でフィルタ
  return all.filter((m) => m.year === year);
}
