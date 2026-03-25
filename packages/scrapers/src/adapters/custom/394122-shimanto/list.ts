/**
 * 四万十町議会 — list フェーズ
 *
 * 会議録カテゴリ一覧ページ（?hdnKatugi=130）からフォーム POST で年度を切り替え、
 * 各年度の会議録 hdnID を収集する。
 *
 * URL パターン:
 *   一覧: https://www.town.shimanto.lg.jp/gijiroku/?hdnKatugi=130
 *   詳細: https://www.town.shimanto.lg.jp/gijiroku/giji_dtl.php?hdnKatugi=130&hdnID={ID}
 *
 * 年度切り替えは fncYearSet(hdngo, hdnYear) によるフォーム POST で実現する。
 * hdnYear に西暦年を指定して POST することで当該年度のデータを取得できる。
 */

import {
  BASE_ORIGIN,
  LIST_BASE_URL,
  KATUGI_GIJIROKU,
  fetchPage,
  fetchPost,
  parseSlashDate,
  detectMeetingType,
} from "./shared";

const LIST_URL = `${LIST_BASE_URL}?hdnKatugi=${KATUGI_GIJIROKU}`;

export interface ShimantoRecord {
  /** 文書 ID */
  hdnId: string;
  /** タイトル（例: "令和８年第１回臨時会(開催日:2026/01/29)"） */
  title: string;
  /** 開催日 YYYY-MM-DD。取得できない場合は null */
  heldOn: string | null;
  /** 会議タイプ */
  meetingType: string;
  /** 詳細ページ URL */
  detailUrl: string;
}

/**
 * 会議録一覧ページの HTML から hdnID とタイトルを抽出する（テスト可能な純粋関数）。
 *
 * リンクパターン: giji_dtl.php?hdnKatugi=130&hdnID={ID}
 * タイトル例:    "令和８年第１回臨時会(開催日:2026/01/29)"
 */
export function parseListPage(html: string): ShimantoRecord[] {
  const results: ShimantoRecord[] = [];

  // giji_dtl.php?hdnKatugi=130&hdnID={ID} のリンクを抽出
  const linkPattern =
    /href="(?:\.\/)?giji_dtl\.php\?hdnKatugi=130&(?:amp;)?hdnID=(\d+)"[^>]*>([\s\S]*?)<\/a>/gi;

  for (const match of html.matchAll(linkPattern)) {
    const hdnId = match[1]!;
    const rawText = match[2]!
      .replace(/<[^>]+>/g, "")
      .replace(/&nbsp;/g, " ")
      .replace(/&amp;/g, "&")
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">")
      .replace(/&#\d+;/g, "")
      .trim();

    if (!rawText) continue;

    // 開催日の抽出: "(開催日:YYYY/MM/DD)" パターン
    const dateMatch = rawText.match(/開催日[:：](\d{4}\/\d{2}\/\d{2})/);
    const heldOn = dateMatch ? parseSlashDate(dateMatch[1]!) : null;

    const detailUrl = `${BASE_ORIGIN}/gijiroku/giji_dtl.php?hdnKatugi=${KATUGI_GIJIROKU}&hdnID=${hdnId}`;

    results.push({
      hdnId,
      title: rawText,
      heldOn,
      meetingType: detectMeetingType(rawText),
      detailUrl,
    });
  }

  return results;
}

/**
 * 一覧ページから年度タブの情報を抽出する。
 *
 * HTML 例:
 *   <a href="#" onClick="fncYearSet('令和', '8')">令和８年表示</a>
 *   <a href="#" onClick="fncYearSet('平成', '30')">平成３０年表示</a>
 */
export function parseYearTabs(html: string): Array<{ hdngo: string; hdnYear: string; westernYear: number }> {
  const results: Array<{ hdngo: string; hdnYear: string; westernYear: number }> = [];

  // fncYearSet('元号', '年号内数字') パターンを抽出
  const tabPattern = /fncYearSet\s*\(\s*'([^']*)'\s*,\s*'(\d+)'\s*\)/gi;

  for (const match of html.matchAll(tabPattern)) {
    const hdngo = match[1]!;
    const hdnYear = match[2]!;
    const yearNum = parseInt(hdnYear, 10);
    let westernYear: number;
    if (hdngo === "令和") {
      westernYear = yearNum + 2018;
    } else if (hdngo === "平成") {
      westernYear = yearNum + 1988;
    } else if (hdngo === "昭和") {
      westernYear = yearNum + 1925;
    } else {
      continue;
    }
    results.push({ hdngo, hdnYear, westernYear });
  }

  return results;
}

/**
 * 指定年の会議録一覧を取得する。
 *
 * 1. カテゴリ一覧ページにアクセスして年度タブを収集
 * 2. 指定年に一致するタブに POST でアクセス
 * 3. 取得したページから hdnID を収集
 */
export async function fetchDocumentList(year: number): Promise<ShimantoRecord[]> {
  // まず一覧ページを取得して年度タブを確認
  const listHtml = await fetchPage(LIST_URL);
  if (!listHtml) {
    console.warn(`[394122-shimanto] 一覧ページの取得に失敗: ${LIST_URL}`);
    return [];
  }

  const yearTabs = parseYearTabs(listHtml);

  // 指定年（西暦）に一致するタブを探してフォーム POST
  const targetTab = yearTabs.find((tab) => tab.westernYear === year);

  if (!targetTab) {
    // タブが見つからない場合、現在表示中のページのみを確認
    // 開催日から年度を推定してフィルタリング
    const currentRecords = parseListPage(listHtml);
    return currentRecords.filter((r) => {
      if (!r.heldOn) return false;
      return r.heldOn.startsWith(String(year));
    });
  }

  // 年度 POST でデータを取得
  const yearHtml = await fetchPost(LIST_URL, {
    hdnKatugi: KATUGI_GIJIROKU,
    hdngo: targetTab.hdngo,
    hdnYear: targetTab.hdnYear,
  });

  if (!yearHtml) {
    console.warn(`[394122-shimanto] 年度ページの取得に失敗: year=${year}`);
    return [];
  }

  return parseListPage(yearHtml);
}
