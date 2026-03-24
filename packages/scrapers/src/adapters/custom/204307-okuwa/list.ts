/**
 * 大桑村議会 — list フェーズ
 *
 * 3 つの議会だより一覧ページから PDF リンクを収集する。
 *
 * 一覧ページの構造:
 *   <ul>
 *     <li>
 *       <a target="_blank" href="/okuwa/gikai/gikaidayori/documents/gikaidayori/gikaihou183.pdf">
 *         議会だより第183号　令和８年１月22日発行（1,841.4kbyte）
 *       </a>
 *     </li>
 *     ...
 *   </ul>
 *
 * リンクテキストから号数・発行日を抽出する。
 * href 属性が空のリンクはスキップする（PDF 未公開）。
 */

import { BASE_ORIGIN, LIST_PAGES, fetchPage, parseWarekiDate, parseWarekiYear, toHalfWidth } from "./shared";

export interface OkuwaPdfRecord {
  /** 議会だよりの号数（号外の場合は null） */
  issueNumber: number | null;
  /** 発行日（YYYY-MM-DD） */
  issuedOn: string;
  /** 発行年（西暦） */
  year: number;
  /** PDF の絶対 URL */
  pdfUrl: string;
  /** リンクテキスト（そのまま title として使用） */
  title: string;
}

/**
 * 一覧ページの HTML から PDF レコード一覧をパースする。
 *
 * @param html - 一覧ページの HTML テキスト
 * @param _baseDir - PDF ファイルが配置されるベースディレクトリパス（例: "documents/gikaidayori"）
 */
export function parseListPage(html: string, _baseDir: string): OkuwaPdfRecord[] {
  const records: OkuwaPdfRecord[] = [];

  // .pdf で終わる href を持つ <a> タグを抽出
  const linkRegex = /<a\s[^>]*href=["']([^"']*\.pdf)["'][^>]*>([\s\S]*?)<\/a>/gi;

  for (const match of html.matchAll(linkRegex)) {
    const href = match[1]!.trim();
    const rawText = match[2]!.replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim();

    if (!href || !rawText) continue;

    // 絶対 URL に変換
    const pdfUrl = href.startsWith("http") ? href : `${BASE_ORIGIN}${href}`;

    // テキストの正規化（全角数字を半角に）
    const normalizedText = toHalfWidth(rawText);

    // 発行日を抽出
    const issuedOn = parseWarekiDate(normalizedText);
    if (!issuedOn) continue;

    const year = parseWarekiYear(normalizedText);
    if (!year) continue;

    // 号数の抽出（通常号）
    const issueMatch = normalizedText.match(/第(\d+)号/);
    const issueNumber = issueMatch?.[1] ? parseInt(issueMatch[1], 10) : null;

    // タイトルの生成
    const title = buildTitle(normalizedText, issueNumber);

    records.push({
      issueNumber,
      issuedOn,
      year,
      pdfUrl,
      title,
    });
  }

  return records;
}

/**
 * リンクテキストからタイトル文字列を生成する。
 * ファイルサイズ部分（括弧内）を除去する。
 */
function buildTitle(text: string, issueNumber: number | null): string {
  // ファイルサイズ情報（例: "（1,841.4kbyte）"）を除去
  const cleaned = text.replace(/[（(][^）)]*(?:byte|kbyte|KB|MB)[）)]/gi, "").trim();

  if (issueNumber !== null) {
    // 通常号: "議会だより第183号 令和8年1月22日発行" のような形式
    const m = cleaned.match(/^(議会だより第\d+号)\s*(.+?)発行/);
    if (m?.[1] && m[2]) return `${m[1]} ${m[2].trim()}発行`;
    return cleaned;
  }

  // 号外: "議会だより号外 令和6年11月28日発行"
  const m = cleaned.match(/^(議会だより号外)\s*(.+?)発行/);
  if (m?.[1] && m[2]) return `${m[1]} ${m[2].trim()}発行`;
  return cleaned;
}

/**
 * 3 つの一覧ページから全 PDF レコードを収集する。
 */
export async function fetchAllPdfRecords(): Promise<OkuwaPdfRecord[]> {
  const allRecords: OkuwaPdfRecord[] = [];

  for (const page of LIST_PAGES) {
    const html = await fetchPage(page.url);
    if (!html) continue;

    const records = parseListPage(html, page.docDir);
    allRecords.push(...records);
  }

  return allRecords;
}

/**
 * 指定年の PDF レコード一覧を取得する。
 */
export async function fetchPdfList(year: number): Promise<OkuwaPdfRecord[]> {
  const allRecords = await fetchAllPdfRecords();
  return allRecords.filter((r) => r.year === year);
}
