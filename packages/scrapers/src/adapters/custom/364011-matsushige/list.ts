/**
 * 松茂町議会 — list フェーズ
 *
 * 会議録一覧ページ（単一ページ）から全 PDF リンクを収集し、
 * 目次 PDF を除いた各会議の情報を返す。
 *
 * HTML 構造:
 *   <h2>令和７年</h2>
 *     <h3>第４回定例会</h3>
 *       <a href="file_contents/20251204.pdf">令和７年第４回定例会　１２月４日[PDF：○○KB]</a>
 *       ...
 *     <h3>第２回臨時会</h3>
 *       ...
 *
 * - h2 タグから年度（和暦）を取得
 * - h3 タグから会議種別を取得
 * - a タグのリンクテキストから開催日（月日）を取得
 * - 「会議録目次」を含むリンクは除外
 */

import {
  BASE_ORIGIN,
  LIST_URL,
  detectMeetingType,
  parseWarekiYear,
  buildDateString,
  fetchPage,
  delay,
} from "./shared";

export interface MatsushigePdfRecord {
  /** 会議タイトル（例: "令和７年第４回定例会　１２月４日"） */
  title: string;
  /** 開催日 YYYY-MM-DD（解析できない場合は null） */
  heldOn: string | null;
  /** PDF の絶対 URL */
  pdfUrl: string;
  /** 会議種別 */
  meetingType: "plenary" | "extraordinary" | "committee";
}

const INTER_REQUEST_DELAY_MS = 1000;

/**
 * 一覧ページから PDF レコードを収集する。
 * 目次 PDF は除外する。
 */
export async function fetchPdfList(
  year: number
): Promise<MatsushigePdfRecord[]> {
  const html = await fetchPage(LIST_URL);
  if (!html) return [];

  await delay(INTER_REQUEST_DELAY_MS);

  return parseListPage(html, year);
}

/**
 * 一覧ページ HTML から指定年の PDF レコードを抽出する。
 * テスト用に export する。
 */
export function parseListPage(
  html: string,
  filterYear?: number
): MatsushigePdfRecord[] {
  const results: MatsushigePdfRecord[] = [];

  // h2, h3, a タグを順番に処理するためにイテレーション
  // HTML をトークン列として処理する
  const tokenPattern =
    /<h2[^>]*>([\s\S]*?)<\/h2>|<h3[^>]*>([\s\S]*?)<\/h3>|<a\s[^>]*href="([^"]*\.pdf)"[^>]*>([\s\S]*?)<\/a>/gi;

  let currentYear: number | null = null;
  let currentSession = "";

  let m: RegExpExecArray | null;
  while ((m = tokenPattern.exec(html)) !== null) {
    if (m[1] !== undefined) {
      // h2 タグ: 年度
      const h2Text = m[1].replace(/<[^>]+>/g, "").trim();
      currentYear = parseWarekiYear(h2Text);
      currentSession = "";
    } else if (m[2] !== undefined) {
      // h3 タグ: 会議種別
      currentSession = m[2].replace(/<[^>]+>/g, "").trim();
    } else if (m[3] !== undefined && m[4] !== undefined) {
      // a タグ: PDF リンク
      if (currentYear === null) continue;

      // 指定年フィルタ
      if (filterYear !== undefined && currentYear !== filterYear) continue;

      const href = m[3].trim();
      const rawText = m[4].replace(/<[^>]+>/g, "").trim();

      // ファイルサイズ表記を除去: "[PDF：○○KB]" や "[PDF：○○.○MB]"
      const cleanText = rawText.replace(/\[PDF[：:][^\]]*\]/g, "").trim();

      if (!cleanText) continue;

      // 目次 PDF はスキップ
      if (cleanText.includes("目次")) continue;

      // 絶対 URL に変換
      let pdfUrl: string;
      if (href.startsWith("http")) {
        pdfUrl = href;
      } else {
        // 相対パス: "file_contents/xxx.pdf" → ベース URL で解決
        pdfUrl = `${BASE_ORIGIN}/${href.replace(/^\//, "")}`;
      }

      // 開催日を抽出（リンクテキスト中の月日）
      const heldOn = buildDateString(currentYear, cleanText);

      // タイトルを組み立てる
      const title = currentSession
        ? `${cleanText}`
        : cleanText;

      results.push({
        title,
        heldOn,
        pdfUrl,
        meetingType: detectMeetingType(currentSession || cleanText),
      });
    }
  }

  return results;
}
