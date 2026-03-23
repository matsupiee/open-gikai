/**
 * 安平町議会 — list フェーズ
 *
 * 一覧ページ https://www.town.abira.lg.jp/gyosei/kaigiroku から
 * 全会議録の数値 ID・タイトル・掲載日を収集する。
 *
 * bootpag によるクライアントサイドページネーションのため、
 * 1 回の GET で全件取得可能（全データが単一 HTML に含まれる）。
 *
 * 詳細ページから PDF URL を抽出し、各 PDF ごとに 1 レコードを返す。
 */

import {
  BASE_ORIGIN,
  buildDetailUrl,
  buildListUrl,
  detectMeetingType,
  delay,
  extractHeldOnFromTitle,
  fetchPage,
} from "./shared";

export interface AbiraListItem {
  /** 数値 ID（URL パスの末尾） */
  pageId: string;
  /** 会議録タイトル */
  title: string;
  /** 掲載日 YYYY-MM-DD */
  publishedDate: string;
}

export interface AbiraSessionInfo {
  /** 会議タイトル */
  title: string;
  /** 開催日 YYYY-MM-DD */
  heldOn: string;
  /** PDF の絶対 URL */
  pdfUrl: string;
  /** 会議種別 */
  meetingType: string;
  /** 一覧ページの数値 ID */
  pageId: string;
}

const INTER_PAGE_DELAY_MS = 1500;

/**
 * 一覧ページの HTML から会議録リンクをパースする。
 * 全ページ区画（kaigiroku_P2page-N）を走査して全件取得する。
 */
export function parseListPage(html: string): AbiraListItem[] {
  const items: AbiraListItem[] = [];
  const seen = new Set<string>();

  // href="/gyosei/kaigiroku/{数値ID}" パターンを抽出
  // <dt>YYYY年MM月DD日</dt> の直後の <dd><a> をペアで取る
  const dtDdPattern =
    /<dt>\s*(\d{4})年(\d{2})月(\d{2})日\s*<\/dt>\s*<dd>\s*<a\s+href="\/gyosei\/kaigiroku\/(\d+)"\s*>\s*([\s\S]*?)\s*<\/a>/gi;

  for (const match of html.matchAll(dtDdPattern)) {
    const year = match[1]!;
    const month = match[2]!;
    const day = match[3]!;
    const pageId = match[4]!;
    const title = match[5]!.replace(/\s+/g, " ").trim();

    if (seen.has(pageId)) continue;
    seen.add(pageId);

    items.push({
      pageId,
      title,
      publishedDate: `${year}-${month}-${day}`,
    });
  }

  return items;
}

/**
 * 詳細ページの HTML から PDF リンクを抽出する。
 */
export function parsePdfLinks(html: string): { linkText: string; pdfUrl: string }[] {
  const links: { linkText: string; pdfUrl: string }[] = [];

  // PDF リンクパターン: href="//www.town.abira.lg.jp/webopen/content/..." or href="/webopen/content/..."
  const pdfPattern =
    /<a\s[^>]*href="((?:\/\/www\.town\.abira\.lg\.jp)?\/webopen\/content\/\d+\/[^"]+\.pdf[^"]*)"[^>]*>\s*([\s\S]*?)\s*<\/a>/gi;

  for (const match of html.matchAll(pdfPattern)) {
    let url = match[1]!;
    const linkText = match[2]!.replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim();

    // protocol-relative URL を https: に補完
    if (url.startsWith("//")) {
      url = `https:${url}`;
    } else if (url.startsWith("/")) {
      url = `${BASE_ORIGIN}${url}`;
    }

    links.push({ linkText, pdfUrl: url });
  }

  return links;
}

/**
 * PDF リンクテキストから開催日を抽出する。
 * 例: "令和７年第８回安平町議会定例会会議録（令和７年１２月１７日）" → "2025-12-17"
 */
export function extractHeldOnFromPdfLinkText(text: string): string | null {
  // 全角数字を半角に変換
  const normalized = text.replace(/[０-９]/g, (c) =>
    String.fromCharCode(c.charCodeAt(0) - 0xfee0)
  );

  // 括弧内の日付パターン: （令和N年M月D日）
  const match = normalized.match(
    /令和(元|\d+)年(\d{1,2})月(\d{1,2})日/
  );
  if (!match) return null;

  const eraYear = match[1] === "元" ? 1 : parseInt(match[1]!, 10);
  const year = 2018 + eraYear;
  const month = parseInt(match[2]!, 10);
  const day = parseInt(match[3]!, 10);

  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

/**
 * 指定年の会議録セッション一覧を取得する。
 *
 * 1. 一覧ページから全会議録 ID を取得
 * 2. タイトルの開催日から対象年をフィルタリング
 * 3. 各詳細ページから PDF URL を取得
 */
export async function fetchSessionList(
  year: number,
): Promise<AbiraSessionInfo[]> {
  const listUrl = buildListUrl();
  const listHtml = await fetchPage(listUrl);
  if (!listHtml) return [];

  const items = parseListPage(listHtml);

  // 対象年のアイテムをフィルタリング（掲載年または開催年で判定）
  const targetItems = items.filter((item) => {
    const pubYear = parseInt(item.publishedDate.slice(0, 4), 10);
    // 掲載年が対象年または対象年+1（前年度の会議が翌年に掲載されることがある）
    return pubYear === year || pubYear === year + 1;
  });

  const allSessions: AbiraSessionInfo[] = [];

  for (const item of targetItems) {
    await delay(INTER_PAGE_DELAY_MS);

    const detailUrl = buildDetailUrl(item.pageId);
    const detailHtml = await fetchPage(detailUrl);
    if (!detailHtml) continue;

    const pdfLinks = parsePdfLinks(detailHtml);
    if (pdfLinks.length === 0) continue;

    const meetingType = detectMeetingType(item.title);
    // タイトルから基本的な会議名を抽出（【開催結果】を除去）
    const baseName = item.title
      .replace(/【[^】]*】/g, "")
      .replace(/（[^）]*）/g, "")
      .trim();

    for (const pdf of pdfLinks) {
      const heldOn =
        extractHeldOnFromPdfLinkText(pdf.linkText) ??
        extractHeldOnFromTitle(item.title);
      if (!heldOn) continue;

      // 対象年の開催日のみ
      const heldYear = parseInt(heldOn.slice(0, 4), 10);
      if (heldYear !== year) continue;

      // PDF リンクテキストからタイトルを構成
      const pdfTitle = pdf.linkText || baseName;

      allSessions.push({
        title: pdfTitle,
        heldOn,
        pdfUrl: pdf.pdfUrl,
        meetingType,
        pageId: item.pageId,
      });
    }
  }

  return allSessions;
}
