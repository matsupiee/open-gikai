/**
 * 西伊豆町議会 — list フェーズ
 *
 * 2 ホップ構造:
 * 1. 一覧ページ (index.html) から ./78_{番号}.html への中間ページリンクを収集
 * 2. 各中間ページから /pdf/gikai/ 配下の PDF リンクを収集
 *
 * 一覧ページ: http://www.town.nishiizu.shizuoka.jp/kakuka/gikai/gijiroku/index.html
 * 中間ページ: http://www.town.nishiizu.shizuoka.jp/kakuka/gikai/gijiroku/78_{番号}.html
 * PDF:        http://www.town.nishiizu.shizuoka.jp/pdf/gikai/{西暦年}/{ファイル名}.pdf
 */

import {
  BASE_ORIGIN,
  LIST_PATH,
  detectMeetingType,
  fetchPage,
  parseJapaneseDate,
  parseWarekiToYear,
  delay,
} from "./shared";

/**
 * インデックスページに掲載されない古い年度のページ番号範囲マッピング。
 *
 * インデックスページは直近 ~12 件しかリンクしないため、
 * それ以前の年度は URL を直接構築してアクセスする必要がある。
 *
 * ページ番号は 78_{num}.html の {num} に対応する。
 * 各年の範囲は実際のサイトを確認して設定。
 */
const YEAR_PAGE_RANGES: Record<number, { from: number; to: number }> = {
  2021: { from: 60, to: 68 },
};

export interface NishiizuMeeting {
  /** PDF の絶対 URL */
  pdfUrl: string;
  /** 会議名（例: "令和7年第3回定例会"） */
  title: string;
  /** 開催日 YYYY-MM-DD（解析できない場合は null） */
  heldOn: string | null;
  /** 会議種別 */
  meetingType: string;
  /** 中間ページ番号（例: "127"） */
  pageNum: string;
}

const INTER_PAGE_DELAY_MS = 1500;

/**
 * 一覧ページ HTML から中間ページへのリンクを抽出する。
 * パターン: href="./78_{番号}.html"
 */
export function parseIndexLinks(
  html: string
): Array<{ pageNum: string; title: string; href: string }> {
  const results: Array<{ pageNum: string; title: string; href: string }> = [];
  const seen = new Set<string>();

  const pattern = /<a\s[^>]*href="(\.\/78_(\d+)\.html)"[^>]*>([^<]*)<\/a>/gi;

  let m: RegExpExecArray | null;
  while ((m = pattern.exec(html)) !== null) {
    const relHref = m[1]!;
    const pageNum = m[2]!;
    const title = m[3]!.replace(/\s+/g, " ").trim();

    if (seen.has(pageNum)) continue;
    seen.add(pageNum);

    const href = `${BASE_ORIGIN}/kakuka/gikai/gijiroku/${relHref.replace("./", "")}`;
    results.push({ pageNum, title, href });
  }

  return results;
}

/**
 * 中間ページ HTML から PDF リンクと開催日情報を抽出する。
 *
 * PDF リンク: href に /pdf/gikai/ を含む <a> タグ
 * 開催日: ページ内テキスト「○月○日」または「第一日（○月○日）」等
 */
export function parseIntermediatePage(
  html: string,
  sessionTitle: string,
  pageNum: string
): NishiizuMeeting[] {
  const results: NishiizuMeeting[] = [];
  const meetingType = detectMeetingType(sessionTitle);

  // PDF リンクを抽出
  const pdfPattern = /<a\s[^>]*href="([^"]*\/pdf\/gikai\/[^"]+\.pdf)"[^>]*>([^<]*)<\/a>/gi;
  const pdfLinks: Array<{ href: string; linkText: string }> = [];

  let m: RegExpExecArray | null;
  while ((m = pdfPattern.exec(html)) !== null) {
    const href = m[1]!.trim();
    const linkText = m[2]!.trim();
    // 絶対 URL に変換
    const pdfUrl = href.startsWith("http") ? href : `${BASE_ORIGIN}${href}`;
    pdfLinks.push({ href: pdfUrl, linkText });
  }

  if (pdfLinks.length === 0) return [];

  // ページ内テキストから開催日情報を収集
  // 「第一日（9月3日）」「第二日（9月4日）」などのパターン
  // または「令和7年7月9日」のような完全な和暦日付
  const plainText = html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ");

  // 完全な和暦日付（年月日）を試みる
  const yearFromTitle = parseWarekiToYear(sessionTitle);

  for (const { href: pdfUrl } of pdfLinks) {
    // リンクテキストまたは周辺テキストから日付を推定
    // まず PDF URL のファイル名から日付を試みる（例: nishigi20260120_01ringi.pdf → 2026-01-20）
    let heldOn: string | null = extractDateFromPdfFilename(pdfUrl, yearFromTitle);

    // 見つからない場合は、ページ本文から最初の和暦日付を探す
    if (!heldOn) {
      heldOn = parseJapaneseDate(plainText);
    }

    // それでも見つからない場合、「○月○日」パターン + 年タイトルから組み立て
    if (!heldOn && yearFromTitle) {
      const mdMatch = plainText.match(/(\d{1,2})月(\d{1,2})日/);
      if (mdMatch) {
        const month = String(Number(mdMatch[1]!)).padStart(2, "0");
        const day = String(Number(mdMatch[2]!)).padStart(2, "0");
        heldOn = `${yearFromTitle}-${month}-${day}`;
      }
    }

    results.push({
      pdfUrl,
      title: sessionTitle,
      heldOn,
      meetingType,
      pageNum,
    });
  }

  return results;
}

/**
 * PDF ファイル名から開催日を推測する。
 *
 * パターン例:
 *   nishigi20260120_01ringi.pdf → 2026-01-20
 *   nishigi20251222_05ringi.pdf → 2025-12-22
 *   nishigi1010_01ringi.pdf → MM-DD のみ（年は yearHint から補完）
 *   nishigi0709_01.pdf → MM-DD のみ（年は yearHint から補完）
 */
export function extractDateFromPdfFilename(
  pdfUrl: string,
  yearHint: number | null
): string | null {
  const filename = pdfUrl.split("/").pop() ?? "";

  // 8桁 YYYYMMDD パターン: nishigi20260120_01ringi.pdf
  const fullDateMatch = filename.match(/nishigi(\d{4})(\d{2})(\d{2})/);
  if (fullDateMatch) {
    const year = fullDateMatch[1]!;
    const month = fullDateMatch[2]!;
    const day = fullDateMatch[3]!;
    return `${year}-${month}-${day}`;
  }

  // 4桁 MMDD パターン: nishigi1010_01ringi.pdf, nishigi0709_01.pdf
  const shortDateMatch = filename.match(/nishigi(\d{2})(\d{2})/);
  if (shortDateMatch && yearHint) {
    const month = shortDateMatch[1]!;
    const day = shortDateMatch[2]!;
    // 月が 01〜12、日が 01〜31 の範囲内かチェック
    const monthNum = Number(month);
    const dayNum = Number(day);
    if (monthNum >= 1 && monthNum <= 12 && dayNum >= 1 && dayNum <= 31) {
      return `${yearHint}-${month}-${day}`;
    }
  }

  return null;
}

/**
 * 指定年の全 PDF リンクを取得する。
 *
 * 1. 一覧ページから中間ページ URL を収集
 * 2. 年フィルタリング（タイトルの和暦から西暦年を判定）
 * 3. 各中間ページから PDF リンクを収集
 * 4. インデックスページに掲載されない古い年度は YEAR_PAGE_RANGES から直接 URL を構築
 */
export async function fetchMeetingList(
  _baseUrl: string,
  year: number
): Promise<NishiizuMeeting[]> {
  const listUrl = `${BASE_ORIGIN}${LIST_PATH}`;
  const listHtml = await fetchPage(listUrl);
  if (!listHtml) return [];

  const indexLinks = parseIndexLinks(listHtml);

  // インデックスページにある対象年のリンクを絞り込む
  const linksForYear = indexLinks.filter(({ title }) => {
    const titleYear = parseWarekiToYear(title);
    return titleYear === null || titleYear === year;
  });

  // インデックスページに対象年のリンクがなく、既知の範囲マッピングがある場合は
  // URL を直接構築して補完する
  const hasIndexLinksForYear = indexLinks.some(
    ({ title }) => parseWarekiToYear(title) === year
  );

  if (!hasIndexLinksForYear && YEAR_PAGE_RANGES[year]) {
    const { from, to } = YEAR_PAGE_RANGES[year];
    for (let num = from; num <= to; num++) {
      const pageNum = String(num);
      const href = `${BASE_ORIGIN}/kakuka/gikai/gijiroku/78_${pageNum}.html`;
      // タイトルは中間ページを取得してから判明するため、仮タイトルとして年を使う
      linksForYear.push({ pageNum, title: "", href });
    }
  }

  const allMeetings: NishiizuMeeting[] = [];

  for (const { pageNum, title: indexTitle, href } of linksForYear) {
    await delay(INTER_PAGE_DELAY_MS);

    const intermediateHtml = await fetchPage(href);
    if (!intermediateHtml) continue;

    // 中間ページの <h1>/<h2> からタイトルを取得する（インデックスタイトルが空の場合）
    let sessionTitle = indexTitle;
    if (!sessionTitle) {
      const h1Match = intermediateHtml.match(/<h[12][^>]*>([\s\S]*?)<\/h[12]>/i);
      if (h1Match) {
        sessionTitle = h1Match[1]!.replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim();
      }
    }

    // セッションタイトルから年を判定してフィルタリング
    const titleYear = parseWarekiToYear(sessionTitle);
    if (titleYear !== null && titleYear !== year) continue;

    const meetings = parseIntermediatePage(intermediateHtml, sessionTitle, pageNum);

    for (const meeting of meetings) {
      // heldOn が判明している場合は年で追加フィルタリング
      if (meeting.heldOn) {
        const meetingYear = parseInt(meeting.heldOn.slice(0, 4), 10);
        if (meetingYear === year) {
          allMeetings.push(meeting);
        }
      } else if (titleYear === year || (titleYear === null && !indexTitle)) {
        // heldOn 不明だがタイトル年が一致、または直接 URL で取得したページ
        allMeetings.push(meeting);
      }
    }
  }

  return allMeetings;
}
