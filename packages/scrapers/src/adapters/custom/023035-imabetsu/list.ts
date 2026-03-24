/**
 * 今別町議会 — list フェーズ
 *
 * dayori.html から全議会だより PDF のリンクを収集する。
 */

import { LIST_URL, BASE_URL, fetchPage, parseDateText } from "./shared";

export interface ImabetsuDocument {
  /** 号数（例: "222号"） */
  issue: string;
  /** 発行日 YYYY-MM-DD（解析できない場合は null） */
  heldOn: string | null;
  /** PDF の完全 URL */
  pdfUrl: string;
  /** 発行年（h2 見出しテキスト） */
  year: string;
}

/**
 * dayori.html の HTML から議会だより一覧をパースする。
 *
 * - h2 タグで年を区切る
 * - 各 td 内の PDF リンクから号数・発行日・URL を抽出
 * - PDF リンクがない td（空セル）はスキップ
 */
export function parseListPage(html: string): ImabetsuDocument[] {
  const documents: ImabetsuDocument[] = [];

  // h2 と table のペアを抽出するために、h2 タグを手がかりにブロック分割する
  // パターン: <h2>2025年</h2> の後に <table>...</table> が続く
  const blockRegex = /<h2[^>]*>([\s\S]*?)<\/h2>\s*(<table[\s\S]*?<\/table>)/gi;

  for (const blockMatch of html.matchAll(blockRegex)) {
    const yearText = blockMatch[1]?.replace(/<[^>]+>/g, "").trim() ?? "";
    const tableHtml = blockMatch[2] ?? "";

    if (!yearText) continue;

    // td 要素を取得
    const tdRegex = /<td[^>]*>([\s\S]*?)<\/td>/gi;

    for (const tdMatch of tableHtml.matchAll(tdRegex)) {
      const tdContent = tdMatch[1] ?? "";

      // PDF リンクを取得
      const pdfLinkMatch = tdContent.match(/<a[^>]+href="([^"]*\.pdf)"[^>]*>/i);
      if (!pdfLinkMatch?.[1]) continue;

      const href = pdfLinkMatch[1];
      // 絶対 URL に変換
      const pdfUrl = href.startsWith("http")
        ? href
        : `${BASE_URL}/${href.replace(/^\//, "")}`;

      // 全 a タグのテキストを収集
      const aTexts: string[] = [];
      const aTextRegex = /<a[^>]*>([\s\S]*?)<\/a>/gi;
      for (const aMatch of tdContent.matchAll(aTextRegex)) {
        const text = (aMatch[1] ?? "")
          .replace(/<[^>]+>/g, "")
          .replace(/&nbsp;/g, " ")
          .trim();
        if (text) aTexts.push(text);
      }

      // 号数: 最初の "N号" パターン
      const issueText = aTexts.find((t) => /\d+号/.test(t)) ?? "";
      const issueMatch = issueText.match(/(\d+号)/);
      const issue = issueMatch?.[1] ?? issueText;

      if (!issue) continue;

      // 発行日: "発行" を含むテキスト
      const dateText = aTexts.find((t) => t.includes("発行")) ?? "";
      const heldOn = dateText ? parseDateText(dateText, yearText) : null;

      documents.push({
        issue,
        heldOn,
        pdfUrl,
        year: yearText,
      });
    }
  }

  return documents;
}

/**
 * dayori.html を取得し、議会だより一覧を返す。
 * year を指定した場合は該当年のみ返す。
 */
export async function fetchDocumentList(
  year?: number,
): Promise<ImabetsuDocument[]> {
  const html = await fetchPage(LIST_URL);
  if (!html) return [];

  const all = parseListPage(html);

  if (year !== undefined) {
    return all.filter((doc) => doc.year.startsWith(String(year)));
  }

  return all;
}
