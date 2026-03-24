/**
 * 上富良野町議会 会議録 — list フェーズ
 *
 * 3つの一覧ページ（id=152, 153, 154）を全ページ巡回し、
 * PDF リンクとメタ情報を収集する。
 */

import {
  LIST_PAGE_IDS,
  type ListPageId,
  buildListUrl,
  fetchPage,
  listPageIdToMeetingType,
} from "./shared";

export interface KamifuranoDocument {
  /** PDF の URL */
  pdfUrl: string;
  /** 会議タイトル */
  title: string;
  /** 開催日文字列（和暦形式、例: R07/3/11）。解析失敗時は null */
  rawDate: string | null;
  /** 会議種別 */
  meetingType: string;
  /** 一覧ページID */
  pageId: ListPageId;
}

/**
 * 一覧ページ HTML から PDF リンクとメタ情報をパースする。
 */
export function parseListPage(
  html: string,
  pageId: ListPageId,
): KamifuranoDocument[] {
  const documents: KamifuranoDocument[] = [];
  const meetingType = listPageIdToMeetingType(pageId);

  // テーブル行を取得
  const trRegex = /<tr[^>]*>([\s\S]*?)<\/tr>/gi;

  for (const trMatch of html.matchAll(trRegex)) {
    const trContent = trMatch[1];
    if (!trContent) continue;

    // PDF リンクを取得
    const pdfMatch = trContent.match(
      /href="([^"]*\/contents\/20down\/gikai-ka\/[^"]*\.pdf)"/i,
    );
    if (!pdfMatch?.[1]) continue;

    const rawPdfPath = pdfMatch[1];
    const pdfUrl = rawPdfPath.startsWith("http")
      ? rawPdfPath
      : `https://www.town.kamifurano.hokkaido.jp${rawPdfPath}`;

    // タイトルを TD から取得（テキスト内容）
    const tdTexts: string[] = [];
    const tdRegex = /<td[^>]*>([\s\S]*?)<\/td>/gi;
    for (const tdMatch of trContent.matchAll(tdRegex)) {
      const tdContent = tdMatch[1] ?? "";
      const plain = tdContent
        .replace(/<[^>]+>/g, "")
        .replace(/&nbsp;/g, " ")
        .replace(/&amp;/g, "&")
        .replace(/&lt;/g, "<")
        .replace(/&gt;/g, ">")
        .replace(/&quot;/g, '"')
        .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(Number(code)))
        .trim();
      if (plain) tdTexts.push(plain);
    }

    // 日付パターン（和暦: R07/3/11 など）を検出
    let rawDate: string | null = null;
    const datePattern = /[RrHh]\d{1,2}\/\d{1,2}\/\d{1,2}/;
    for (const text of tdTexts) {
      const dateMatch = text.match(datePattern);
      if (dateMatch) {
        rawDate = dateMatch[0];
        break;
      }
    }

    // タイトルは最初の非空テキスト（日付以外）
    let title = tdTexts.find((t) => !datePattern.test(t)) ?? "";
    if (!title) {
      // PDF ファイル名からタイトルを推定
      const filename = rawPdfPath.split("/").pop() ?? "";
      title = filename.replace(".pdf", "");
    }

    // 重複チェック
    if (documents.some((d) => d.pdfUrl === pdfUrl)) continue;

    documents.push({
      pdfUrl,
      title: title.replace(/\s+/g, " ").trim(),
      rawDate,
      meetingType,
      pageId,
    });
  }

  return documents;
}

/**
 * 一覧ページにページネーションがあるか確認する。
 * dpgndg1={page+1} のリンクが存在すれば次ページあり。
 */
export function hasNextPage(html: string, currentPage: number): boolean {
  const nextPage = currentPage + 1;
  return html.includes(`dpgndg1=${nextPage}`);
}

/**
 * 指定された一覧ページIDの全ページから PDF リンクを収集する。
 */
export async function fetchDocumentsFromPage(
  pageId: ListPageId,
): Promise<KamifuranoDocument[]> {
  const allDocuments: KamifuranoDocument[] = [];
  let page = 1;

  while (true) {
    const url = buildListUrl(pageId, page);
    const html = await fetchPage(url);
    if (!html) break;

    const docs = parseListPage(html, pageId);
    for (const doc of docs) {
      if (!allDocuments.some((d) => d.pdfUrl === doc.pdfUrl)) {
        allDocuments.push(doc);
      }
    }

    if (!hasNextPage(html, page)) break;
    page++;
  }

  return allDocuments;
}

/**
 * 全3種別（本会議・予算特別委員会・決算特別委員会）から PDF リンクを収集する。
 */
export async function fetchAllDocuments(): Promise<KamifuranoDocument[]> {
  const allDocuments: KamifuranoDocument[] = [];

  for (const pageId of LIST_PAGE_IDS) {
    const docs = await fetchDocumentsFromPage(pageId);
    for (const doc of docs) {
      if (!allDocuments.some((d) => d.pdfUrl === doc.pdfUrl)) {
        allDocuments.push(doc);
      }
    }
  }

  return allDocuments;
}
