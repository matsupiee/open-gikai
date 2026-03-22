/**
 * 品川区議会 会議録検索システム — list フェーズ
 *
 * 一覧ページから「本文」ドキュメントの Id・タイトル・日付を収集する。
 * 「名簿・議事日程」は発言データを含まないのでスキップする。
 */

import { CABINET_IDS, PAGE_SIZE, buildListUrl, fetchPage } from "./shared";

export interface ShinagawaDocument {
  /** ドキュメント Id（URL パラメータの Id） */
  documentId: string;
  /** ドキュメントタイトル */
  title: string;
  /** 開催日 YYYY-MM-DD */
  heldOn: string;
}

/**
 * 一覧ページ HTML からドキュメント一覧をパースする。
 * 「本文」を含むタイトルのみ抽出し、「名簿・議事日程」はスキップする。
 */
export function parseListPage(html: string): {
  documents: ShinagawaDocument[];
  totalDocuments: number;
} {
  const documents: ShinagawaDocument[] = [];

  // 総件数を抽出: "36 文書" パターン
  const totalMatch = html.match(/(\d+)\s*文書/);
  const totalDocuments = totalMatch?.[1] ? parseInt(totalMatch[1], 10) : 0;

  // ドキュメントリンクを抽出
  // URL パターン: index.php/{randomId}?Template=document&Id={docId}#one
  const linkRegex =
    /index\.php\/\d+\?Template=document&(?:amp;)?Id=(\d+)[^"']*["'][^>]*>([^<]+)</gi;

  for (const match of html.matchAll(linkRegex)) {
    const documentId = match[1];
    const rawTitle = match[2]?.trim();
    if (!documentId || !rawTitle) continue;

    // 「名簿・議事日程」はスキップ — 発言データを含まない
    if (rawTitle.includes("名簿") || rawTitle.includes("議事日程")) continue;

    // タイトルに「本文」が含まれるもののみ対象
    if (!rawTitle.includes("本文")) continue;

    // 重複チェック
    if (documents.some((d) => d.documentId === documentId)) continue;

    documents.push({
      documentId,
      title: rawTitle.replace(/\s+/g, " ").trim(),
      heldOn: "", // 日付は別途抽出
    });
  }

  // 日付を抽出: Id={docId} の後にある YYYY-MM-DD パターン
  const dateRegex = /Id=(\d+)[\s\S]*?(\d{4}-\d{2}-\d{2})/g;
  for (const match of html.matchAll(dateRegex)) {
    const docId = match[1];
    const date = match[2];
    if (!docId || !date) continue;

    const doc = documents.find((d) => d.documentId === docId && !d.heldOn);
    if (doc) {
      doc.heldOn = date;
    }
  }

  return { documents, totalDocuments };
}

/**
 * 指定年の全 Cabinet から「本文」ドキュメント一覧を取得する。
 * ページネーションを辿って全件取得する。
 */
export async function fetchDocumentList(
  year: number,
): Promise<ShinagawaDocument[]> {
  const allDocuments: ShinagawaDocument[] = [];

  for (const cabinetId of CABINET_IDS) {
    let startRecord = 1;
    let hasMore = true;

    while (hasMore) {
      const url = buildListUrl(cabinetId, year, startRecord);
      const html = await fetchPage(url);
      if (!html) break;

      const { documents, totalDocuments } = parseListPage(html);

      for (const doc of documents) {
        if (!allDocuments.some((d) => d.documentId === doc.documentId)) {
          allDocuments.push(doc);
        }
      }

      if (totalDocuments > startRecord + PAGE_SIZE - 1) {
        startRecord += PAGE_SIZE;
      } else {
        hasMore = false;
      }
    }
  }

  return allDocuments;
}
