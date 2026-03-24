/**
 * おいらせ町議会 — list フェーズ
 *
 * 会議録一覧ページから年度別ページ URL を収集し、
 * 各年度ページから定例会・臨時会の PDF リンクとメタ情報を抽出する。
 *
 * 一覧ページ構造:
 *   <div class="list_ddd"> > <ul> > <li> > <span class="span_a"><a href="/site/gikai/{slug}.html">...</a>
 *
 * 年度別ページ構造:
 *   <h3>第N回定例会（MM月DD日からMM月DD日まで）</h3>
 *   <table>
 *     <tr>
 *       <td><strong>１２月　４日(木曜日)</strong></td>
 *       <td>本会議（開会）</td>
 *       <td><a href="/uploaded/attachment/{ID}.pdf">...</a></td>
 *     </tr>
 *   </table>
 */

import { BASE_ORIGIN, LIST_URL, fetchPage, normalizeFullWidth } from "./shared";

export interface OiraseDocument {
  /** 会議タイトル（h3 テキストと PDF リンクテキストから構成、例: "令和7年第4回定例会（第1号）"） */
  title: string;
  /** PDF の完全 URL */
  pdfUrl: string;
  /** 年度別ページの URL（sourceUrl として使用） */
  pageUrl: string;
  /** 開催日（テーブル1列目から、例: "１２月　４日(木曜日)"） */
  rawDateText: string;
}

/**
 * 一覧ページ HTML から年度別ページへのリンク一覧を抽出する（純粋関数）。
 *
 * href が /site/gikai/*.html 形式のリンクを収集する。
 * list19-60.html 自体は除外する。
 */
export function parseIndexPage(html: string): string[] {
  const urls: string[] = [];
  // .list_ddd 内のリンクを取得
  const linkRegex = /<a[^>]+href="(\/site\/gikai\/(?!list)[^"]+\.html)"[^>]*>/gi;

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
 * 年度文字列から西暦年を取得する。
 * 「令和7年」「令和７年」「平成31年・令和元年」などに対応。
 * 解析できない場合は null を返す。
 */
export function extractYearFromTitle(title: string): number | null {
  const normalized = normalizeFullWidth(title);

  // 令和（元年対応）
  const reiwaMatch = normalized.match(/令和(元|\d+)年/);
  if (reiwaMatch) {
    const eraYear = reiwaMatch[1] === "元" ? 1 : parseInt(reiwaMatch[1]!, 10);
    return 2018 + eraYear;
  }

  // 平成（元年対応）
  const heiseiMatch = normalized.match(/平成(元|\d+)年/);
  if (heiseiMatch) {
    const eraYear = heiseiMatch[1] === "元" ? 1 : parseInt(heiseiMatch[1]!, 10);
    return 1988 + eraYear;
  }

  return null;
}

/**
 * 年度別ページの HTML から PDF リンク一覧を抽出する（純粋関数）。
 *
 * h3 見出しを会議セッション名として使い、テーブル行から開催日と PDF リンクを収集する。
 * ul/li 形式の古いページにも対応する。
 */
export function parseYearPage(
  html: string,
  pageUrl: string,
): OiraseDocument[] {
  const documents: OiraseDocument[] = [];

  // h3 タグを見つけて会議ブロックを構成する
  const h3Regex = /<h3[^>]*>([\s\S]*?)<\/h3>/gi;
  const h3Matches = Array.from(html.matchAll(h3Regex));

  for (let i = 0; i < h3Matches.length; i++) {
    const h3Match = h3Matches[i]!;
    const rawH3 = (h3Match[1] ?? "")
      .replace(/<[^>]+>/g, "")
      .replace(/&nbsp;/g, " ")
      .replace(/\s+/g, " ")
      .trim();

    // 定例会・臨時会・特別委員会のみ対象
    if (
      !rawH3.includes("定例会") &&
      !rawH3.includes("臨時会") &&
      !rawH3.includes("特別委員会")
    )
      continue;

    // このh3から次のh3（または終端）までの範囲を取得
    const blockStart = h3Match.index! + h3Match[0].length;
    const nextH3 = h3Matches[i + 1];
    const blockEnd = nextH3?.index ?? html.length;
    const blockHtml = html.slice(blockStart, blockEnd);

    // テーブル行から PDF リンクを収集（各行ごとに開催日を取得）
    const trRegex = /<tr[^>]*>([\s\S]*?)<\/tr>/gi;
    for (const trMatch of blockHtml.matchAll(trRegex)) {
      const rowHtml = trMatch[1]!;

      // PDF リンクを探す
      const pdfMatch = rowHtml.match(/<a[^>]+href="([^"]*\.pdf)"[^>]*>([\s\S]*?)<\/a>/i);
      if (!pdfMatch) continue;

      const href = pdfMatch[1]!;
      const linkText = pdfMatch[2]!
        .replace(/<[^>]+>/g, "")
        .replace(/\s+/g, " ")
        .trim();

      // PDF URL を組み立てる
      let pdfUrl: string;
      if (href.startsWith("http")) {
        pdfUrl = href;
      } else if (href.startsWith("/")) {
        pdfUrl = `${BASE_ORIGIN}${href}`;
      } else {
        pdfUrl = `${BASE_ORIGIN}/${href}`;
      }

      // 開催日を取得（1列目の td または th）
      // 全角スペース（U+3000）を保持するため、ASCII 空白のみ除去
      const dateMatch = rowHtml.match(/<(?:td|th)[^>]*>([\s\S]*?)<\/(?:td|th)>/i);
      const rawDateText = dateMatch
        ? dateMatch[1]!
            .replace(/<[^>]+>/g, "")
            .replace(/&nbsp;/g, " ")
            // ASCII 空白（改行・タブ・半角スペース）のみ正規化
            .replace(/[ \t\n\r]+/g, " ")
            .trim()
        : "";

      // タイトルを構成する
      // リンクテキストから [PDFファイル/xxxKB] を除去
      const cleanLinkText = linkText.replace(/\s*\[PDFファイル[^\]]*\]/g, "").trim();
      const title = cleanLinkText || rawH3;

      documents.push({
        title,
        pdfUrl,
        pageUrl,
        rawDateText,
      });
    }

    // ul/li 形式（古い年度）にも対応
    const ulLiPdfRegex = /<li[^>]*>[\s\S]*?<a[^>]+href="([^"]*\.pdf)"[^>]*>([\s\S]*?)<\/a>[\s\S]*?<\/li>/gi;
    // テーブルが存在しないブロックのみ処理
    if (!blockHtml.includes("<table")) {
      for (const liMatch of blockHtml.matchAll(ulLiPdfRegex)) {
        const href = liMatch[1]!;
        const linkText = liMatch[2]!
          .replace(/<[^>]+>/g, "")
          .replace(/\s+/g, " ")
          .trim();

        let pdfUrl: string;
        if (href.startsWith("http")) {
          pdfUrl = href;
        } else if (href.startsWith("/")) {
          pdfUrl = `${BASE_ORIGIN}${href}`;
        } else {
          pdfUrl = `${BASE_ORIGIN}/${href}`;
        }

        const cleanLinkText = linkText.replace(/\s*\[PDFファイル[^\]]*\]/g, "").trim();
        const title = cleanLinkText || rawH3;

        documents.push({
          title,
          pdfUrl,
          pageUrl,
          rawDateText: "",
        });
      }
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
): Promise<OiraseDocument[]> {
  const indexHtml = await fetchPage(LIST_URL);
  if (!indexHtml) return [];

  const yearPageUrls = parseIndexPage(indexHtml);
  const allDocuments: OiraseDocument[] = [];

  for (const pageUrl of yearPageUrls) {
    const html = await fetchPage(pageUrl);
    if (!html) {
      console.warn(`[oirase] year page fetch failed: ${pageUrl}`);
      continue;
    }

    const docs = parseYearPage(html, pageUrl);
    allDocuments.push(...docs);
  }

  if (year === undefined) return allDocuments;

  // タイトルから西暦年でフィルタ
  return allDocuments.filter((doc) => {
    const docYear = extractYearFromTitle(doc.title);
    if (docYear !== null) return docYear === year;

    // rawDateText から年度判定（日付のみの場合はページ URL から年を推測）
    const urlYearMatch = doc.pageUrl.match(/(\d{4})/);
    if (urlYearMatch) {
      return parseInt(urlYearMatch[1]!, 10) === year;
    }

    return false;
  });
}

/**
 * rawDateText から開催日を解析する（純粋関数）。
 * 全角数字を含む「１２月　４日(木曜日)」形式に対応。
 * 年情報がない場合は h3 タイトルから補完する。
 * 解析できない場合は null を返す。
 */
export function parseDateFromRow(
  rawDateText: string,
  yearContext: number,
): string | null {
  const normalized = normalizeFullWidth(rawDateText);

  // 「MM月DD日」形式（年なし）
  const monthDayMatch = normalized.match(/(\d+)月[\s　]*(\d+)日/);
  if (monthDayMatch) {
    const month = parseInt(monthDayMatch[1]!, 10);
    const day = parseInt(monthDayMatch[2]!, 10);
    return `${yearContext}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
  }

  return null;
}
