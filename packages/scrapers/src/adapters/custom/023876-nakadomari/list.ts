/**
 * 中泊町議会 — list フェーズ
 *
 * 会議録一覧ページから年度別ページ URL を収集し、
 * 各年度ページから定例会・臨時会の PDF リンクとメタ情報を抽出する。
 *
 * 一覧ページ構造:
 *   <ul> > <li> > <a href="/gyoseijoho/gikai/kaigiroku/{pageId}.html">令和X年会議録</a>
 *
 * 年度別ページ構造:
 *   <h3>令和X年第N回中泊町議会（定例会|臨時会）</h3>
 *   <a href="//www.town.nakadomari.lg.jp/material/files/group/12/{filename}.pdf">...</a>
 */

import { BASE_ORIGIN, LIST_URL, fetchPage } from "./shared";

export interface NakadomariDocument {
  /** 会議タイトル（h3 テキスト、例: "令和7年第1回中泊町議会定例会"） */
  title: string;
  /** PDF の完全 URL */
  pdfUrl: string;
  /** 年度別ページの URL（sourceUrl として使用） */
  pageUrl: string;
}

/**
 * 一覧ページ HTML から年度別ページへのリンク一覧を抽出する（純粋関数）。
 *
 * href が /gyoseijoho/gikai/kaigiroku/{pageId}.html 形式のリンクを収集する。
 */
export function parseIndexPage(html: string): string[] {
  const urls: string[] = [];
  const linkRegex =
    /<a[^>]+href="(\/gyoseijoho\/gikai\/kaigiroku\/\d+\.html)"[^>]*>/gi;

  for (const match of html.matchAll(linkRegex)) {
    const path = match[1]!;
    const fullUrl = `${BASE_ORIGIN}${path}`;
    if (!urls.includes(fullUrl)) {
      urls.push(fullUrl);
    }
  }

  return urls;
}

/**
 * 年度別ページの HTML から PDF リンク一覧を抽出する（純粋関数）。
 *
 * h3 見出しを会議名として使い、その後の PDF リンクを収集する。
 * プロトコル相対 URL（//www.town.nakadomari.lg.jp/...）を https: に変換する。
 */
export function parseYearPage(
  html: string,
  pageUrl: string,
): NakadomariDocument[] {
  const documents: NakadomariDocument[] = [];

  // h2/h3 タグを見つけて会議ブロックを構成する（年によって h2 か h3 が使われる）
  const h3Regex = /<h[23][^>]*>([\s\S]*?)<\/h[23]>/gi;
  const h3Matches = Array.from(html.matchAll(h3Regex));

  for (let i = 0; i < h3Matches.length; i++) {
    const h3Match = h3Matches[i]!;
    const rawTitle = (h3Match[1] ?? "")
      .replace(/<[^>]+>/g, "")
      .replace(/&nbsp;/g, " ")
      .replace(/\s+/g, " ")
      .trim();

    // 定例会・臨時会のみ対象
    if (!rawTitle.includes("定例会") && !rawTitle.includes("臨時会")) continue;

    // このh3から次のh3（または終端）までの範囲を取得
    const blockStart = h3Match.index! + h3Match[0].length;
    const nextH3 = h3Matches[i + 1];
    const blockEnd = nextH3?.index ?? html.length;
    const blockHtml = html.slice(blockStart, blockEnd);

    // PDF リンクを収集
    const pdfLinkRegex = /<a[^>]+href="([^"]*\.pdf)"[^>]*>/gi;
    for (const pdfMatch of blockHtml.matchAll(pdfLinkRegex)) {
      const href = pdfMatch[1]!;

      // プロトコル相対 URL を https: に変換
      let pdfUrl: string;
      if (href.startsWith("//")) {
        pdfUrl = `https:${href}`;
      } else if (href.startsWith("http")) {
        pdfUrl = href;
      } else if (href.startsWith("/")) {
        pdfUrl = `${BASE_ORIGIN}${href}`;
      } else {
        pdfUrl = `${BASE_ORIGIN}/${href}`;
      }

      documents.push({
        title: rawTitle,
        pdfUrl,
        pageUrl,
      });
    }
  }

  return documents;
}

/**
 * 会議録一覧ページを起点に全年度の PDF リンクを収集する。
 * year を指定した場合は開催年でフィルタする。
 */
export async function fetchDocumentList(
  year?: number,
): Promise<NakadomariDocument[]> {
  const indexHtml = await fetchPage(LIST_URL);
  if (!indexHtml) return [];

  const yearPageUrls = parseIndexPage(indexHtml);
  const allDocuments: NakadomariDocument[] = [];

  for (const pageUrl of yearPageUrls) {
    const html = await fetchPage(pageUrl);
    if (!html) {
      console.warn(`[nakadomari] year page fetch failed: ${pageUrl}`);
      continue;
    }

    const docs = parseYearPage(html, pageUrl);
    allDocuments.push(...docs);
  }

  if (year === undefined) return allDocuments;

  // 令和X年のタイトルから西暦年でフィルタ
  return allDocuments.filter((doc) => {
    // タイトルから年度を取得: "令和7年第1回..." → 2025
    const reiwaMatch = doc.title.match(/令和(元|\d+)年/);
    if (reiwaMatch) {
      const eraYear = reiwaMatch[1] === "元" ? 1 : parseInt(reiwaMatch[1]!, 10);
      const westernYear = 2018 + eraYear;
      return westernYear === year;
    }
    const heiseiMatch = doc.title.match(/平成(元|\d+)年/);
    if (heiseiMatch) {
      const eraYear = heiseiMatch[1] === "元" ? 1 : parseInt(heiseiMatch[1]!, 10);
      const westernYear = 1988 + eraYear;
      return westernYear === year;
    }
    return false;
  });
}
