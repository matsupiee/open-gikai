/**
 * 青ヶ島村議会 — list フェーズ
 *
 * /php/press.php?year={年} から広報誌 PDF リンクを収集する。
 * 議決一覧は定例会後の号（1月・4月・7月・10月号）に掲載されるが、
 * 確実性のため全号を対象にする。
 *
 * レスポンス形式: <ul><li><a href="kohoYYMM.pdf">...（ファイルサイズ）</a></li></ul>
 */

import { buildListUrl, buildPdfUrl, fetchPage } from "./shared";

export interface AogashimaPdf {
  /** PDF の完全 URL */
  pdfUrl: string;
  /** PDF ファイル名 (e.g., "koho2501.pdf") */
  filename: string;
  /** PDF の年月 YYYY-MM */
  yearMonth: string;
}

/**
 * press.php のレスポンス HTML から PDF リンクを抽出する（テスト可能な純粋関数）。
 *
 * HTML 例: <li><a href="koho2501.pdf">広報あおがしま　No.414（2.28MB）</a></li>
 */
export function parsePressList(html: string): AogashimaPdf[] {
  const results: AogashimaPdf[] = [];

  const linkPattern = /<a[^>]+href="(koho(\d{2})(\d{2})\.pdf)"[^>]*>[^<]*<\/a>/gi;

  for (const match of html.matchAll(linkPattern)) {
    const filename = match[1]!;
    const yyStr = match[2]!;
    const mmStr = match[3]!;

    const yy = parseInt(yyStr, 10);
    // 西暦下2桁 → 4桁: 06-99 → 2006-2099
    const fullYear = yy < 100 ? 2000 + yy : yy;
    const yearMonth = `${fullYear}-${mmStr}`;

    results.push({
      pdfUrl: buildPdfUrl(filename),
      filename,
      yearMonth,
    });
  }

  return results;
}

/**
 * 指定年の広報誌 PDF 一覧を取得する。
 */
export async function fetchPdfList(year: number): Promise<AogashimaPdf[]> {
  const url = buildListUrl(year);
  const html = await fetchPage(url);
  if (!html) return [];

  return parsePressList(html);
}
