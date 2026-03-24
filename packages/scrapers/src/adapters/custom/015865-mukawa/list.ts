/**
 * むかわ町議会 — list フェーズ
 *
 * 一覧ページ http://www.town.mukawa.lg.jp/2872.htm から
 * 全 PDF リンクを収集する。
 *
 * 単一ページに全年度分のテーブルが掲載されており、ページネーションなし。
 * テーブルの行単位で年度ラベルと PDF リンクを対応付ける。
 */

import {
  BASE_ORIGIN,
  detectMeetingType,
  delay,
  eraYearToSeireki,
  fetchPage,
} from "./shared";

export interface MukawaSessionInfo {
  /** 会議タイトル */
  title: string;
  /** 開催日 YYYY-MM-DD（取得できない場合は null） */
  heldOn: string | null;
  /** PDF の絶対 URL */
  pdfUrl: string;
  /** 会議種別 */
  meetingType: string;
  /** PDF ファイル名（externalId 生成用） */
  fileName: string;
}

const LIST_URL = `${BASE_ORIGIN}/2872.htm`;
const INTER_REQUEST_DELAY_MS = 1500;

/**
 * 年度ラベル文字列から西暦年を抽出する。
 * 例: "令和7年" → 2025, "平成30年" → 2018
 */
export function parseEraYear(label: string): number | null {
  const match = label.match(/([令平]和|昭和|平成)(元|\d+)年/);
  if (!match) return null;
  const eraName = match[1]!;
  const yearStr = match[2]!;
  const eraCode = eraName === "令和" ? "R" : "H";
  return eraYearToSeireki(eraCode, yearStr);
}

/**
 * PDF ファイル名から開催日を推定する。
 *
 * 対応パターン:
 * - `20250310-R07-1teirei.pdf` → 2025-03-10
 * - `20230309-14-R05-1teirei.pdf` → 2023-03-09
 * - `200327-R02-2rinnji.pdf` → 2020-03-27
 * - `R040307-R04.1tei.pdf` → 2022-03-07
 * - `H300306-H30-1teirei.pdf` → 2018-03-06
 * - `H27-1teirei.pdf` → null（日付部分なし）
 */
export function extractDateFromFilename(fileName: string): string | null {
  // パターン1: 8桁 YYYYMMDD で始まる
  const p1 = fileName.match(/^(\d{4})(\d{2})(\d{2})-/);
  if (p1) {
    return `${p1[1]}-${p1[2]}-${p1[3]}`;
  }

  // パターン2: 6桁 YYMMDD で始まる（元号なし、令和前提で判断が難しいため年省略）
  // 例: 200327 → 令和2年03月27日 → 2020-03-27
  const p2 = fileName.match(/^(\d{6})-/);
  if (p2) {
    const s = p2[1]!;
    const yy = parseInt(s.slice(0, 2), 10);
    const mm = s.slice(2, 4);
    const dd = s.slice(4, 6);
    // 20 台は 2020年代 (令和2〜)
    const year = 2000 + yy;
    return `${year}-${mm}-${dd}`;
  }

  // パターン3: R/H + 6桁 YYMMDD で始まる
  // 例: R040307 → 令和4年03月07日 → 2022-03-07
  // 例: H300306 → 平成30年03月06日 → 2018-03-06
  const p3 = fileName.match(/^([RH])(\d{2})(\d{2})(\d{2})-/);
  if (p3) {
    const era = p3[1]!;
    const yy = parseInt(p3[2]!, 10);
    const mm = p3[3]!;
    const dd = p3[4]!;
    const year = eraYearToSeireki(era, String(yy));
    if (year === null) return null;
    return `${year}-${mm}-${dd}`;
  }

  return null;
}

/**
 * リンクテキストから会議タイトルを組み立てる。
 * 例: "第1回定例会" + 年度 "令和7年" → "令和7年 第1回定例会"
 */
function buildTitle(eraLabel: string, linkText: string): string {
  const base = linkText.replace(/\s+/g, " ").trim();
  if (!base) return eraLabel;
  return `${eraLabel} ${base}`.trim();
}

/**
 * 一覧ページの HTML から PDF セッション情報をパースする（純粋関数）。
 *
 * テーブル行を走査し、年度ラベルと PDF リンクを対応付ける。
 * 同一 PDF の重複リンクを除去する。
 */
export function parseListPage(html: string): MukawaSessionInfo[] {
  const sessions: MukawaSessionInfo[] = [];
  const seenUrls = new Set<string>();

  // <tr> ブロックを抽出
  const trPattern = /<tr[\s\S]*?<\/tr>/gi;
  const trMatches = [...html.matchAll(trPattern)];

  // 年度ラベル追跡（rowspan 対応のためループ外で保持）
  let currentEraLabel = "";

  for (const trMatch of trMatches) {
    const trHtml = trMatch[0]!;

    // 年度ラベルセル（水色背景）を検出
    const eraMatch = trHtml.match(
      /<td[^>]*background-color:\s*#c6d9f0[^>]*>([\s\S]*?)<\/td>/i,
    );
    if (eraMatch) {
      const labelText = eraMatch[1]!.replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim();
      if (labelText) currentEraLabel = labelText;
    }

    // PDF リンクを持つセル（オレンジ背景）を検出
    const pdfCellPattern =
      /<td[^>]*background-color:\s*#fdeada[^>]*>([\s\S]*?)<\/td>/gi;
    for (const cellMatch of trHtml.matchAll(pdfCellPattern)) {
      const cellHtml = cellMatch[1]!;

      // セル内の PDF リンクを全て抽出
      const linkPattern = /<a\s[^>]*href="([^"]+\.pdf)"[^>]*>([\s\S]*?)<\/a>/gi;
      for (const linkMatch of cellHtml.matchAll(linkPattern)) {
        let href = linkMatch[1]!;
        const linkText = linkMatch[2]!.replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim();

        // 絶対 URL に変換
        if (href.startsWith("/")) {
          href = `${BASE_ORIGIN}${href}`;
        } else if (!href.startsWith("http")) {
          href = `${BASE_ORIGIN}/${href}`;
        }

        if (seenUrls.has(href)) continue;
        seenUrls.add(href);

        const fileName = href.split("/").pop() ?? href;
        const title = buildTitle(currentEraLabel, linkText);
        const meetingType = detectMeetingType(title);
        const heldOn = extractDateFromFilename(fileName);

        sessions.push({
          title,
          heldOn,
          pdfUrl: href,
          meetingType,
          fileName,
        });
      }
    }
  }

  return sessions;
}

/**
 * 指定年の会議録セッション一覧を取得する。
 *
 * 1. 一覧ページから全 PDF リンクを取得
 * 2. ファイル名から推定した開催日で対象年をフィルタリング
 * 3. 年度ラベルの西暦年でもフィルタリング（開催日不明の場合）
 */
export async function fetchDocumentList(year: number): Promise<MukawaSessionInfo[]> {
  await delay(INTER_REQUEST_DELAY_MS);

  const html = await fetchPage(LIST_URL);
  if (!html) return [];

  const allSessions = parseListPage(html);

  return allSessions.filter((s) => {
    if (s.heldOn) {
      const heldYear = parseInt(s.heldOn.slice(0, 4), 10);
      return heldYear === year;
    }
    // 開催日不明の場合はタイトルの年度ラベルで判定
    const labelYear = parseEraYear(s.title);
    return labelYear === year;
  });
}
