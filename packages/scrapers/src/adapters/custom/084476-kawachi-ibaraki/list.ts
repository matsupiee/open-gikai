/**
 * 河内町議会（茨城県）— list フェーズ
 *
 * 2段階で PDF リンクを収集する:
 * 1. インデックスページ (dir000122.html) から年度別ページ URL を収集
 * 2. 各年度ページから会議（h3）ごとのPDFリンクを抽出
 *
 * 各PDFが1会議日（初日または最終日）に相当するため、
 * fetchDetail は1PDF → 1MeetingData として処理する。
 */

import {
  BASE_ORIGIN,
  INDEX_PAGE_URL,
  detectMeetingType,
  fetchPage,
  parseWarekiYear,
  delay,
} from "./shared";

export interface KawachiIbarakiPdfInfo {
  /** 会議タイトル（例: "第4回（12月）定例会 最終日"） */
  title: string;
  /** 会議の種別（例: "plenary", "extraordinary"） */
  meetingType: string;
  /** PDF の絶対 URL */
  pdfUrl: string;
  /** PDF ファイル名（externalId 生成用） */
  pdfFileName: string;
  /** 年度（西暦）: PDF 内から開催日を解析する際の参考 */
  year: number;
}

const INTER_PAGE_DELAY_MS = 1500;

/**
 * インデックスページから年度別ページ URL を抽出する。
 *
 * HTML構造:
 *   <div class="dirIndex">
 *     <h3>令和7年</h3>
 *     <a href="page002683.html">...</a>
 *   </div>
 */
export function parseIndexPage(
  html: string
): { year: number; url: string }[] {
  const results: { year: number; url: string }[] = [];

  // div.dirIndex ブロックを抽出
  const dirIndexRegex = /<div[^>]*class="[^"]*dirIndex[^"]*"[^>]*>([\s\S]*?)<\/div>/gi;

  for (const divMatch of html.matchAll(dirIndexRegex)) {
    const divContent = divMatch[1]!;

    // h3 から年度テキストを抽出
    const h3Match = divContent.match(/<h3[^>]*>([\s\S]*?)<\/h3>/i);
    if (!h3Match) continue;

    const yearText = h3Match[1]!.replace(/<[^>]+>/g, "").trim();
    const year = parseWarekiYear(yearText);
    if (!year) continue;

    // a タグから URL を抽出
    const linkMatch = divContent.match(/<a\s[^>]*href="([^"]+)"[^>]*>/i);
    if (!linkMatch) continue;

    const href = linkMatch[1]!;
    const url = href.startsWith("http")
      ? href
      : href.startsWith("/")
        ? `${BASE_ORIGIN}${href}`
        : `${BASE_ORIGIN}/page/${href}`;

    // 重複チェック
    if (results.some((r) => r.year === year)) continue;
    results.push({ year, url });
  }

  // dirIndex が見つからない場合は別パターンを試行（汎用 a タグ探索）
  if (results.length === 0) {
    const linkRegex =
      /<a\s[^>]*href="((?:https?:\/\/[^"]*)?\/page\/page\d+\.html)"[^>]*>([\s\S]*?)<\/a>/gi;

    for (const match of html.matchAll(linkRegex)) {
      const href = match[1]!;
      const linkText = match[2]!.replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim();
      const year = parseWarekiYear(linkText);
      if (!year) continue;

      const url = href.startsWith("http")
        ? href
        : `${BASE_ORIGIN}${href}`;

      if (results.some((r) => r.year === year)) continue;
      results.push({ year, url });
    }
  }

  return results;
}

/**
 * 年度ページから会議ごとのPDFリンクを抽出する。
 *
 * HTML構造:
 *   <h3>第4回（12月）定例会</h3>
 *   <table>
 *     <tbody>
 *       <tr>
 *         <td>...</td>
 *         <td>初日 <a href="https://...pdf">初日</a>（PDF形式...）</td>
 *         <td>...</td>
 *         <td><a href="https://...pdf">最終日</a>（PDF形式...）</td>
 *       </tr>
 *     </tbody>
 *   </table>
 */
export function parseYearPage(
  html: string,
  _year: number
): { sessionName: string; label: string; pdfUrl: string }[] {
  const results: { sessionName: string; label: string; pdfUrl: string }[] = [];

  // #contents 内の h3 とそれに続く table を処理
  const contentsMatch = html.match(/<div[^>]*id="contents"[^>]*>([\s\S]*?)(?:<\/div>\s*(?:<\/div>|$))/i)
    ?? html.match(/<div[^>]*id="contents"[^>]*>([\s\S]*)/i);

  const contentsHtml = contentsMatch ? contentsMatch[1]! : html;

  // h3 タグで分割してセッションブロックを作成
  const h3Regex = /<h3[^>]*>([\s\S]*?)<\/h3>/gi;
  const h3Matches: { text: string; index: number; fullMatch: string }[] = [];

  for (const m of contentsHtml.matchAll(h3Regex)) {
    const text = m[1]!.replace(/<[^>]+>/g, "").trim();
    h3Matches.push({ text, index: m.index! + m[0].length, fullMatch: m[0] });
  }

  for (let i = 0; i < h3Matches.length; i++) {
    const sessionName = h3Matches[i]!.text;
    if (!sessionName) continue;

    // このh3とその次のh3の間のコンテンツ
    const start = h3Matches[i]!.index;
    const end =
      i + 1 < h3Matches.length
        ? h3Matches[i + 1]!.index - h3Matches[i + 1]!.fullMatch.length
        : contentsHtml.length;

    const sectionHtml = contentsHtml.slice(start, end);

    // table 内の a タグから PDF リンクを抽出
    const tableMatch = sectionHtml.match(/<table[^>]*>([\s\S]*?)<\/table>/i);
    if (!tableMatch) continue;

    const tableHtml = tableMatch[1]!;

    // td 内のリンクを抽出（tdのテキストとそのリンクhref）
    const tdRegex = /<td[^>]*>([\s\S]*?)<\/td>/gi;
    for (const tdMatch of tableHtml.matchAll(tdRegex)) {
      const tdContent = tdMatch[1]!;

      // PDF リンクを含むtdのみ対象
      const linkMatch = tdContent.match(
        /<a\s[^>]*href="([^"]*\.pdf)"[^>]*>([\s\S]*?)<\/a>/i
      );
      if (!linkMatch) continue;

      const pdfUrl = linkMatch[1]!;
      const rawLabel = linkMatch[2]!.replace(/<[^>]+>/g, "").trim();

      // ラベルがない場合はtdテキスト全体から抽出
      const label = rawLabel || tdContent.replace(/<[^>]+>/g, "").replace(/（PDF形式.*/g, "").trim();

      const cleanLabel = label || "初日";

      // 絶対URLに変換
      const absolutePdfUrl = pdfUrl.startsWith("http")
        ? pdfUrl
        : `${BASE_ORIGIN}${pdfUrl}`;

      results.push({
        sessionName,
        label: cleanLabel,
        pdfUrl: absolutePdfUrl,
      });
    }
  }

  return results;
}

/**
 * PDF ファイル名を URL から抽出する。
 * 例: "https://.../data/doc/1738565205_doc_11_0.pdf" → "1738565205_doc_11_0"
 */
export function extractPdfId(pdfUrl: string): string {
  const match = pdfUrl.match(/\/([^/]+)\.pdf$/i);
  return match?.[1] ?? pdfUrl;
}

/**
 * 指定年の全 PDF リンクを取得する。
 */
export async function fetchPdfList(
  _baseUrl: string,
  year: number
): Promise<KawachiIbarakiPdfInfo[]> {
  // Step 1: インデックスページから年度ページ URL を取得
  const indexHtml = await fetchPage(INDEX_PAGE_URL);
  if (!indexHtml) return [];

  const yearPages = parseIndexPage(indexHtml);
  const targetPage = yearPages.find((p) => p.year === year);
  if (!targetPage) return [];

  await delay(INTER_PAGE_DELAY_MS);

  // Step 2: 年度ページから PDF リンクを取得
  const yearHtml = await fetchPage(targetPage.url);
  if (!yearHtml) return [];

  const pdfLinks = parseYearPage(yearHtml, year);

  return pdfLinks.map(({ sessionName, label, pdfUrl }) => ({
    title: `${sessionName} ${label}`,
    meetingType: detectMeetingType(sessionName),
    pdfUrl,
    pdfFileName: extractPdfId(pdfUrl),
    year,
  }));
}
