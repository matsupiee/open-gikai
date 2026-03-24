/**
 * 大江町議会 — list フェーズ
 *
 * トップページから年度別ページの URL を収集し、
 * 各年度ページから PDF リンクとリンクテキストを取得する。
 *
 * ページ構造:
 *   トップ → 年度別ページ（/chougikai_kaigiroku/{ID}）→ PDF リンク
 *
 * リンクテキスト形式:
 *   第{回数}回{会議種別}（令和{年}年{月}月{日}日〜{日}日）
 *   例: 第1回定例会（令和6年3月11日～22日）
 */

import { BASE_ORIGIN, fetchPage, parseDateFromText } from "./shared";

export interface OeMeeting {
  pdfUrl: string;
  title: string;
  heldOn: string;
  sessionName: string;
}

/**
 * トップページ HTML から年度別ページの URL を抽出する（テスト可能な純粋関数）。
 *
 * href が /chougikai_kaigiroku/{数字ID} 形式のリンクを対象とする。
 */
export function parseYearPageUrls(html: string): string[] {
  const urls: string[] = [];
  const pattern =
    /href="(\/government\/chousei\/council\/chougikai_kaigiroku\/\d+)"/gi;

  for (const match of html.matchAll(pattern)) {
    const path = match[1]!;
    const url = `${BASE_ORIGIN}${path}`;
    if (!urls.includes(url)) {
      urls.push(url);
    }
  }

  return urls;
}

/**
 * 年度ページ HTML から PDF リンク情報を抽出する（テスト可能な純粋関数）。
 *
 * リンクテキストから会議名・日付を取得し、
 * year が指定された場合はその年に該当するもののみ返す。
 */
export function parseYearPage(
  html: string,
  year?: number,
): OeMeeting[] {
  const meetings: OeMeeting[] = [];

  // /files/original/*.pdf のリンクを抽出
  // img タグを含む場合もあるため [\s\S]*? でマッチ
  const linkPattern =
    /<a[^>]+href="(\/files\/original\/[^"]+\.pdf)"[^>]*>([\s\S]*?)<\/a>/gi;

  for (const match of html.matchAll(linkPattern)) {
    const href = match[1]!;
    // HTML タグ・改行・余分な空白を除去してリンクテキストを取得
    const linkText = match[2]!
      .replace(/<[^>]+>/g, "")
      .replace(/\s+/g, " ")
      .trim();

    if (!linkText) continue;

    const heldOn = parseDateFromText(linkText);
    if (!heldOn) continue;

    // year フィルタ
    if (year !== undefined) {
      const heldYear = parseInt(heldOn.split("-")[0]!, 10);
      if (heldYear !== year) continue;
    }

    const pdfUrl = `${BASE_ORIGIN}${href}`;

    // タイトル: リンクテキストからファイルサイズ表記を除去
    const title = linkText
      .replace(/PDF[:：]\s*[\d.]+\s*(MB|KB|kB)/gi, "")
      .replace(/\s*[\(（]PDF\s*[）\)]/gi, "")
      .trim();

    // セッション名: 括弧内の日付より前の部分
    const sessionNameMatch = title.match(/^([^（(]+)/);
    const sessionName = sessionNameMatch ? sessionNameMatch[1]!.trim() : title;

    meetings.push({ pdfUrl, title, heldOn, sessionName });
  }

  return meetings;
}

/**
 * 指定年の全会議録 PDF 一覧を取得する。
 *
 * baseUrl がトップページの URL。
 * 1. トップページから年度別ページ URL を収集
 * 2. 各年度ページから PDF リンクを収集
 * 3. 対象年でフィルタ
 */
export async function fetchMeetingList(
  baseUrl: string,
  year: number,
): Promise<OeMeeting[]> {
  const topHtml = await fetchPage(baseUrl);
  if (!topHtml) return [];

  const yearPageUrls = parseYearPageUrls(topHtml);
  if (yearPageUrls.length === 0) return [];

  const results: OeMeeting[] = [];

  for (const yearPageUrl of yearPageUrls) {
    const yearHtml = await fetchPage(yearPageUrl);
    if (!yearHtml) continue;

    const meetings = parseYearPage(yearHtml, year);
    results.push(...meetings);

    // 対象年のデータが見つかったらそれ以上の年度ページは不要
    // (年度ページは新しい順に並んでいるため、古い年度に対象年データは存在しない)
    if (meetings.length > 0) break;
  }

  return results;
}
