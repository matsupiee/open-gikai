/**
 * 大洲市議会 会議録 — list フェーズ
 *
 * 年度インデックスページ (y{N}.html, Shift-JIS) から会議録リンクを収集する。
 *
 * 年度インデックスの構造:
 *   - 会議種別は「◆第N回定例会(月)◆」「◆第N回臨時会(月)◆」の見出しで区切られる
 *   - 各行に会議日、内容説明、目次リンク、会議録リンクが含まれる
 *   - 目次リンク例: <a href="R08/202601rinji-mokuji.html">目次</a>
 *   - 会議録リンク例: <a href="R08/202601rinji-1.html">会議録</a>
 *
 * ファイルが存在するのは平成17年(2005年, y05.html)〜現在。
 * 平成17〜18年は PDF のみのため、HTML パース対象外。
 */

import { BASE_URL, buildIndexUrl, fetchPageShiftJis, toSeireki } from "./shared";

export interface OzuDocument {
  /** 西暦年 */
  year: number;
  /** 会議タイトル (例: "令和8年第1回臨時会") */
  sessionTitle: string;
  /** 会議種別ファイル識別子 (例: "202601rinji") */
  fileKey: string;
  /** 年号ディレクトリ (例: "R08") */
  eraDir: string;
  /** 詳細 URL (最初の会議録 -1.html の絶対 URL) */
  detailUrl: string;
  /** 開催年月 YYYY-MM (日は不明の場合) */
  heldYearMonth: string;
}

/**
 * 年度インデックス HTML (Shift-JIS デコード済み) からドキュメント一覧をパースする。
 *
 * 会議録リンク (テキスト "会議録") の href から情報を抽出する。
 * href 例: "R08/202601rinji-1.html", "H30/201803teirei-1.html"
 */
export function parseIndexPage(html: string): OzuDocument[] {
  const documents: OzuDocument[] = [];

  // HTML コメントアウト内のコンテンツは除外する
  const strippedHtml = html.replace(/<!--[\s\S]*?-->/g, "");

  // 会議録リンクを抽出: テキストが「会議録」のリンク
  // href パターン: {eraDir}/{YYYYMM}{type}-{N}.html
  const linkRegex = /<a\s+href="([^"]+)"[^>]*>\s*会議録\s*<\/a>/gi;

  for (const match of strippedHtml.matchAll(linkRegex)) {
    const href = match[1]!.trim();

    // href のパターンを解析: "R08/202601rinji-1.html" または "H30/201803teirei-1.html"
    const hrefMatch = href.match(/^([A-Z]\d+)\/(\d{6})(teirei|rinji)-\d+\.html$/i);
    if (!hrefMatch) continue;

    const eraDir = hrefMatch[1]!;
    const fileKey = `${hrefMatch[2]!}${hrefMatch[3]!}`;
    const yyyyMM = hrefMatch[2]!;
    const meetingType = hrefMatch[3]!.toLowerCase();

    // 年月を解析
    const yyyy = parseInt(yyyyMM.slice(0, 4), 10);
    const mm = parseInt(yyyyMM.slice(4, 6), 10);

    // 年号ディレクトリから元号を判断
    const eraDirMatch = eraDir.match(/^([RH])(\d+)$/i);
    if (!eraDirMatch) continue;

    const eraChar = eraDirMatch[1]!.toUpperCase();
    const eraNen = parseInt(eraDirMatch[2]!, 10);
    const eraName = eraChar === "R" ? "令和" : "平成";

    const nenStr = eraNen === 1 ? "元" : String(eraNen);
    const sessionTitleEra = `${eraName}${nenStr}年`;

    // 会議種別テキスト
    const meetingTypeName = meetingType === "teirei" ? "定例会" : "臨時会";

    // 会議タイトルを構築 (年号+回次は近傍テキストから取れないため年月から推定)
    // 会議年月 YYYY-MM を利用
    const sessionTitle = `${sessionTitleEra}${meetingTypeName}（${mm}月）`;

    const detailUrl = `${BASE_URL}/${eraDir}/${fileKey}-1.html`;
    const heldYearMonth = `${yyyy}-${String(mm).padStart(2, "0")}`;

    // 重複を避ける (同じ detailUrl が複数リンクされることがある)
    if (documents.some((d) => d.detailUrl === detailUrl)) continue;

    documents.push({
      year: yyyy,
      sessionTitle,
      fileKey,
      eraDir,
      detailUrl,
      heldYearMonth,
    });
  }

  return documents;
}

/**
 * 指定年の全会議録ドキュメント一覧を取得する。
 */
export async function fetchDocumentList(year: number): Promise<OzuDocument[]> {
  // PDF のみの年 (2005〜2006) はスキップ
  if (year <= 2006) return [];

  const url = buildIndexUrl(year);
  const html = await fetchPageShiftJis(url);
  if (!html) return [];

  const docs = parseIndexPage(html);
  return docs.filter((d) => d.year === year);
}

// toSeireki は shared から再エクスポート（テスト用）
export { toSeireki };
