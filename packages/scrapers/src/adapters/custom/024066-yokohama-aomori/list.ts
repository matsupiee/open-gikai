/**
 * 横浜町議会 — list フェーズ
 *
 * 会議録カテゴリページから h6 タグで区切られた会議ブロックを検出し、
 * 各ブロックの PDF リンクとメタ情報を抽出する。
 *
 * ページ構造:
 *   div#Center > div#CenterArea
 *     div.content > section
 *       h2.titleOfContent: "令和7年会議録"
 *       div.contentBodyBox > div.contentBody
 *         h6.content_p_01: "第2回臨時会（12月19日（金））"
 *         p > a[href="...pdf"]: "１２月１９日（金）　本会議１号（議事日程）"
 *         ...
 */

import { BASE_ORIGIN, LIST_URL, fetchPage, normalizeFullWidth } from "./shared";

export interface YokohamaAomoriDocument {
  /** 会議タイトル（h6 テキスト、例: "第4回定例会（12月1日（月）から12月2日（火））"） */
  sessionTitle: string;
  /** PDF リンクテキスト（例: "１２月１日（月）　本会議１号（開会、提案理由）"） */
  linkText: string;
  /** PDF の完全 URL */
  pdfUrl: string;
  /** 会議録ページの URL（sourceUrl として使用） */
  pageUrl: string;
  /** h2 から抽出した年テキスト（例: "令和7年会議録"） */
  yearHeading: string;
}

/**
 * h6 テキストからセッションタイトルを正規化する。
 * 全角数字・括弧を半角に変換する。
 */
function normalizeSessionTitle(raw: string): string {
  return normalizeFullWidth(raw).trim();
}

/**
 * contentBody HTML から PDF リンクを抽出する（純粋関数）。
 *
 * h6 タグで区切られた会議ブロックを識別し、各ブロックに続く p > a タグから
 * PDF URL とリンクテキストを収集する。
 */
export function parseContentBody(
  html: string,
  yearHeading: string,
  pageUrl: string,
): YokohamaAomoriDocument[] {
  const documents: YokohamaAomoriDocument[] = [];

  // h6 タグの位置と内容を収集
  const h6Regex = /<h6[^>]*>([\s\S]*?)<\/h6>/gi;
  const h6Matches = Array.from(html.matchAll(h6Regex));

  for (let i = 0; i < h6Matches.length; i++) {
    const h6Match = h6Matches[i]!;
    const rawH6 = h6Match[1]!
      .replace(/<[^>]+>/g, "")
      .replace(/&nbsp;/g, " ")
      .replace(/\s+/g, " ")
      .trim();

    // 定例会・臨時会のみ対象
    if (!rawH6.includes("定例会") && !rawH6.includes("臨時会")) continue;

    const sessionTitle = normalizeSessionTitle(rawH6);

    // このh6から次のh6（または終端）までの範囲を取得
    const blockStart = h6Match.index! + h6Match[0].length;
    const nextH6 = h6Matches[i + 1];
    const blockEnd = nextH6?.index ?? html.length;
    const blockHtml = html.slice(blockStart, blockEnd);

    // p > a タグから PDF リンクを収集
    const linkRegex = /<a[^>]+href="([^"]*\.pdf)"[^>]*>([\s\S]*?)<\/a>/gi;
    for (const linkMatch of blockHtml.matchAll(linkRegex)) {
      const href = linkMatch[1]!;
      const rawLinkText = linkMatch[2]!
        .replace(/<[^>]+>/g, "")
        .replace(/&nbsp;/g, " ")
        .trim();

      // PDF URL を組み立てる
      let pdfUrl: string;
      if (href.startsWith("http")) {
        pdfUrl = href;
      } else if (href.startsWith("/")) {
        pdfUrl = `${BASE_ORIGIN}${href}`;
      } else {
        pdfUrl = `${BASE_ORIGIN}/${href}`;
      }

      documents.push({
        sessionTitle,
        linkText: rawLinkText,
        pdfUrl,
        pageUrl,
        yearHeading,
      });
    }
  }

  return documents;
}

/**
 * 一覧ページ HTML から会議録 h2 ブロックを検出し、
 * yearHeading と contentBody HTML のペアを返す（純粋関数）。
 */
export function parseListPage(
  html: string,
  pageUrl: string,
): YokohamaAomoriDocument[] {
  const documents: YokohamaAomoriDocument[] = [];

  // h2 タグを見つけて年度ブロックを構成する
  const h2Regex = /<h2[^>]*>([\s\S]*?)<\/h2>/gi;
  const h2Matches = Array.from(html.matchAll(h2Regex));

  for (let i = 0; i < h2Matches.length; i++) {
    const h2Match = h2Matches[i]!;
    const rawH2 = h2Match[1]!
      .replace(/<[^>]+>/g, "")
      .replace(/&nbsp;/g, " ")
      .replace(/\s+/g, " ")
      .trim();

    // "令和X年会議録" 形式の h2 のみ対象
    if (!rawH2.includes("会議録")) continue;

    // このh2から次のh2（または終端）までの範囲を取得
    const blockStart = h2Match.index! + h2Match[0].length;
    const nextH2 = h2Matches[i + 1];
    const blockEnd = nextH2?.index ?? html.length;
    const blockHtml = html.slice(blockStart, blockEnd);

    const docs = parseContentBody(blockHtml, rawH2, pageUrl);
    documents.push(...docs);
  }

  // h2 が見つからない場合は全体を contentBody として処理
  if (documents.length === 0) {
    const docs = parseContentBody(html, "", pageUrl);
    documents.push(...docs);
  }

  return documents;
}

/**
 * 年見出しテキストから西暦年を抽出する。
 * 「令和7年会議録」→ 2025
 */
export function extractYearFromHeading(yearHeading: string): number | null {
  const normalized = normalizeFullWidth(yearHeading);

  const reiwaMatch = normalized.match(/令和(元|\d+)年/);
  if (reiwaMatch) {
    const eraYear = reiwaMatch[1] === "元" ? 1 : parseInt(reiwaMatch[1]!, 10);
    return 2018 + eraYear;
  }

  const heiseiMatch = normalized.match(/平成(元|\d+)年/);
  if (heiseiMatch) {
    const eraYear = heiseiMatch[1] === "元" ? 1 : parseInt(heiseiMatch[1]!, 10);
    return 1988 + eraYear;
  }

  return null;
}

/**
 * 会議録カテゴリページを取得し、全 PDF リンクを収集する。
 * year を指定した場合は開催年でフィルタする。
 */
export async function fetchDocumentList(
  year?: number,
): Promise<YokohamaAomoriDocument[]> {
  const html = await fetchPage(LIST_URL);
  if (!html) return [];

  const allDocuments = parseListPage(html, LIST_URL);

  if (year === undefined) return allDocuments;

  return allDocuments.filter((doc) => {
    const docYear = extractYearFromHeading(doc.yearHeading);
    if (docYear !== null) return docYear === year;
    return false;
  });
}
