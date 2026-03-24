/**
 * 南伊勢町議会 -- list フェーズ
 *
 * 会議録本文は未公開のため、以下の PDF を収集対象とする:
 *   1. 審議結果（議決結果）PDF -- shingikekka セクション
 *   2. 一般質問事項 PDF -- ippan セクション
 *
 * 手順:
 *   1. 各インデックスページから年度別ページ URL を取得
 *   2. 指定年の年度別ページから PDF リンクを抽出
 */

import type { ListRecord } from "../../adapter";
import {
  SHINGIKEKKA_INDEX_URL,
  detectMeetingType,
  extractYearLinks,
  extractPdfLinks,
  fetchPage,
  delay,
  type DocumentKind,
} from "./shared";

export interface MinamiisePdfRecord {
  /** 会議タイトル（リンクテキストからファイルサイズ表記を除去したもの） */
  title: string;
  /** 会議種別 */
  meetingType: string;
  /** PDF の絶対 URL */
  pdfUrl: string;
  /** 対象年 */
  year: number;
  /** ドキュメント種別 */
  kind: DocumentKind;
  /** 年度別ページ URL（externalId 生成に使用） */
  yearPageUrl: string;
}

const INTER_PAGE_DELAY_MS = 1500;

/**
 * 指定年の全 PDF レコードを収集する。
 */
export async function fetchPdfList(
  _baseUrl: string,
  year: number
): Promise<MinamiisePdfRecord[]> {
  const allRecords: MinamiisePdfRecord[] = [];

  // 審議結果のみ処理する。
  // 一般質問 PDF には開催日（月日）が含まれないため MeetingData を構築できず、対象外とする。
  const sections: Array<{ kind: DocumentKind; indexUrl: string }> = [
    { kind: "shingikekka", indexUrl: SHINGIKEKKA_INDEX_URL },
  ];

  for (const { kind, indexUrl } of sections) {
    await delay(INTER_PAGE_DELAY_MS);
    const indexHtml = await fetchPage(indexUrl);
    if (!indexHtml) continue;

    const yearLinks = extractYearLinks(indexHtml, kind);
    const yearEntry = yearLinks.find((e) => e.year === year);
    if (!yearEntry) continue;

    await delay(INTER_PAGE_DELAY_MS);
    const yearPageHtml = await fetchPage(yearEntry.url);
    if (!yearPageHtml) continue;

    const pdfLinks = extractPdfLinks(yearPageHtml, yearEntry.url);

    for (const { title, pdfUrl } of pdfLinks) {
      const meetingType = detectMeetingType(title);
      allRecords.push({
        title,
        meetingType,
        pdfUrl,
        year,
        kind,
        yearPageUrl: yearEntry.url,
      });
    }
  }

  return allRecords;
}

/**
 * MinamiisePdfRecord を ListRecord に変換する。
 * テスト用に export する。
 */
export function toListRecord(record: MinamiisePdfRecord): ListRecord {
  return {
    detailParams: {
      title: record.title,
      meetingType: record.meetingType,
      pdfUrl: record.pdfUrl,
      year: record.year,
      kind: record.kind,
      yearPageUrl: record.yearPageUrl,
    },
  };
}
