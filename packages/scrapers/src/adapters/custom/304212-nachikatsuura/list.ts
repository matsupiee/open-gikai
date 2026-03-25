/**
 * 那智勝浦町議会 — list フェーズ
 *
 * スクレイピング戦略:
 * 1. info/1531 ページから現在年度の PDF リンクを収集する
 * 2. 過去年度の PDF を命名規則 (kaigirokuR{yy}-{mm}-{n}.pdf) から推定取得する
 *    - {yy}: 01（令和元年）〜 現在
 *    - {mm}: 03, 06, 09, 12（定例会開催月）
 *    - {n}: 1 から連番、404 が返ったら次の月へ
 *
 * 各 PDF が fetchDetail の1レコードに対応する。
 */

import {
  BASE_ORIGIN,
  LIST_URL,
  detectMeetingType,
  parseReiwaCode,
  fetchPage,
  delay,
} from "./shared";

export interface NachikatsuuraSessionInfo {
  /** 会議タイトル（例: "令和6年 第1回（3月）定例会 第1日"） */
  title: string;
  /** 開催日 YYYY-MM-DD（PDF ファイル名からは不明のため null） */
  heldOn: string | null;
  /** PDF の絶対 URL */
  pdfUrl: string;
  /** 会議種別 */
  meetingType: string;
  /** ファイル名（externalId 生成用） */
  fileName: string;
}

const INTER_REQUEST_DELAY_MS = 1500;

/** 定例会の開催月 */
const PLENARY_MONTHS = ["03", "06", "09", "12"] as const;

/**
 * PDF URL から令和年号コードを生成する。
 * 令和1年 → "R01", 令和6年 → "R06"
 */
function reiwaToCode(reiwaYear: number): string {
  return `R${String(reiwaYear).padStart(2, "0")}`;
}

/**
 * PDF ファイル名からタイトルを組み立てる。
 *
 * ファイル名例: kaigirokuR06-03-1.pdf
 * → 西暦: 2024, 月: 03, 日数: 1
 * → "令和6年 第1回（3月）定例会 第1日"
 */
export function buildTitleFromFileName(fileName: string): string | null {
  // kaigirokuR{yy}-{mm}-{n}.pdf
  const m = fileName.match(/kaigiroku(R\d{1,2})-(\d{2})-(\d+)\.pdf$/i);
  if (!m) return null;

  const reiwaCode = m[1]!;
  const month = m[2]!;
  const day = m[3]!;

  const reiwaYearNum = parseInt(reiwaCode.replace(/^R/i, ""), 10);
  const reiwaLabel = reiwaYearNum === 1 ? "令和元年" : `令和${reiwaYearNum}年`;

  // 定例会の回数（3月=第1回, 6月=第2回, 9月=第3回, 12月=第4回）
  const monthNum = parseInt(month, 10);
  const sessionIndex = PLENARY_MONTHS.indexOf(month as (typeof PLENARY_MONTHS)[number]);
  const sessionNum = sessionIndex >= 0 ? sessionIndex + 1 : null;
  const sessionLabel = sessionNum !== null ? `第${sessionNum}回（${monthNum}月）定例会` : `${monthNum}月定例会`;

  return `${reiwaLabel} ${sessionLabel} 第${day}日`;
}

/**
 * 一覧ページ HTML から PDF リンクを抽出する（純粋関数）。
 *
 * リンクパターン: href="/div/gikai/pdf/kaigiroku/kaigirokuR{yy}-{mm}-{n}.pdf"
 */
export function parseListPage(html: string): NachikatsuuraSessionInfo[] {
  const results: NachikatsuuraSessionInfo[] = [];
  const seen = new Set<string>();

  const pdfPattern =
    /href="(\/div\/gikai\/pdf\/kaigiroku\/(kaigirokuR\d{1,2}-\d{2}-\d+\.pdf))"/gi;

  let m: RegExpExecArray | null;
  while ((m = pdfPattern.exec(html)) !== null) {
    const path = m[1]!;
    const fileName = m[2]!;
    const pdfUrl = `${BASE_ORIGIN}${path}`;

    if (seen.has(pdfUrl)) continue;
    seen.add(pdfUrl);

    const title = buildTitleFromFileName(fileName) ?? fileName;

    results.push({
      title,
      heldOn: null,
      pdfUrl,
      meetingType: detectMeetingType(title),
      fileName,
    });
  }

  return results;
}

/**
 * 現在年度の PDF を一覧ページから収集する。
 */
async function fetchCurrentYearSessions(): Promise<NachikatsuuraSessionInfo[]> {
  const html = await fetchPage(LIST_URL);
  if (!html) return [];
  return parseListPage(html);
}

/**
 * 指定の令和年・月について、日を1から順に試して存在する PDF URL を収集する。
 * 404 が返ったら打ち止め。
 */
async function probeMonth(
  reiwaCode: string,
  month: string,
  seenUrls: Set<string>,
): Promise<NachikatsuuraSessionInfo[]> {
  const results: NachikatsuuraSessionInfo[] = [];

  for (let day = 1; day <= 10; day++) {
    const fileName = `kaigiroku${reiwaCode}-${month}-${day}.pdf`;
    const pdfUrl = `${BASE_ORIGIN}/div/gikai/pdf/kaigiroku/${fileName}`;

    if (seenUrls.has(pdfUrl)) continue;

    // HEAD リクエストで存在確認
    let exists = false;
    try {
      const res = await fetch(pdfUrl, {
        method: "HEAD",
        signal: AbortSignal.timeout(15_000),
      });
      exists = res.ok;
    } catch {
      exists = false;
    }

    if (!exists) break;

    seenUrls.add(pdfUrl);
    const title = buildTitleFromFileName(fileName) ?? fileName;
    results.push({
      title,
      heldOn: null,
      pdfUrl,
      meetingType: detectMeetingType(title),
      fileName,
    });

    await delay(INTER_REQUEST_DELAY_MS);
  }

  return results;
}

/**
 * 指定年のセッション一覧を取得する。
 *
 * 1. info/1531 から現在年度の PDF リンクを収集
 * 2. 命名規則から過去年度 PDF を推定取得（対象年のみ）
 */
export async function fetchDocumentList(
  year: number,
): Promise<NachikatsuuraSessionInfo[]> {
  const seenUrls = new Set<string>();
  const allSessions: NachikatsuuraSessionInfo[] = [];

  // Step 1: 一覧ページから現在年度を収集
  const currentSessions = await fetchCurrentYearSessions();
  for (const s of currentSessions) {
    // 対象年でフィルタ
    const reiwaCodeMatch = s.fileName.match(/^kaigiroku(R\d{1,2})-/i);
    if (reiwaCodeMatch) {
      const westernYear = parseReiwaCode(reiwaCodeMatch[1]!);
      if (westernYear !== null && westernYear !== year) continue;
    }
    if (!seenUrls.has(s.pdfUrl)) {
      seenUrls.add(s.pdfUrl);
      allSessions.push(s);
    }
  }

  // Step 2: 対象年の令和年号コードを確定してURLを推定
  const reiwaYearNum = year - 2018;
  if (reiwaYearNum < 1) return allSessions; // 令和以前は対象外

  const reiwaCode = reiwaToCode(reiwaYearNum);

  for (const month of PLENARY_MONTHS) {
    await delay(INTER_REQUEST_DELAY_MS);
    const sessions = await probeMonth(reiwaCode, month, seenUrls);
    allSessions.push(...sessions);
  }

  return allSessions;
}
