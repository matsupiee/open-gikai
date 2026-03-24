/**
 * 新ひだか町議会 — list フェーズ
 *
 * 会議録一覧ページからフレームセット URL を収集し、
 * 各フレームセットの目次ファイルから本文ファイル URL を抽出する。
 *
 * 対応形式:
 *   - HTML 会議録（令和2年〜令和6年）: kaigiroku/ 配下のフレームセット
 *   - PDF 会議録（令和7年以降・平成30年の一部）: /hotnews/files/ 配下の PDF
 *
 * URL 命名規則:
 *   フレームセット: {年号}{月2桁}{種別}.html (例: R0612T.html)
 *   目次ファイル: {年号}{月2桁}{種別}M.html
 *   本文ファイル: {年号}{月2桁}{種別}_{号数}.html
 */

import {
  BASE_ORIGIN_NEW,
  LIST_PAGE_URL,
  eraToWesternYear,
  toHalfWidth,
  normalizeUrl,
  fetchShiftJisPage,
} from "./shared";

export interface ShinhidakaMeeting {
  /** 本文ファイルの完全 URL（HTML）または PDF URL */
  sourceUrl: string;
  /** 会議タイトル（例: "令和6年第7回新ひだか町議会定例会会議録 第1号"） */
  title: string;
  /** 開催日 YYYY-MM-DD（解析できない場合は null） */
  heldOn: string | null;
  /** 会議種別 */
  meetingType: string;
  /** 外部 ID */
  externalId: string;
  /** コンテンツ形式 */
  format: "html" | "pdf";
  /** リンクテキスト（PDF の場合に日付を含む） */
  linkText?: string;
}

/** HTML タグを除去してプレーンテキストを返す */
function stripHtml(html: string): string {
  return html.replace(/<[^>]+>/g, "").trim();
}

/**
 * フレームセットファイル名から年号・月・種別を抽出する。
 *
 * 例:
 *   R0612T.html -> { eraCode: "R06", month: 12, sessionType: "T" }
 *   H3103T.html -> { eraCode: "H31", month: 3, sessionType: "T" }
 *   h2912T.html -> { eraCode: "h29", month: 12, sessionType: "T" }
 */
export function parseFramesetFilename(filename: string): {
  eraCode: string;
  month: number;
  sessionType: string;
} | null {
  // 旧命名規則（h2106t4-1-n.html）は対応外
  const match = filename.match(/^([RrHh]\d{2,4})(\d{2})([TR])(?:\.html)?$/i);
  if (!match) return null;

  const eraCode = match[1]!;
  const month = parseInt(match[2]!, 10);
  const sessionType = match[3]!.toUpperCase();

  return { eraCode, month, sessionType };
}

/**
 * 年号コードから西暦年を返す。
 *
 * 例: "R06" -> 2024, "H31" -> 2019, "h29" -> 2017, "R01" -> 2019
 */
export function eraCodeToWesternYear(eraCode: string): number | null {
  const upper = eraCode.toUpperCase();
  const match = upper.match(/^([RH])(\d{2,4})$/);
  if (!match) return null;

  const era = match[1]!;
  const eraYear = parseInt(match[2]!, 10);

  if (era === "R") return eraYear + 2018;
  if (era === "H") return eraYear + 1988;
  return null;
}

/**
 * 目次ファイルの URL を組み立てる。
 *
 * 例: https://www.shinhidaka-hokkaido.jp/gikai/kaigiroku/R06/R0612T.html
 *  -> https://www.shinhidaka-hokkaido.jp/gikai/kaigiroku/R06/R0612TM.html
 */
export function buildIndexUrl(framesetUrl: string): string {
  return framesetUrl.replace(/\.html$/i, "M.html");
}

/**
 * 目次ファイル HTML から各号数（日程）の本文ファイル URL と開催日を抽出する。
 *
 * 目次ファイルのリンク例:
 *   <a href="R0612T_01.html" target="main">１号（１２月１０日）</a>
 *   <a href="R0612T_02.html" target="main">２号（１２月１１日）</a>
 */
export function parseIndexPage(
  html: string,
  baseUrl: string,
  year: number,
): { contentUrl: string; heldOn: string | null; sessionNum: number }[] {
  const results: { contentUrl: string; heldOn: string | null; sessionNum: number }[] = [];
  const seen = new Set<string>();

  // 号数リンクのパターン: href="R0612T_01.html" または href=R0612T_01.html (引用符なし)
  // リンクテキスト: "１号（１２月１０日）"
  const linkPattern = /<a[^>]+href=["']?([^"' >]+_\d+\.html\s*)["']?[^>]*>([\s\S]*?)<\/a>/gi;

  const baseDir = baseUrl.replace(/\/[^/]*$/, "/");

  for (const match of html.matchAll(linkPattern)) {
    const href = match[1]!.trim();
    const rawText = stripHtml(match[2]!);

    // 号数と開催日を抽出: "１号（１２月１０日）"
    const normalizedText = toHalfWidth(rawText);
    const numMatch = normalizedText.match(/^(\d+)号/);
    if (!numMatch) continue;

    const sessionNum = parseInt(numMatch[1]!, 10);

    // 開催日を抽出: （N月N日）
    const dateMatch = normalizedText.match(/[（(](\d+)月(\d+)日[）)]/);
    let heldOn: string | null = null;
    if (dateMatch) {
      const month = parseInt(dateMatch[1]!, 10);
      const day = parseInt(dateMatch[2]!, 10);
      heldOn = `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    }

    // 本文ファイル URL を組み立てる
    const contentUrl = href.startsWith("http") ? href : `${baseDir}${href}`;
    const normalizedContentUrl = normalizeUrl(contentUrl);

    if (!seen.has(normalizedContentUrl)) {
      seen.add(normalizedContentUrl);
      results.push({ contentUrl: normalizedContentUrl, heldOn, sessionNum });
    }
  }

  return results;
}

/**
 * PDF リンクテキストから日付を抽出する。
 *
 * リンクテキスト例:
 *   "【未定稿】12月定例会（第7回）1日目◆9日（火曜日）"  → 12月9日
 *   "【未定稿】12月定例会（第7回）2日目◆10日（水曜日）" → 12月10日
 *   "【未定稿】11月臨時会（第6回）5日（水曜日）"         → 11月5日
 */
export function parseDateFromPdfLinkText(
  linkText: string,
  year: number,
): string | null {
  const normalized = toHalfWidth(linkText);

  // 月を抽出: "12月定例会" -> month=12
  const monthMatch = normalized.match(/(\d+)月/);
  if (!monthMatch) return null;
  const month = parseInt(monthMatch[1]!, 10);

  // 日を抽出:
  //   優先: "◆9日" パターン（複数日程の会議で日を特定）
  //   フォールバック: "第N回）M日" パターン（臨時会等で◆がない場合）
  const diamondDayMatch = normalized.match(/◆(\d+)日/);
  if (diamondDayMatch) {
    const day = parseInt(diamondDayMatch[1]!, 10);
    return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
  }

  // "第N回）M日" パターン: 「（第6回）5日」
  const parenDayMatch = normalized.match(/[）)]\s*(\d+)日/);
  if (parenDayMatch) {
    const day = parseInt(parenDayMatch[1]!, 10);
    return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
  }

  return null;
}

/**
 * 一覧ページ HTML から指定年の会議リストを抽出する。
 */
export function parseListPage(
  html: string,
  targetYear: number,
): {
  framesetUrl: string;
  linkText: string;
  year: number;
  meetingType: string;
}[] {
  const results: {
    framesetUrl: string;
    linkText: string;
    year: number;
    meetingType: string;
  }[] = [];
  const seen = new Set<string>();

  // kaigiroku/ を含むリンクを抽出
  const linkPattern = /<a[^>]+href="([^"]*kaigiroku\/[^"]*\.html)"[^>]*>([\s\S]*?)<\/a>/gi;

  for (const match of html.matchAll(linkPattern)) {
    const href = match[1]!;
    const rawText = stripHtml(match[2]!);

    // 旧命名規則（h2106t4-1-n.html）はスキップ（フレームセット外の本文ファイル）
    const filename = href.split("/").pop() ?? "";
    if (/^[hH]\d{2,4}\d{2}[tTrR]\d/.test(filename)) continue;

    // 目次ファイル（M.html）もスキップ
    if (/M\.html$/i.test(filename)) continue;

    // 本文ファイル（_01.html など）もスキップ
    if (/_\d+\.html$/i.test(filename)) continue;

    // フレームセットファイル名を解析
    const parsed = parseFramesetFilename(filename.replace(/\.html$/i, ""));
    if (!parsed) continue;

    const year = eraCodeToWesternYear(parsed.eraCode);
    if (!year || year !== targetYear) continue;

    // URL を新ドメインに正規化
    const framesetUrl = normalizeUrl(
      href.startsWith("http") ? href : `${BASE_ORIGIN_NEW}${href}`,
    );

    if (seen.has(framesetUrl)) continue;
    seen.add(framesetUrl);

    const meetingType = parsed.sessionType === "R" ? "extraordinary" : "plenary";

    results.push({
      framesetUrl,
      linkText: rawText,
      year,
      meetingType,
    });
  }

  return results;
}

/**
 * 一覧ページ HTML から指定年の PDF リンクを抽出する。
 *
 * PDF リンクテキスト例:
 *   "【未定稿】12月定例会（第7回）1日目◆9日（火曜日）"
 */
export function parsePdfLinksFromListPage(
  html: string,
  targetYear: number,
): {
  pdfUrl: string;
  linkText: string;
  year: number;
  meetingType: string;
  heldOn: string | null;
}[] {
  const results: {
    pdfUrl: string;
    linkText: string;
    year: number;
    meetingType: string;
    heldOn: string | null;
  }[] = [];
  const seen = new Set<string>();

  // セクション見出し（年号を含む見出し）と PDF リンクを対応付ける
  // まず全体のリンクをとり、その前後の年号見出しから年度を判断する必要がある
  // 一覧ページは年度単位でセクション化されているため、
  // 前後の文脈から年度を特定する

  // PDF リンクのパターン
  const pdfPattern =
    /<a[^>]+href="(\/hotnews\/files\/[^"]+\.pdf)"[^>]*>([\s\S]*?)<\/a>/gi;

  // 年度見出しパターン: テキストに含まれる「令和N年」「平成N年」
  // ページ全体をスキャンして、各 PDF リンクに最も近い年度見出しを特定する
  const eraPattern = /(令和|平成)(元|\d+)年/g;

  // 年度見出しの位置を収集
  const eraPositions: { index: number; year: number }[] = [];
  for (const m of html.matchAll(eraPattern)) {
    const year = eraToWesternYear(m[0]);
    if (year) {
      eraPositions.push({ index: m.index!, year });
    }
  }

  for (const match of html.matchAll(pdfPattern)) {
    const href = match[1]!;
    const rawText = stripHtml(match[2]!);
    const pdfUrl = `${BASE_ORIGIN_NEW}${href}`;

    if (seen.has(pdfUrl)) continue;

    // この PDF リンクに最も近い（直前の）年度見出しから年度を特定
    const linkPos = match.index!;
    let year: number | null = null;
    for (const ep of eraPositions) {
      if (ep.index <= linkPos) {
        year = ep.year;
      }
    }

    if (!year || year !== targetYear) continue;

    seen.add(pdfUrl);

    const meetingType = rawText.includes("臨時会") ? "extraordinary" : "plenary";
    const heldOn = parseDateFromPdfLinkText(rawText, year);

    results.push({
      pdfUrl,
      linkText: rawText,
      year,
      meetingType,
      heldOn,
    });
  }

  return results;
}

/**
 * 指定年の会議一覧を取得する。
 */
export async function fetchMeetingList(
  year: number,
): Promise<ShinhidakaMeeting[]> {
  const listHtml = await fetchShiftJisPage(LIST_PAGE_URL);
  if (!listHtml) return [];

  const results: ShinhidakaMeeting[] = [];

  // HTML 会議録（令和2年〜令和6年）
  const framesets = parseListPage(listHtml, year);

  for (const fs of framesets) {
    const indexUrl = buildIndexUrl(fs.framesetUrl);
    const indexHtml = await fetchShiftJisPage(indexUrl);
    if (!indexHtml) continue;

    const sessions = parseIndexPage(indexHtml, indexUrl, fs.year);

    // フレームセットファイル名から基本情報を取得
    const filename = fs.framesetUrl.split("/").pop() ?? "";
    const fsInfo = parseFramesetFilename(filename.replace(/\.html$/i, ""));
    const month = fsInfo?.month ?? 0;

    for (const session of sessions) {
      // 外部 ID: フレームセットファイルベース + 号数
      const baseName = filename.replace(/\.html$/i, "");
      const externalId = `${baseName}_${String(session.sessionNum).padStart(2, "0")}`;

      // タイトルは後で本文から抽出するが、ここでは仮タイトルを設定
      const monthStr = String(month).padStart(2, "0");
      const kindLabel = fs.meetingType === "extraordinary" ? "臨時会" : "定例会";
      const title = `${year}年${monthStr}月${kindLabel} 第${session.sessionNum}号`;

      results.push({
        sourceUrl: session.contentUrl,
        title,
        heldOn: session.heldOn,
        meetingType: fs.meetingType,
        externalId,
        format: "html",
      });
    }
  }

  // PDF 会議録（令和7年〜・平成30年の一部）
  const pdfLinks = parsePdfLinksFromListPage(listHtml, year);

  for (const pdf of pdfLinks) {
    const filename = pdf.pdfUrl.split("/").pop() ?? "";
    const externalId = filename.replace(/\.pdf$/i, "");
    const title = pdf.linkText.replace(/【未定稿】/, "").trim();

    results.push({
      sourceUrl: pdf.pdfUrl,
      title,
      heldOn: pdf.heldOn,
      meetingType: pdf.meetingType,
      externalId,
      format: "pdf",
      linkText: pdf.linkText,
    });
  }

  return results;
}
