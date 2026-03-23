/**
 * 上砂川町議会 -- list フェーズ
 *
 * 3 階層構造をクロールして PDF URL を収集する:
 * 1. 年度コードを西暦年から生成
 * 2. 年度別一覧ページ (teirei/{code}/index.html, rinji/{code}/index.html) から
 *    各回の結果ページ URL を収集
 * 3. 各回の結果ページから PDF リンクを抽出
 */

import {
  BASE_ORIGIN,
  detectMeetingType,
  fetchPage,
  yearToNendoCodes,
  delay,
} from "./shared";

export interface KamisunagawaSessionInfo {
  /** 会議タイトル（例: "2024年第1回定例会"） */
  title: string;
  /** 開催日 YYYY-MM-DD */
  heldOn: string;
  /** PDF の絶対 URL */
  pdfUrl: string;
  /** 会議種別 */
  meetingType: string;
  /** 年度コード（例: "r6"） */
  nendoCode: string;
  /** 会議種別コード */
  sessionType: "teirei" | "rinji";
  /** ページ ID（数値文字列、例: "2222"） */
  pageId: string;
}

const INTER_PAGE_DELAY_MS = 1500;

/**
 * 指定年の全セッションを収集する。
 */
export async function fetchSessionList(
  _baseUrl: string,
  year: number
): Promise<KamisunagawaSessionInfo[]> {
  const allSessions: KamisunagawaSessionInfo[] = [];
  const nendoCodes = yearToNendoCodes(year);
  const sessionTypes = ["teirei", "rinji"] as const;

  for (const nendoCode of nendoCodes) {
    for (const sessionType of sessionTypes) {
      await delay(INTER_PAGE_DELAY_MS);

      const indexUrl = `${BASE_ORIGIN}/gikai_jimukyoku/kekka/${sessionType}/${nendoCode}/index.html`;
      const html = await fetchPage(indexUrl);
      if (!html) continue;

      const links = parseSessionLinks(html, nendoCode, sessionType);

      for (const link of links) {
        await delay(INTER_PAGE_DELAY_MS);

        const pageHtml = await fetchPage(link.url);
        if (!pageHtml) continue;

        const sessions = extractPdfRecords(pageHtml, link, nendoCode, sessionType);
        allSessions.push(...sessions);
      }
    }
  }

  return allSessions;
}

export interface SessionLink {
  /** 各回結果ページの絶対 URL */
  url: string;
  /** ページ ID (例: "2222") */
  pageId: string;
  /** リンクテキスト（例: "第1回定例会"） */
  title: string;
  /** 開催日程テキスト（例: "3月7日〜3月18日"） */
  period: string;
}

/**
 * 年度別一覧ページ HTML から各回の結果ページリンクを抽出する。
 *
 * リンク形式（絶対 URL）:
 *   <a href="https://town.kamisunagawa.hokkaido.jp/gikai_jimukyoku/kekka/teirei/r6/2222.html">
 *     議会の結果・会議録（令和6年第4回定例会 12月11日〜12月13日）
 *   </a>
 *
 * 後方互換として相対パス（"2222.html"）も対応する。
 */
export function parseSessionLinks(
  html: string,
  nendoCode: string,
  sessionType: "teirei" | "rinji"
): SessionLink[] {
  const links: SessionLink[] = [];
  const seen = new Set<string>();

  // 絶対 URL 形式: href="https://.../{sessionType}/{nendoCode}/{pageId}.html"
  const basePath = `/gikai_jimukyoku/kekka/${sessionType}/${nendoCode}/`;
  // new RegExp で basePath のスラッシュをエスケープする必要はない（文字クラス外では不要）
  const absolutePattern = new RegExp(
    `<a\\s[^>]*href="[^"]*${basePath.replace(/\//g, "\\/")}(\\d+)\\.html"[^>]*>([\\s\\S]*?)<\\/a>`,
    "gi"
  );

  // 相対 URL 形式: href="{pageId}.html"
  const relativePattern = /<a\s[^>]*href="(\d+)\.html"[^>]*>([\s\S]*?)<\/a>/gi;

  const processMatch = (pageId: string, rawInner: string): void => {
    if (seen.has(pageId)) return;
    seen.add(pageId);

    const rawText = rawInner.replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim();

    const periodMatch =
      rawText.match(/(\d+月\d+日[〜～~][^\)）]*)/) ||
      rawText.match(/（([^）]+)）/);
    const period = periodMatch?.[1] ?? "";

    const baseTitle = rawText.replace(/[（(][^)）]*[）)]/g, "").trim();

    links.push({
      url: `${BASE_ORIGIN}/gikai_jimukyoku/kekka/${sessionType}/${nendoCode}/${pageId}.html`,
      pageId,
      title: baseTitle || rawText,
      period,
    });
  };

  let m: RegExpExecArray | null;
  while ((m = absolutePattern.exec(html)) !== null) {
    if (m[1] && m[2]) processMatch(m[1], m[2]);
  }
  while ((m = relativePattern.exec(html)) !== null) {
    if (m[1] && m[2]) processMatch(m[1], m[2]);
  }

  return links;
}

/**
 * 各回の結果ページ HTML から PDF リンクを抽出し、セッション情報を返す。
 *
 * PDF リンク形式:
 *   <a href="//town.kamisunagawa.hokkaido.jp/material/files/group/8/kaigiroku_{nendoCode}_{t|r}{n}.pdf">
 *     会議録（令和X年第Y回定例会 M月D日〜M月D日）(PDFファイル: XXX.XKB)
 *   </a>
 *
 * 開催日 (heldOn) はリンクテキストから最初の日付を使用する。
 */
export function extractPdfRecords(
  html: string,
  link: SessionLink,
  nendoCode: string,
  sessionType: "teirei" | "rinji"
): KamisunagawaSessionInfo[] {
  const records: KamisunagawaSessionInfo[] = [];

  const pdfPattern =
    /<a\s[^>]*href="((?:https?:)?\/\/[^"]*kaigiroku[^"]*\.pdf)"[^>]*>([\s\S]*?)<\/a>/gi;

  let m: RegExpExecArray | null;
  while ((m = pdfPattern.exec(html)) !== null) {
    const rawHref = m[1]!;
    const linkText = m[2]!.replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim();

    // プロトコル省略形式の場合は https: を補完
    const pdfUrl = rawHref.startsWith("//") ? `https:${rawHref}` : rawHref;

    // 開催日を抽出（最初の日付を開始日として使用）
    const heldOn = extractHeldOn(linkText, nendoCode);
    if (!heldOn) continue;

    const meetingType = detectMeetingType(link.title || linkText);
    const sessionLabel = link.title || (sessionType === "teirei" ? "定例会" : "臨時会");
    const nendoYear = parseNendoYear(nendoCode);
    const title = nendoYear ? `${nendoYear}年${sessionLabel}` : sessionLabel;

    records.push({
      title,
      heldOn,
      pdfUrl,
      meetingType,
      nendoCode,
      sessionType,
      pageId: link.pageId,
    });
  }

  return records;
}

/**
 * リンクテキストから開催日 (YYYY-MM-DD) を抽出する。
 *
 * テキスト例: "会議録（令和6年第1回定例会 3月7日〜3月18日）(PDFファイル: 2.3MB)"
 * 最初の日付（開始日）を使用する。
 *
 * nendoCode から西暦年を補完する。
 */
function extractHeldOn(text: string, nendoCode: string): string | null {
  const year = parseNendoYear(nendoCode);
  if (!year) return null;

  const dateMatch = text.match(/(\d{1,2})月(\d{1,2})日/);
  if (!dateMatch) return null;

  const month = parseInt(dateMatch[1]!, 10);
  const day = parseInt(dateMatch[2]!, 10);
  if (isNaN(month) || isNaN(day)) return null;

  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

/**
 * 年度コードから西暦年を返す（例: "r6" -> 2024, "h30" -> 2018）
 */
function parseNendoYear(nendoCode: string): number | null {
  const rMatch = nendoCode.match(/^r(\d+)$/);
  if (rMatch?.[1]) return 2018 + parseInt(rMatch[1], 10);

  const hMatch = nendoCode.match(/^h(\d+)$/);
  if (hMatch?.[1]) return 1988 + parseInt(hMatch[1], 10);

  return null;
}
