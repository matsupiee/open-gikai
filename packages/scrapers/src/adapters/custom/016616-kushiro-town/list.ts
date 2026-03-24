/**
 * 釧路町議会 会議録 — list フェーズ
 *
 * 年度別一覧ページ → 会議録詳細ページ → PDF リンクの順でクロールする。
 *
 * 年度別一覧ページ構造:
 *   <h3>定例会</h3> / <h3>臨時会</h3>
 *   テーブルの「会議録」列に詳細ページリンクあり
 *
 * 会議録詳細ページ構造:
 *   <table> の各行が1日の会議に対応
 *   「掲載内容」列にテキスト（日付情報含む）
 *   「会議録閲覧」列に PDF リンク
 */

import {
  BASE_ORIGIN,
  buildDetailUrl,
  buildYearListUrl,
  eraToWesternYear,
  fetchPage,
  toHalfWidth,
} from "./shared";

export interface KushiroTownMeeting {
  /** PDF の完全 URL */
  pdfUrl: string;
  /** 会議タイトル（例: "令和6年第1回定例会 第1号"） */
  title: string;
  /** 開催日 YYYY-MM-DD（解析できない場合は null） */
  heldOn: string | null;
  /** 会議種別（"plenary" / "extraordinary"） */
  category: string;
  /** 外部 ID 用のキー（例: "016616_kaigi376"） */
  pdfKey: string;
}

/**
 * 会議録詳細ページ URL を年度別一覧ページの HTML から抽出する。
 *
 * <h3> タグで定例会と臨時会を区別する。
 * リンクパターン: gijiroku/{回数}/{種別}/{年}.html
 */
export function parseYearListPage(html: string): {
  detailUrls: { url: string; category: string }[];
} {
  const detailUrls: { url: string; category: string }[] = [];

  // <h3> セクションを分割して定例会・臨時会を判別
  const h3Pattern = /<h3[^>]*>([\s\S]*?)<\/h3>/gi;
  const h3Matches = [...html.matchAll(h3Pattern)];

  for (let i = 0; i < h3Matches.length; i++) {
    const h3Match = h3Matches[i]!;
    const h3Text = h3Match[1]!.replace(/<[^>]+>/g, "").trim();
    const startIdx = h3Match.index! + h3Match[0].length;
    const endIdx =
      i + 1 < h3Matches.length ? h3Matches[i + 1]!.index! : html.length;
    const sectionHtml = html.slice(startIdx, endIdx);

    const category = h3Text.includes("臨時会") ? "extraordinary" : "plenary";

    // gijiroku/{回数}/{種別}/{年}.html パターンのリンクを抽出
    const linkPattern = /href="[^"]*gijiroku\/(\d+)\/(\d+)\/(\d+)\.html"/gi;
    for (const match of sectionHtml.matchAll(linkPattern)) {
      const round = parseInt(match[1]!, 10);
      const kind = parseInt(match[2]!, 10);
      const year = parseInt(match[3]!, 10);
      const url = buildDetailUrl(round, kind, year);
      if (!detailUrls.some((d) => d.url === url)) {
        detailUrls.push({ url, category });
      }
    }
  }

  // h3 がない場合はすべて定例会として扱う
  if (h3Matches.length === 0) {
    const linkPattern = /href="[^"]*gijiroku\/(\d+)\/(\d+)\/(\d+)\.html"/gi;
    for (const match of html.matchAll(linkPattern)) {
      const round = parseInt(match[1]!, 10);
      const kind = parseInt(match[2]!, 10);
      const year = parseInt(match[3]!, 10);
      const url = buildDetailUrl(round, kind, year);
      const category = kind === 2 ? "extraordinary" : "plenary";
      if (!detailUrls.some((d) => d.url === url)) {
        detailUrls.push({ url, category });
      }
    }
  }

  return { detailUrls };
}

/**
 * 会議録詳細ページの HTML から PDF リンクとメタ情報を抽出する。
 *
 * テーブル構造:
 *   ヘッダ: 掲載内容（幅80%） | 会議録閲覧（幅20%）
 *   行: 日付・内容テキスト | PDF リンク
 *
 * 掲載内容テキスト例:
 *   "06.03.04（月）町政執行方針、教育行政執行方針、代表質問（3名）ほか"
 *
 * <h2> から会議タイトルを取得:
 *   "令和6年第1回釧路町議会定例会 会議録"
 */
export function parseDetailPage(
  html: string,
  category: string,
): KushiroTownMeeting[] {
  const results: KushiroTownMeeting[] = [];

  // <h2> からタイトルを抽出
  const h2Match = html.match(/<h2[^>]*>([\s\S]*?)<\/h2>/i);
  const h2Text = h2Match ? h2Match[1]!.replace(/<[^>]+>/g, "").trim() : "";

  // タイトルから会議名を抽出（"会議録" の前まで）
  const meetingTitleMatch = h2Text.match(
    /(?:令和|平成)(元|\d+)年第[\d０-９]+回.+?(?:定例会|臨時会)/,
  );
  const meetingTitle = meetingTitleMatch ? meetingTitleMatch[0] : h2Text;

  // PDF リンクを含む行を抽出
  // パターン: kaigiroku/{年}/teirei_{回数}/kaigi{連番}.pdf
  //           kaigiroku/{年}/rinji_{回数}/kaigi{連番}.pdf
  const pdfLinkPattern =
    /href="([^"]*kaigiroku\/(\d+)\/(?:teirei|rinji)_(\d+)\/kaigi(\d+)\.pdf)"/gi;

  // テーブル行ごとに掲載内容と PDF を対応付ける
  const trPattern = /<tr[^>]*>([\s\S]*?)<\/tr>/gi;
  for (const trMatch of html.matchAll(trPattern)) {
    const rowHtml = trMatch[1]!;

    // PDF リンクを探す
    const pdfMatch = rowHtml.match(
      /href="([^"]*kaigiroku\/(\d+)\/(?:teirei|rinji)_(\d+)\/kaigi(\d+)\.pdf)"/i,
    );
    if (!pdfMatch) continue;

    const pdfPath = pdfMatch[1]!;
    const pdfWesternYear = parseInt(pdfMatch[2]!, 10);
    const pdfSeq = pdfMatch[4]!;

    // PDF URL を正規化（相対パス ../ を解決）
    const normalizedPdfUrl = normalizePdfUrl(pdfPath);

    // 掲載内容テキストから日付を抽出
    // "06.03.04（月）" パターン: YY.MM.DD（YYは和暦年で省略可）
    // PDF URL の西暦年（pdfWesternYear）と組み合わせて YYYY-MM-DD を生成する
    const tdPattern = /<td[^>]*>([\s\S]*?)<\/td>/gi;
    const tds = [...rowHtml.matchAll(tdPattern)];
    let heldOn: string | null = null;

    for (const td of tds) {
      const tdText = td[1]!.replace(/<[^>]+>/g, "").trim();
      // "06.03.04（月）" → MM=03, DD=04（最初の2桁は和暦年なので無視し、PDF URLの西暦年を使う）
      const dateMatch = tdText.match(/\d{2}\.(\d{2})\.(\d{2})/);
      if (dateMatch) {
        const mm = parseInt(dateMatch[1]!, 10);
        const dd = parseInt(dateMatch[2]!, 10);
        heldOn = `${pdfWesternYear}-${String(mm).padStart(2, "0")}-${String(dd).padStart(2, "0")}`;
        break;
      }
    }

    // 号数を含むタイトルを生成
    const title = `${meetingTitle} 第${pdfSeq}号`;
    const pdfKey = `016616_kaigi${pdfSeq}`;

    results.push({
      pdfUrl: normalizedPdfUrl,
      title,
      heldOn,
      category,
      pdfKey,
    });
  }

  // pdfLinkPattern でも抽出を試みる（trPattern で取れなかった場合のフォールバック）
  if (results.length === 0) {
    for (const match of html.matchAll(pdfLinkPattern)) {
      const pdfPath = match[1]!;
      const pdfSeq = match[4]!;
      const normalizedPdfUrl = normalizePdfUrl(pdfPath);
      const title = `${meetingTitle} 第${pdfSeq}号`;
      const pdfKey = `016616_kaigi${pdfSeq}`;
      results.push({
        pdfUrl: normalizedPdfUrl,
        title,
        heldOn: null,
        category,
        pdfKey,
      });
    }
  }

  return results;
}

/**
 * 相対パス（../../../../gikai/...）を絶対 URL に変換する。
 */
function normalizePdfUrl(pdfPath: string): string {
  if (pdfPath.startsWith("http")) return pdfPath;
  // ../../../../gikai/kaigiroku/... → /gikai/kaigiroku/...
  const normalized = pdfPath.replace(/^(?:\.\.\/)+/, "/");
  return `${BASE_ORIGIN}${normalized}`;
}

/**
 * PDF テキスト内のタイトル行から開催日を抽出する。
 *
 * パターン: "令和６年３月４日（月曜日）"（全角数字）
 */
export function parseDateFromPdfTitle(text: string): string | null {
  const halfWidth = toHalfWidth(text);
  const match = halfWidth.match(
    /(令和|平成)(元|\d+)年(\d+)月(\d+)日/,
  );
  if (!match) return null;

  const year = eraToWesternYear(`${match[1]}${match[2]}年`);
  if (!year) return null;

  const month = parseInt(match[3]!, 10);
  const day = parseInt(match[4]!, 10);
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

/**
 * 指定年の会議一覧を取得する。
 * 年度別一覧 → 詳細ページ → PDF の順でクロールする。
 */
export async function fetchMeetingList(
  year: number,
): Promise<KushiroTownMeeting[]> {
  const yearListUrl = buildYearListUrl(year);
  const yearHtml = await fetchPage(yearListUrl);
  if (!yearHtml) return [];

  const { detailUrls } = parseYearListPage(yearHtml);
  const allMeetings: KushiroTownMeeting[] = [];

  for (const { url, category } of detailUrls) {
    const detailHtml = await fetchPage(url);
    if (!detailHtml) continue;

    const meetings = parseDetailPage(detailHtml, category);
    allMeetings.push(...meetings);
  }

  return allMeetings;
}
