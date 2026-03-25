/**
 * 八幡浜市議会 会議録 — list フェーズ
 *
 * 本会議一覧ページ（/gikai/2022111000029/）の1ページから
 * 全年度分の会議録 URL を収集する。ページネーションなし。
 *
 * 一覧テーブルの構造:
 *   | 年 | 月（日）| 区分 | 日程 | 議案 | 賛否 | 会議録（各号） |
 *
 * 会議録リンクのパターン:
 *   <a href="/gikai/{コード}/">第1号</a>
 */

import { BASE_ORIGIN, ARCHIVE_PATHS, INDEX_PATH, fetchPage, toSeireki } from "./shared";

export interface YawatahamaDocument {
  /** 会議録詳細ページの絶対 URL */
  detailUrl: string;
  /** 会議録詳細ページのパス（/gikai/{コード}/） */
  path: string;
  /** 会議タイトル（例: "令和7年12月定例会"）*/
  sessionTitle: string;
  /** 開催日 YYYY-MM-DD。日が不明な場合は null */
  heldOn: string | null;
  /** 西暦年 */
  year: number;
  /** 会議種別（定例会 / 臨時会） */
  meetingKind: string;
}

/**
 * 一覧ページ HTML から会議録ドキュメント一覧をパースする。
 *
 * テーブル行を解析し、会議録リンク（/gikai/{コード}/）を抽出する。
 * 年・月・区分はリンクが含まれるテーブル行の前のセルから取得する。
 */
export function parseListPage(html: string): YawatahamaDocument[] {
  const documents: YawatahamaDocument[] = [];
  const seen = new Set<string>();

  // テーブル行を抽出
  const trRegex = /<tr[^>]*>([\s\S]*?)<\/tr>/gi;
  for (const trMatch of html.matchAll(trRegex)) {
    const trHtml = trMatch[1]!;

    // 会議録リンク（/gikai/{数字コード}/）のうち、
    // テキストが「第N号」または会議録内容を示すものを抽出する
    // 「日程」「議案」「賛否」などのリンクは除外する
    const detailLinkRegex = /href="(\/gikai\/(\d{13,})\/)"[^>]*>([\s\S]*?)<\/a>/gi;
    const detailLinks: { path: string; url: string }[] = [];
    for (const linkMatch of trHtml.matchAll(detailLinkRegex)) {
      const path = linkMatch[1]!;
      const url = `${BASE_ORIGIN}${path}`;
      const linkText = linkMatch[3]!.replace(/<[^>]+>/g, "").trim();

      // 「日程」「議案」「賛否」「目次」などのリンクは除外
      const excludePatterns = /^(日程|議案|賛否|目次|結果)$/;
      if (excludePatterns.test(linkText)) continue;

      if (!seen.has(url)) {
        detailLinks.push({ path, url });
      }
    }

    if (detailLinks.length === 0) continue;

    // セルを抽出
    const tdRegex = /<td[^>]*>([\s\S]*?)<\/td>/gi;
    const cells: string[] = [];
    for (const tdMatch of trHtml.matchAll(tdRegex)) {
      cells.push(tdMatch[1]!.replace(/<[^>]+>/g, "").trim());
    }

    // 年・月・区分セルを解析（先頭3セル相当）
    // cells[0]: 年（例: "令和7年"）
    // cells[1]: 月（例: "12月" or "9月3日"）
    // cells[2]: 区分（例: "定例会" / "臨時会"）
    const yearCell = cells[0] ?? "";
    const monthCell = cells[1] ?? "";
    const kindCell = cells[2] ?? "";

    // 年の解析
    const yearMatch = yearCell.replace(/[０-９]/g, (c) =>
      String.fromCharCode(c.charCodeAt(0) - 0xfee0),
    ).match(/(令和|平成|昭和)(元|\d+)年/);
    if (!yearMatch) continue;

    const year = toSeireki(yearMatch[1]!, yearMatch[2]!);
    if (!year) continue;

    // 月・日の解析（全角数字を半角に変換）
    const normalizedMonth = monthCell.replace(/[０-９]/g, (c) =>
      String.fromCharCode(c.charCodeAt(0) - 0xfee0),
    );
    const monthDayMatch = normalizedMonth.match(/(\d+)月(?:(\d+)日)?/);
    const month = monthDayMatch ? parseInt(monthDayMatch[1]!, 10) : null;
    const day = monthDayMatch?.[2] ? parseInt(monthDayMatch[2], 10) : null;

    const heldOn =
      month
        ? day
          ? `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`
          : null
        : null;

    // 区分
    const meetingKind = kindCell.includes("臨時") ? "臨時会" : "定例会";
    const monthStr = month ? `${month}月` : "";
    const sessionTitle = `${yearCell.trim()}${monthStr}${meetingKind}`;

    for (const { path, url } of detailLinks) {
      if (seen.has(url)) continue;
      seen.add(url);
      documents.push({
        detailUrl: url,
        path,
        sessionTitle,
        heldOn,
        year,
        meetingKind,
      });
    }
  }

  return documents;
}

/**
 * 指定年の全会議録ドキュメント一覧を取得する。
 * 本会議一覧ページと過去アーカイブページの両方を参照する。
 */
export async function fetchDocumentList(year: number): Promise<YawatahamaDocument[]> {
  const allPaths = [INDEX_PATH, ...ARCHIVE_PATHS];
  const allDocs: YawatahamaDocument[] = [];
  const seen = new Set<string>();

  for (const path of allPaths) {
    const url = `${BASE_ORIGIN}${path}`;
    const html = await fetchPage(url);
    if (!html) continue;

    const docs = parseListPage(html);
    for (const doc of docs) {
      if (!seen.has(doc.detailUrl)) {
        seen.add(doc.detailUrl);
        allDocs.push(doc);
      }
    }
  }

  return allDocs.filter((d) => d.year === year);
}
