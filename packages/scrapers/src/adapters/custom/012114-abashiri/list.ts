/**
 * 網走市議会 会議録 — list フェーズ
 *
 * 14 の一覧ページから PDF リンクとメタ情報を収集する。
 *
 * 定例会・臨時会ページの構造（dl/dd パターン）:
 *   <h3>令和7年　定例会</h3>
 *   <dl>
 *     <dt>年月日</dt>
 *     <dd><a href="/uploaded/attachment/13890.pdf">7年第3回定例会 [PDFファイル／1.52MB]</a></dd>
 *     <dd>令和7年9月</dd>
 *   </dl>
 *
 * 委員会ページの構造（table パターン）:
 *   <h2>令和7年総務経済委員会</h2>
 *   <table>
 *     <tr>
 *       <td><a href="/uploaded/attachment/13850.pdf">令和7年10月31日 [PDFファイル／70KB]</a></td>
 *       <td>案件内容</td>
 *     </tr>
 *   </table>
 */

import {
  BASE_ORIGIN,
  LIST_PAGES,
  eraToWesternYear,
  fetchPage,
  type PageDef,
} from "./shared";

export interface AbashiriMeeting {
  /** PDF の完全 URL */
  pdfUrl: string;
  /** 会議タイトル（例: "令和7年第3回定例会", "総務経済委員会 令和7年10月31日"） */
  title: string;
  /** 開催日 YYYY-MM-DD（日付が月のみの場合は YYYY-MM-01） */
  heldOn: string;
  /** 会議種別カテゴリ（plenary / extraordinary / committee） */
  category: string;
}

/**
 * 定例会・臨時会ページの HTML から PDF リンクを抽出する。
 *
 * dd 要素が交互に [PDFリンク, 日付テキスト] で並ぶ構造。
 * h3 見出しで年度セクションを識別する。
 */
export function parsePlenaryPage(
  html: string,
  pageDef: PageDef,
): AbashiriMeeting[] {
  const results: AbashiriMeeting[] = [];

  // h3 で年度セクションを分割
  const h3Pattern = /<h3[^>]*>([\s\S]*?)<\/h3>/gi;
  const h3Matches = [...html.matchAll(h3Pattern)];

  for (let i = 0; i < h3Matches.length; i++) {
    const h3Match = h3Matches[i]!;
    const startIdx = h3Match.index! + h3Match[0].length;
    const endIdx =
      i + 1 < h3Matches.length ? h3Matches[i + 1]!.index! : html.length;
    const sectionHtml = html.slice(startIdx, endIdx);

    // PDF リンクと直後の日付テキスト dd を交互に抽出
    // パターン: <dd><a href="...pdf">テキスト</a></dd> <dd>令和X年Y月</dd>
    const ddPattern =
      /<dd[^>]*>([\s\S]*?)<\/dd>/gi;
    const ddMatches = [...sectionHtml.matchAll(ddPattern)];

    for (let j = 0; j < ddMatches.length; j++) {
      const ddContent = ddMatches[j]![1]!;

      // PDF リンクを含む dd を探す
      const linkMatch = ddContent.match(
        /<a[^>]+href="(\/uploaded\/attachment\/\d+\.pdf)"[^>]*>([\s\S]*?)<\/a>/i,
      );
      if (!linkMatch) continue;

      const pdfPath = linkMatch[1]!;
      const linkText = linkMatch[2]!.replace(/<[^>]+>/g, "").trim();

      // リンクテキストからタイトル部分を抽出（[PDFファイル...] を除去）
      const titlePart = linkText.replace(/\s*\[PDF[^\]]*\]/i, "").trim();

      // 次の dd から日付を取得
      let heldOn = "";
      if (j + 1 < ddMatches.length) {
        const nextDd = ddMatches[j + 1]![1]!.replace(/<[^>]+>/g, "").trim();
        heldOn = parseDateFromText(nextDd);
      }

      // タイトルに和暦の年情報を補完
      const fullTitle = titlePart.match(/^(令和|平成)/)
        ? titlePart
        : `令和${titlePart}`;

      results.push({
        pdfUrl: `${BASE_ORIGIN}${pdfPath}`,
        title: fullTitle,
        heldOn,
        category: pageDef.category,
      });
    }
  }

  // h3 がない場合（h2 ベースの構造の可能性）
  if (h3Matches.length === 0) {
    results.push(...parsePlenaryFallback(html, pageDef));
  }

  return results;
}

/**
 * h3 がないページのフォールバックパーサー。
 * h2 + dd パターンを試みる。
 */
function parsePlenaryFallback(
  html: string,
  pageDef: PageDef,
): AbashiriMeeting[] {
  const results: AbashiriMeeting[] = [];

  const ddPattern = /<dd[^>]*>([\s\S]*?)<\/dd>/gi;
  const ddMatches = [...html.matchAll(ddPattern)];

  for (let j = 0; j < ddMatches.length; j++) {
    const ddContent = ddMatches[j]![1]!;
    const linkMatch = ddContent.match(
      /<a[^>]+href="(\/uploaded\/attachment\/\d+\.pdf)"[^>]*>([\s\S]*?)<\/a>/i,
    );
    if (!linkMatch) continue;

    const pdfPath = linkMatch[1]!;
    const linkText = linkMatch[2]!.replace(/<[^>]+>/g, "").trim();
    const titlePart = linkText.replace(/\s*\[PDF[^\]]*\]/i, "").trim();

    let heldOn = "";
    if (j + 1 < ddMatches.length) {
      const nextDd = ddMatches[j + 1]![1]!.replace(/<[^>]+>/g, "").trim();
      heldOn = parseDateFromText(nextDd);
    }

    const fullTitle = titlePart.match(/^(令和|平成)/)
      ? titlePart
      : `令和${titlePart}`;

    results.push({
      pdfUrl: `${BASE_ORIGIN}${pdfPath}`,
      title: fullTitle,
      heldOn,
      category: pageDef.category,
    });
  }

  return results;
}

/**
 * 委員会ページの HTML から PDF リンクを抽出する。
 *
 * table の各行が1会議に対応し、td 内の a タグに日付と PDF URL が含まれる。
 * h2 見出しで年度セクションを識別する。
 */
export function parseCommitteePage(
  html: string,
  pageDef: PageDef,
): AbashiriMeeting[] {
  const results: AbashiriMeeting[] = [];

  // PDF リンクを含む td を探す
  const linkPattern =
    /<a[^>]+href="(\/uploaded\/attachment\/\d+\.pdf)"[^>]*>([\s\S]*?)<\/a>/gi;

  for (const match of html.matchAll(linkPattern)) {
    const pdfPath = match[1]!;
    const linkText = match[2]!.replace(/<[^>]+>/g, "").trim();

    // リンクテキストから日付を抽出（委員会: "令和7年10月31日 [PDFファイル／70KB]"）
    const dateText = linkText.replace(/\s*\[PDF[^\]]*\]/i, "").trim();
    const heldOn = parseDateFromText(dateText);

    const title = `${pageDef.label} ${dateText}`;

    results.push({
      pdfUrl: `${BASE_ORIGIN}${pdfPath}`,
      title,
      heldOn,
      category: pageDef.category,
    });
  }

  return results;
}

/**
 * 日付テキストから YYYY-MM-DD を返す。
 *
 * 対応パターン:
 *   "令和7年9月" → "2025-09-01"
 *   "令和7年10月31日" → "2025-10-31"
 *   "平成31年3月" → "2019-03-01"
 */
export function parseDateFromText(text: string): string {
  // 年月日パターン
  const fullMatch = text.match(/(令和|平成)(元|\d+)年(\d+)月(\d+)日/);
  if (fullMatch) {
    const year = eraToWesternYear(`${fullMatch[1]}${fullMatch[2]}年`);
    if (!year) return "";
    const month = parseInt(fullMatch[3]!, 10);
    const day = parseInt(fullMatch[4]!, 10);
    return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
  }

  // 年月パターン（日なし）
  const monthMatch = text.match(/(令和|平成)(元|\d+)年(\d+)月/);
  if (monthMatch) {
    const year = eraToWesternYear(`${monthMatch[1]}${monthMatch[2]}年`);
    if (!year) return "";
    const month = parseInt(monthMatch[3]!, 10);
    return `${year}-${String(month).padStart(2, "0")}-01`;
  }

  return "";
}

/**
 * 一覧ページの HTML をパースして PDF リンクを返す。
 * ページの種別（plenary/committee）に応じてパーサーを切り替える。
 */
export function parseListPage(
  html: string,
  pageDef: PageDef,
): AbashiriMeeting[] {
  if (pageDef.category === "committee") {
    return parseCommitteePage(html, pageDef);
  }
  return parsePlenaryPage(html, pageDef);
}

/**
 * 指定年の全 PDF リンクを取得する。
 * 全一覧ページを巡回し、対象年のエントリのみ返す。
 */
export async function fetchMeetingList(
  year: number,
): Promise<AbashiriMeeting[]> {
  const allMeetings: AbashiriMeeting[] = [];

  for (const pageDef of LIST_PAGES) {
    const url = `${BASE_ORIGIN}${pageDef.url}`;
    const html = await fetchPage(url);
    if (!html) continue;

    const meetings = parseListPage(html, pageDef);
    allMeetings.push(...meetings);
  }

  // 対象年でフィルタ
  return allMeetings.filter((m) => {
    if (!m.heldOn) return false;
    const meetingYear = parseInt(m.heldOn.slice(0, 4), 10);
    return meetingYear === year;
  });
}
