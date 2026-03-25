/**
 * 外ヶ浜町議会 — list フェーズ
 *
 * gikai_dayori.html および ippan_situmon.html から PDF リンクを収集する。
 */

import { DAYORI_LIST_URL, fetchPage, parseDateFromFilename, toAbsoluteUrl } from "./shared";

export type DocumentType = "dayori" | "ippan";

export interface SotogahamaDocument {
  /** ドキュメント種別 */
  type: DocumentType;
  /** 号数（議会だよりのみ、例: "83" → "第83号"） */
  issue: string | null;
  /** 発行年月 YYYY-MM-DD（ファイル名から取得） */
  heldOn: string | null;
  /** PDF の完全 URL */
  pdfUrl: string;
  /** PDF ファイル名（拡張子なし） */
  filename: string;
}

/**
 * HTML から PDF リンクの一覧をパースする。
 *
 * .pdf へのリンクをすべて収集し、ファイル名からメタデータを抽出する。
 */
export function parseListPage(
  html: string,
  type: DocumentType,
): SotogahamaDocument[] {
  const documents: SotogahamaDocument[] = [];
  const seen = new Set<string>();

  // <a href="...pdf"> のリンクを収集
  const linkRegex = /<a[^>]+href="([^"]*\.pdf)"[^>]*>/gi;

  for (const match of html.matchAll(linkRegex)) {
    const href = match[1];
    if (!href) continue;

    const pdfUrl = toAbsoluteUrl(href);

    // 重複除去
    if (seen.has(pdfUrl)) continue;
    seen.add(pdfUrl);

    // ファイル名を取得（パスの末尾）
    const filenameWithExt = pdfUrl.split("/").pop() ?? "";
    const filename = filenameWithExt.replace(/\.pdf$/i, "");

    if (!filename) continue;

    // 外ヶ浜町のPDFファイルのみを対象とする
    // 議会だより: YYYYMM_soto_gikaidayori_XX.pdf
    // 一般質問通告表: YYYYMM_ippan_situmon.pdf
    const isSotoPattern = /^\d{6}_soto_gikaidayori_\d+$/.test(filename);
    const isIppanPattern = /^\d{6}_ippan_situmon$/.test(filename);

    if (type === "dayori" && !isSotoPattern) continue;
    if (type === "ippan" && !isIppanPattern) continue;

    const heldOn = parseDateFromFilename(filename);

    // 号数を取得（議会だより: YYYYMM_soto_gikaidayori_XX の XX 部分）
    let issue: string | null = null;
    if (type === "dayori") {
      const issueMatch = filename.match(/_(\d+)$/);
      if (issueMatch?.[1]) {
        issue = `第${issueMatch[1]}号`;
      }
    }

    documents.push({
      type,
      issue,
      heldOn,
      pdfUrl,
      filename,
    });
  }

  return documents;
}

/**
 * gikai_dayori.html を取得し、議会だより一覧を返す。
 * year を指定した場合は該当年のみ返す。
 */
export async function fetchDocumentList(
  year?: number,
): Promise<SotogahamaDocument[]> {
  const html = await fetchPage(DAYORI_LIST_URL);
  if (!html) return [];

  const all = parseListPage(html, "dayori");

  if (year !== undefined) {
    return all.filter((doc) => doc.heldOn?.startsWith(String(year)) ?? false);
  }

  return all;
}
