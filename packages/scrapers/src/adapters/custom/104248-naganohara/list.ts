/**
 * 長野原町議会（群馬県） — list フェーズ
 *
 * 2段階クロール:
 * 1. トップページから年度別ページの URL を取得
 * 2. 各年度ページから PDF リンクを抽出してメタ情報を解析
 *
 * PDF ファイル命名規則:
 * - 平成27〜30年: H{和暦2桁}{月2桁}_{区分}.pdf (_T=定例会, _R=臨時会)
 * - 令和以降: R{和暦2桁}{月2桁}.pdf（リンクテキストで種別判断）
 */

import {
  BASE_ORIGIN,
  detectMeetingType,
  fetchPage,
  toJapaneseEra,
  delay,
} from "./shared";

export interface NaganoharaMeeting {
  pdfUrl: string;
  title: string;
  heldOn: string;
  meetingType: "plenary" | "extraordinary" | "committee";
}

const INTER_PAGE_DELAY_MS = 1500;

/**
 * トップページの HTML から年度別ページのリンクを抽出する（純粋関数）。
 *
 * リンクパターン: /www/contents/{pageId}/index.html
 * ラベル例: "令和7年会議録", "令和6年会議録", "平成30年会議録"
 */
export function parseTopPage(html: string): { label: string; url: string }[] {
  const results: { label: string; url: string }[] = [];

  // href が /www/contents/{数字}/index.html のパターン
  const linkPattern =
    /<a[^>]+href="(\/www\/contents\/(\d+)\/index\.html)"[^>]*>([^<]+)<\/a>/gi;

  for (const match of html.matchAll(linkPattern)) {
    const href = match[1]!;
    const label = match[3]!.trim();

    // 年度表記がある場合に限定
    if (!/(?:令和|平成)/.test(label)) continue;

    results.push({ label, url: `${BASE_ORIGIN}${href}` });
  }

  return results;
}

/**
 * リンクテキストから開催日（YYYY-MM-DD）を抽出する（純粋関数）。
 *
 * リンクテキスト例:
 * - "令和６年第４回定例会会議録（12月）"
 * - "令和元年第１回定例会会議録（3月）"
 * - "平成２７年第１回定例会会議録（3月）"
 *
 * ファイル名からの推定:
 * - H2703_T.pdf → 平成27年3月
 * - R0603.pdf → 令和6年3月
 */
export function parseLinkDate(
  linkText: string,
  pdfUrl: string,
): string | null {
  // 全角数字を半角に変換
  const normalized = linkText.replace(/[０-９]/g, (c) =>
    String.fromCharCode(c.charCodeAt(0) - 0xfee0),
  );

  // パターン1: リンクテキストに月情報が含まれる場合
  // 例: "令和6年第4回定例会会議録（12月）"
  const textPattern =
    /(?:令和|平成)(元|\d+)年第\d+回.+会議録[（(](\d+)月[）)]/;
  const textMatch = normalized.match(textPattern);
  if (textMatch) {
    const eraText = normalized.includes("令和") ? "令和" : "平成";
    const eraYearStr = textMatch[1]!;
    const eraYear = eraYearStr === "元" ? 1 : parseInt(eraYearStr, 10);
    const month = parseInt(textMatch[2]!, 10);
    const westernYear = eraText === "令和" ? eraYear + 2018 : eraYear + 1988;
    return `${westernYear}-${String(month).padStart(2, "0")}-01`;
  }

  // パターン2: ファイル名から推定
  // H2703_T.pdf → 平成27年3月
  const heisei = new URL(pdfUrl).pathname.match(/\/H(\d{2})(\d{2})_[TR]\.pdf$/i);
  if (heisei) {
    const eraYear = parseInt(heisei[1]!, 10);
    const month = parseInt(heisei[2]!, 10);
    const westernYear = eraYear + 1988;
    return `${westernYear}-${String(month).padStart(2, "0")}-01`;
  }

  // パターン3: R0603.pdf → 令和6年3月
  const reiwa = new URL(pdfUrl).pathname.match(/\/R(\d{2})(\d{2})\.pdf$/i);
  if (reiwa) {
    const eraYear = parseInt(reiwa[1]!, 10);
    const month = parseInt(reiwa[2]!, 10);
    const westernYear = eraYear + 2018;
    return `${westernYear}-${String(month).padStart(2, "0")}-01`;
  }

  return null;
}

/**
 * 年度別ページの HTML から PDF リンクを抽出する（純粋関数）。
 */
export function parseYearPage(
  html: string,
  pageUrl: string,
): NaganoharaMeeting[] {
  const results: NaganoharaMeeting[] = [];

  // PDF リンクを抽出
  const linkPattern = /<a[^>]+href="([^"]+\.pdf)"[^>]*>([\s\S]*?)<\/a>/gi;

  for (const match of html.matchAll(linkPattern)) {
    const href = match[1]!.trim();
    // HTML タグを除去してテキストのみ取得
    const linkText = match[2]!.replace(/<[^>]+>/g, "").trim();

    // 空テキストはスキップ
    if (!linkText) continue;

    // PDF の完全 URL を構築
    let pdfUrl: string;
    if (href.startsWith("http")) {
      pdfUrl = href;
    } else if (href.startsWith("/")) {
      pdfUrl = `${BASE_ORIGIN}${href}`;
    } else {
      // 相対パス
      const baseDir = pageUrl.replace(/\/[^/]+$/, "/");
      pdfUrl = baseDir + href;
    }

    // ファイル名から会議種別を判定（平成期のみサフィックスあり）
    const fileName = new URL(pdfUrl).pathname.split("/").pop() ?? "";
    let meetingTypeFromFileName: "plenary" | "extraordinary" | undefined;
    if (/_T\.pdf$/i.test(fileName)) meetingTypeFromFileName = "plenary";
    else if (/_R\.pdf$/i.test(fileName)) meetingTypeFromFileName = "extraordinary";

    // 開催日を取得
    const heldOn = parseLinkDate(linkText, pdfUrl);
    if (!heldOn) continue;

    // タイトルを構築: リンクテキストからサイズ情報を除去
    const title = linkText
      .replace(/\(PDF[^)]*\)/gi, "")
      .replace(/\([^)]*KB\)/gi, "")
      .trim();

    const meetingType =
      meetingTypeFromFileName ?? detectMeetingType(linkText);

    results.push({ pdfUrl, title, heldOn, meetingType });
  }

  return results;
}

/**
 * 指定年度の会議録一覧を取得する。
 */
export async function fetchMeetingList(
  topUrl: string,
  year: number,
): Promise<NaganoharaMeeting[]> {
  // Step 1: トップページから年度別ページのリンクを取得
  const topHtml = await fetchPage(topUrl);
  if (!topHtml) return [];

  const yearPages = parseTopPage(topHtml);
  const eraTexts = toJapaneseEra(year);

  // 対象年度のページを見つける
  const targetPage = yearPages.find((p) =>
    eraTexts.some((era) => p.label.includes(era)),
  );
  if (!targetPage) return [];

  await delay(INTER_PAGE_DELAY_MS);

  // Step 2: 年度別ページから PDF リンクを抽出
  const yearHtml = await fetchPage(targetPage.url);
  if (!yearHtml) return [];

  return parseYearPage(yearHtml, targetPage.url);
}
