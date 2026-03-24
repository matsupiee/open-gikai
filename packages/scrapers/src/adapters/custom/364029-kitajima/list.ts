/**
 * 北島町議会 — list フェーズ
 *
 * 一覧ページ https://www.town.kitajima.lg.jp/docs/402721.html から
 * 定例会 PDF リンクを収集する。
 *
 * ページ構造:
 *   <h2>令和7年</h2>
 *   <p>　○<a href="/fs/.../...pdf">第4回定例会 (PDF 614KB)</a></p>
 *
 * 定例会のみ対象（町長諸報告・所信表明は除外する）。
 */

import {
  BASE_ORIGIN,
  LIST_URL,
  detectMeetingType,
  parseWarekiYear,
  fetchPage,
} from "./shared";

export interface KitajimaSessionInfo {
  /** 会議タイトル（例: "令和7年第4回定例会"） */
  title: string;
  /** 開催年から推定した日付 YYYY-01-01（月情報なし） */
  heldOn: string;
  /** PDF の絶対 URL */
  pdfUrl: string;
  /** 会議種別 */
  meetingType: string;
  /** 外部 ID 用キー (PDF URL のパス部分) */
  pdfPath: string;
}

/**
 * 一覧ページ HTML から定例会 PDF リンクを抽出する（テスト可能な純粋関数）。
 *
 * @param html 一覧ページの HTML テキスト
 * @param targetYear 対象の西暦年（null の場合は全年度）
 */
export function parseListPage(
  html: string,
  targetYear: number | null = null,
): KitajimaSessionInfo[] {
  const records: KitajimaSessionInfo[] = [];

  // <h2> タグで年度ブロックを分割する
  // パターン: <h2>...</h2> ... 次の <h2> まで
  const blockPattern = /<h2>([\s\S]*?)<\/h2>([\s\S]*?)(?=<h2>|$)/gi;

  let blockMatch: RegExpExecArray | null;
  while ((blockMatch = blockPattern.exec(html)) !== null) {
    const h2Text = blockMatch[1]!.replace(/<[^>]+>/g, "").trim();
    const blockContent = blockMatch[2]!;

    const year = parseWarekiYear(h2Text);
    if (!year) continue;

    // targetYear が指定されている場合はフィルタリング
    if (targetYear !== null && year !== targetYear) continue;

    // ブロック内の <a href="...pdf"> を抽出
    const linkPattern = /<a\s[^>]*href="([^"]*\.pdf)"[^>]*>([\s\S]*?)<\/a>/gi;
    let linkMatch: RegExpExecArray | null;
    while ((linkMatch = linkPattern.exec(blockContent)) !== null) {
      const href = linkMatch[1]!;
      const rawText = linkMatch[2]!.replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim();

      // リンクテキストから「○」記号を除去
      const linkText = rawText.replace(/^[○◯◎●]\s*/, "");

      // 定例会のみ対象（「定例会」を含むリンクテキスト）
      if (!linkText.includes("定例会")) continue;

      // 回次を抽出: 例 "第4回定例会"
      const sessionMatch = linkText.match(/第(\d+)回定例会/);
      const sessionNum = sessionMatch?.[1] ?? null;

      // タイトル生成
      const eraText = h2Text; // 例: "令和7年"
      const title = sessionNum
        ? `${eraText}第${sessionNum}回定例会`
        : `${eraText}定例会`;

      // heldOn: 年のみ分かるので YYYY-01-01 とする
      const heldOn = `${year}-01-01`;

      // PDF URL を絶対パスに
      const pdfUrl = href.startsWith("http")
        ? href
        : new URL(href, BASE_ORIGIN).toString();

      // pdfPath: URL のパス部分を外部 ID として使用
      let pdfPath: string;
      try {
        pdfPath = new URL(pdfUrl).pathname;
      } catch {
        pdfPath = href;
      }

      const meetingType = detectMeetingType(title);

      records.push({
        title,
        heldOn,
        pdfUrl,
        meetingType,
        pdfPath,
      });
    }
  }

  return records;
}

/**
 * 指定年の定例会 PDF リンク一覧を取得する。
 */
export async function fetchSessionList(
  _baseUrl: string,
  year: number,
): Promise<KitajimaSessionInfo[]> {
  const html = await fetchPage(LIST_URL);
  if (!html) return [];

  return parseListPage(html, year);
}
