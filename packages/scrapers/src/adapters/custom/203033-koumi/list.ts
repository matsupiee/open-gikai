/**
 * 小海町議会 -- list フェーズ
 *
 * 会議録一覧ページ (post-167.html) から全 PDF リンクを一括で抽出する。
 * ページネーションがないため、1 リクエストで全リンクを取得可能。
 *
 * ページ構造:
 *   <h3>令和８年第１回臨時会</h3>
 *   <a href="{pdfUrl}">会議録.pdf</a>
 *   <h3>令和７年第４回定例会</h3>
 *   <a href="{pdfUrl}">会議録.pdf</a>
 *   ...
 */

import { LIST_PAGE_URL, detectMeetingType, fetchPage, toHankaku } from "./shared";

export interface KoumiSessionInfo {
  /** 会議タイトル（例: "令和７年第４回定例会"） */
  title: string;
  /** 西暦年（例: 2025） */
  year: number;
  /** PDF の絶対 URL */
  pdfUrl: string;
  /** 会議種別 */
  meetingType: string;
  /** 会議を一意に識別するキー（例: "r7-4-teireikai-0"） */
  sessionKey: string;
}

/**
 * h3 テキストから会議情報を抽出する。
 * 例: "令和８年第１回臨時会" → { year: 2026, num: 1, kind: "臨時会" }
 */
export function parseMeetingHeading(heading: string): {
  year: number;
  num: number;
  kind: "定例会" | "臨時会";
} | null {
  const normalized = toHankaku(heading.trim());
  const m = normalized.match(/^(令和|平成)(\d+|元)年第(\d+)回(定例会|臨時会)/);
  if (!m) return null;

  const era = m[1]!;
  const rawYear = m[2]!;
  const num = parseInt(m[3]!, 10);
  const kind = m[4] as "定例会" | "臨時会";

  const n = rawYear === "元" ? 1 : parseInt(rawYear, 10);
  const year = era === "令和" ? 2018 + n : 1988 + n;

  return { year, num, kind };
}

/**
 * 会議録一覧ページ HTML から全セッション情報を抽出する。
 *
 * h3 要素をアンカーとして、その後続要素から .pdf リンクを収集する。
 * 全角数字は半角に変換してからパースする。
 */
export function parseListPage(html: string): KoumiSessionInfo[] {
  const sessions: KoumiSessionInfo[] = [];

  // h3 タグとその後続 a[href$=".pdf"] を順番に処理する
  // h3 とリンクの組み合わせをラインごとに走査
  // h3 の配列を抽出してから、その間のリンクを収集する
  const h3Pattern = /<h3[^>]*>([\s\S]*?)<\/h3>/gi;
  const h3Matches: Array<{ text: string; index: number }> = [];

  let m: RegExpExecArray | null;
  while ((m = h3Pattern.exec(html)) !== null) {
    const rawText = m[1]!
      .replace(/<[^>]+>/g, "")
      .replace(/&nbsp;/g, " ")
      .replace(/\s+/g, " ")
      .trim();
    h3Matches.push({ text: rawText, index: m.index });
  }

  for (let i = 0; i < h3Matches.length; i++) {
    const current = h3Matches[i]!;
    const info = parseMeetingHeading(current.text);
    if (!info) continue;

    // この h3 から次の h3 までの範囲を切り出す
    const nextIndex = h3Matches[i + 1]?.index ?? html.length;
    const segment = html.slice(current.index, nextIndex);

    // PDF リンクを抽出
    const pdfPattern = /href="([^"]*\.pdf)"/gi;
    let pdfMatch: RegExpExecArray | null;
    let pdfIndex = 0;

    while ((pdfMatch = pdfPattern.exec(segment)) !== null) {
      const href = pdfMatch[1]!;
      const pdfUrl = href.startsWith("http") ? href : `https://www.koumi-town.jp${href.startsWith("/") ? "" : "/"}${href}`;

      const sessionKey = `${info.year}-${info.num}-${info.kind}-${pdfIndex}`;

      sessions.push({
        title: current.text.replace(/\s+/g, ""),
        year: info.year,
        pdfUrl,
        meetingType: detectMeetingType(current.text),
        sessionKey,
      });

      pdfIndex++;
    }
  }

  return sessions;
}

/**
 * 指定年の全セッション情報を取得する。
 * 一覧ページは1ページのみのためページネーションなし。
 */
export async function fetchSessionList(
  _baseUrl: string,
  year: number
): Promise<KoumiSessionInfo[]> {
  const html = await fetchPage(LIST_PAGE_URL);
  if (!html) return [];

  const allSessions = parseListPage(html);

  return allSessions.filter((s) => s.year === year);
}
