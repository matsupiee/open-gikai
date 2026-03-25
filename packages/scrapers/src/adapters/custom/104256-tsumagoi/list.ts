/**
 * 嬬恋村議会（群馬県） — list フェーズ
 *
 * 議会トップページ（単一ページ）から全 PDF リンクとリンクテキストを収集し、
 * 年度見出しと組み合わせてメタ情報を解析する。
 *
 * リンクテキスト例: "第１回定例会（３月）", "第２回臨時会（５月）"
 * 年度見出し例: "令和7年", "令和6年", "平成28年"
 */

import {
  BASE_ORIGIN,
  LIST_PAGE_PATH,
  detectMeetingType,
  fetchPage,
  parseWarekiYear,
  delay,
} from "./shared";

export interface TsumagoiSessionInfo {
  /** 表示用タイトル（例: "令和7年第１回定例会（３月）"） */
  title: string;
  /** 開催年（西暦）。年度見出しから解析 */
  year: number;
  /** 開催月（1-12）。リンクテキストから解析 */
  month: number;
  /** PDF の絶対 URL */
  pdfUrl: string;
  /** 会議種別 */
  meetingType: "plenary" | "extraordinary" | "committee";
}

const INTER_PAGE_DELAY_MS = 1500;

/**
 * 全角数字を半角に変換する。
 */
function toHalfWidth(str: string): string {
  return str.replace(/[０-９]/g, (c) =>
    String.fromCharCode(c.charCodeAt(0) - 0xfee0)
  );
}

/**
 * HTML から年度見出しと PDF リンクを解析し、セッション情報を構築する。
 *
 * ページ構造:
 *   <h3>令和7年</h3>
 *   <ul>
 *     <li><a href=".../simple/7.3.pdf">第３回定例会（６月）</a></li>
 *     ...
 *   </ul>
 *
 * 年度見出しが出現するたびに現在年度を更新し、
 * 直後の PDF リンクに適用する。
 *
 * 実装アプローチ:
 * HTML を順番にスキャンし、年度見出し（h1〜h6 の和暦テキスト）と
 * PDF リンク（href が .pdf で終わるアンカー）を位置順に処理する。
 */
export function parsePdfLinks(html: string): TsumagoiSessionInfo[] {
  const results: TsumagoiSessionInfo[] = [];

  // 年度見出しトークン: <h1>〜<h6> タグに和暦が含まれる場合
  // PDF リンクトークン: <a href="...pdf">...</a>
  // それぞれを位置順に並べてスキャンする
  type Token =
    | { type: "heading"; year: number; pos: number }
    | { type: "link"; href: string; text: string; pos: number };

  const tokens: Token[] = [];

  // 見出しタグの和暦を抽出
  const headingPattern = /<h[1-6][^>]*>([\s\S]*?)<\/h[1-6]>/gi;
  let m: RegExpExecArray | null;
  while ((m = headingPattern.exec(html)) !== null) {
    const text = toHalfWidth(m[1]!.replace(/<[^>]+>/g, "").trim());
    const year = parseWarekiYear(text);
    if (year === null) continue;
    // 見出し内のテキストが年度表記のみ（またはそれに近い）であることを確認
    const stripped = text.replace(/(?:令和|平成)(元|\d+)年/, "").trim();
    if (stripped.length < 10) {
      tokens.push({ type: "heading", year, pos: m.index });
    }
  }

  // PDF リンクを抽出
  const linkPattern = /<a\s[^>]*href="([^"]*\.pdf)"[^>]*>([\s\S]*?)<\/a>/gi;
  while ((m = linkPattern.exec(html)) !== null) {
    const href = m[1]!.trim();
    const rawText = m[2]!
      .replace(/<[^>]+>/g, "")
      .replace(/\(PDF[^)]*\)/gi, "")
      .replace(/（PDF[^）]*）/gi, "")
      .trim();
    if (rawText) {
      tokens.push({ type: "link", href, text: rawText, pos: m.index });
    }
  }

  // 位置順にソート
  tokens.sort((a, b) => a.pos - b.pos);

  let currentYear: number | null = null;

  for (const token of tokens) {
    if (token.type === "heading") {
      currentYear = token.year;
    } else {
      if (currentYear === null) continue;

      const { href, text } = token;

      // リンクテキストから月を抽出
      // パターン: "第１回定例会（３月）" → month=3
      const normalized = toHalfWidth(text);
      const monthMatch = normalized.match(/[（(](\d+)月[）)]/);
      if (!monthMatch) continue;

      const month = parseInt(monthMatch[1]!, 10);
      if (isNaN(month) || month < 1 || month > 12) continue;

      // 絶対 URL に変換
      const pdfUrl = href.startsWith("http")
        ? href
        : `${BASE_ORIGIN}${href.startsWith("/") ? href : `/${href}`}`;

      const meetingType = detectMeetingType(text);
      const title = `${currentYear}年${text}`;

      results.push({
        title,
        year: currentYear,
        month,
        pdfUrl,
        meetingType,
      });
    }
  }

  return results;
}

/**
 * 指定年の会議録セッション一覧を取得する。
 * 単一の一覧ページから全件を収集し、指定年のものだけ返す。
 */
export async function fetchSessionList(
  year: number
): Promise<TsumagoiSessionInfo[]> {
  const url = `${BASE_ORIGIN}${LIST_PAGE_PATH}`;
  const html = await fetchPage(url);
  if (!html) return [];

  await delay(INTER_PAGE_DELAY_MS);

  const all = parsePdfLinks(html);
  return all.filter((s) => s.year === year);
}
