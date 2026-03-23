/**
 * 藤崎町議会 — list フェーズ
 *
 * 年度別ページの HTML テーブルから会議録 PDF リンクを抽出する。
 *
 * テーブル構造:
 * - 各 <tr> が1つの会期（定例会 or 臨時会）に対応
 * - 左 <td>: 会期名（「令和5年第1回定例会」）
 * - 右 <td>: 番号付き PDF リンクのリスト
 * - スクレイピング対象は「会議録」を含むリンクのみ
 */

import { BASE_ORIGIN, buildYearPageUrl, fetchPage } from "./shared";

export interface FujisakiMeeting {
  /** PDF の絶対 URL */
  pdfUrl: string;
  /** 会議タイトル（会期名 + 会議録種別） */
  title: string;
  /** 開催日 YYYY-MM-DD（PDF ファイル名のタイムスタンプから推定、不明なら年度開始日） */
  heldOn: string;
  /** 会期名（例: "令和5年第1回定例会"） */
  session: string;
  /** PDF ファイル名（拡張子なし）— externalId の一部に使用 */
  fileKey: string;
}

/**
 * PDF ファイル名から日付を推定する。
 *
 * パターン1: YYYYMMDD-HHMMSS.pdf (例: 20230222-092339.pdf → 2023-02-22)
 * パターン2: それ以外 → null
 */
export function parseDateFromFilename(filename: string): string | null {
  const match = filename.match(/^(\d{4})(\d{2})(\d{2})-\d{6}$/);
  if (!match) return null;

  const year = parseInt(match[1]!, 10);
  const month = parseInt(match[2]!, 10);
  const day = parseInt(match[3]!, 10);

  if (month < 1 || month > 12 || day < 1 || day > 31) return null;

  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

/**
 * 会期名から年度を推定してフォールバック日付を返す。
 *
 * 例: "令和5年第1回定例会" → "2023-01-01"
 */
export function fallbackDateFromSession(session: string): string | null {
  const match = session.match(/(令和|平成)(元|\d+)年/);
  if (!match) return null;

  const eraYear = match[2] === "元" ? 1 : parseInt(match[2]!, 10);
  let westernYear: number;
  if (match[1] === "令和") westernYear = eraYear + 2018;
  else if (match[1] === "平成") westernYear = eraYear + 1988;
  else return null;

  return `${westernYear}-01-01`;
}

/**
 * 年度別ページの HTML から会議録 PDF リンクを抽出する（テスト可能な純粋関数）。
 *
 * 1. <table> 内の各 <tr> をイテレーション
 * 2. 左 <td> から会期名を取得
 * 3. 右 <td> の <a> タグから PDF リンクを抽出
 * 4. リンクテキスト/title属性に「会議録」を含むもののみフィルタリング
 */
export function parseYearPage(html: string): FujisakiMeeting[] {
  const results: FujisakiMeeting[] = [];

  // <tr> を抽出（テーブル行ごとに処理）
  const trPattern = /<tr[^>]*>([\s\S]*?)<\/tr>/gi;

  for (const trMatch of html.matchAll(trPattern)) {
    const trContent = trMatch[1]!;

    // <td> を抽出
    const tdPattern = /<td[^>]*>([\s\S]*?)<\/td>/gi;
    const tds: string[] = [];
    for (const tdMatch of trContent.matchAll(tdPattern)) {
      tds.push(tdMatch[1]!);
    }

    if (tds.length < 2) continue;

    // 左 <td>: 会期名を抽出
    const sessionTd = tds[0]!;
    const sessionText = sessionTd
      .replace(/<[^>]+>/g, "")
      .replace(/&nbsp;/g, " ")
      .replace(/\s+/g, " ")
      .trim();

    // 会期名の最初の行（括弧付き補足の前）を取得
    // 例: "令和5年第1回定例会 (令和5年3月定例会)" → "令和5年第1回定例会"
    const sessionName = sessionText.split(/\s*[（(]/)[0]!.trim();
    if (!sessionName) continue;

    // 右 <td>: PDF リンクを抽出
    const linkTd = tds[1]!;
    const linkPattern =
      /<a[^>]+href="([^"]*\.pdf)"[^>]*>([\s\S]*?)<\/a>/gi;

    for (const linkMatch of linkTd.matchAll(linkPattern)) {
      const href = linkMatch[1]!;
      const fullTag = linkMatch[0]!;
      const titleAttrMatch = fullTag.match(/title="([^"]*)"/i);
      const titleAttr = titleAttrMatch ? titleAttrMatch[1]! : "";
      const linkText = linkMatch[2]!.replace(/<[^>]+>/g, "").trim();

      // 「会議録」を含むリンクのみを対象にする
      if (!linkText.includes("会議録") && !titleAttr.includes("会議録"))
        continue;

      // PDF の絶対 URL を構築
      let pdfUrl: string;
      if (href.startsWith("http")) {
        pdfUrl = href;
      } else if (href.startsWith("/")) {
        pdfUrl = `${BASE_ORIGIN}${href}`;
      } else {
        pdfUrl = `${BASE_ORIGIN}/${href}`;
      }

      // ファイルキーを抽出
      const fileKeyMatch = href.match(/([^/]+)\.pdf$/i);
      const fileKey = fileKeyMatch ? fileKeyMatch[1]! : href;

      // 日付推定: ファイル名からタイムスタンプ → セッション名からフォールバック
      const heldOn =
        parseDateFromFilename(fileKey) ?? fallbackDateFromSession(sessionName);
      if (!heldOn) continue;

      // タイトルを構築: 会期名 + リンクテキストからファイル情報を除去
      // 実際の形式: "令和7年第1回臨時会会議録.pdf [ 369 KB pdfファイル]"
      const cleanLinkText = linkText
        .replace(/\.pdf\s*\[\s*[\d.]+\s*KB\s+pdfファイル\]/i, "")
        .replace(/\s*\[[\d.]+\s*KB\s+pdfファイル\]/i, "")
        .trim();
      const title = `${sessionName} ${cleanLinkText}`;

      results.push({ pdfUrl, title, heldOn, session: sessionName, fileKey });
    }
  }

  return results;
}

/**
 * 指定年の全会議録 PDF リンクを取得する。
 */
export async function fetchMeetingList(
  year: number,
): Promise<FujisakiMeeting[]> {
  const url = buildYearPageUrl(year);
  if (!url) return [];

  const html = await fetchPage(url);
  if (!html) return [];

  return parseYearPage(html);
}
