/**
 * 東北町議会 — 共通ユーティリティ
 *
 * サイト: https://www.town.tohoku.lg.jp/chousei/gikai/gikai_kaigiroku.html
 * 町公式サイト内の静的 HTML ページに PDF を直接掲載。
 */

export const BASE_URL =
  "https://www.town.tohoku.lg.jp/chousei/gikai/";
export const TOP_PAGE_URL =
  "https://www.town.tohoku.lg.jp/chousei/gikai/gikai_kaigiroku.html";
export const PAST_LIST_URL =
  "https://www.town.tohoku.lg.jp/chousei/gikai/gikai_kaigiroku-01.html";

const USER_AGENT =
  "open-gikai-bot/1.0 (https://github.com/matsupiee/open-gikai; contact: please see github)";

const FETCH_TIMEOUT_MS = 30_000;
const PDF_FETCH_TIMEOUT_MS = 60_000;

/** fetch して UTF-8 テキストを返す */
export async function fetchPage(url: string): Promise<string | null> {
  try {
    const res = await fetch(url, {
      headers: { "User-Agent": USER_AGENT },
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    });
    if (!res.ok) {
      console.warn(`fetchPage failed: ${url} status=${res.status}`);
      return null;
    }
    return await res.text();
  } catch (e) {
    console.warn(`fetchPage error: ${url}`, e instanceof Error ? e.message : e);
    return null;
  }
}

/** fetch して ArrayBuffer を返す（PDF ダウンロード用） */
export async function fetchBinary(url: string): Promise<ArrayBuffer | null> {
  try {
    const res = await fetch(url, {
      headers: { "User-Agent": USER_AGENT },
      signal: AbortSignal.timeout(PDF_FETCH_TIMEOUT_MS),
    });
    if (!res.ok) {
      console.warn(`fetchBinary failed: ${url} status=${res.status}`);
      return null;
    }
    return await res.arrayBuffer();
  } catch (e) {
    console.warn(
      `fetchBinary error: ${url}`,
      e instanceof Error ? e.message : e,
    );
    return null;
  }
}

/**
 * 相対 href を絶対 URL に変換する。
 * - `file/` で始まる場合: BASE_URL + href
 * - `gikai_kaigiroku-` で始まる場合: BASE_URL + href
 * - すでに絶対パスの場合はそのまま
 */
export function resolveHref(href: string): string {
  if (href.startsWith("http")) {
    return href;
  }
  return BASE_URL + href;
}

/**
 * PDF から抽出されたテキストを正規化する。
 *
 * 東北町の PDF は文字間にスペースが挿入されている形式で抽出される。
 * 例: "令 和 ６ 年 １ ２ 月 １ ０ 日"
 *
 * 処理内容:
 * - 全角数字を半角に変換
 * - 〇（U+3007 漢数字のゼロ）を ○（U+25CB 白丸）に統一
 * - 日本語文字間のスペースを除去して連続した文字列に復元
 */
export function normalizePdfText(text: string): string {
  // 全角数字を半角に変換
  let result = text.replace(/[０-９]/g, (c) =>
    String.fromCharCode(c.charCodeAt(0) - 0xff10 + 0x30),
  );

  // 〇（漢数字ゼロ U+3007）を ○（白丸 U+25CB）に統一
  result = result.replace(/〇/g, "○");

  // スペースで区切られた日本語文字を結合する。
  // 日本語文字（ひらがな、カタカナ、漢字、全角記号）がスペースで区切られているパターンを検出し、
  // 行内のスペースを除去して自然なテキストに戻す。
  //
  // アプローチ: 各行を処理し、日本語文字が1文字ずつスペースで区切られている場合に結合する
  const lines = result.split("\n");
  const normalizedLines = lines.map((line) => {
    // 行がほぼすべて「1文字 スペース」のパターンで構成されているか確認
    // (少なくとも日本語文字の60%以上がスペースで区切られていれば圧縮)
    const tokens = line.split(" ");
    const singleCharTokens = tokens.filter((t) => [...t].length === 1 && /[\u3000-\u9fff\uff00-\uffef（）「」【】]/u.test(t));
    if (tokens.length > 3 && singleCharTokens.length / tokens.length > 0.6) {
      // スペースを除去して結合
      return line.replace(/ /g, "");
    }
    return line;
  });

  return normalizedLines.join("\n");
}

/**
 * 和暦テキストを YYYY-MM-DD に変換する。
 * 対応: 令和（元年含む）・平成
 * 解析できない場合は null を返す。
 */
export function parseJapaneseDate(text: string): string | null {
  // 全角数字を半角に変換
  const normalized = text.replace(/[０-９]/g, (c) =>
    String.fromCharCode(c.charCodeAt(0) - 0xff10 + 0x30),
  );

  // 令和（元年対応）
  const reiwaMatch = normalized.match(/令和(元|\d+)年(\d+)月(\d+)日/);
  if (reiwaMatch) {
    const eraYear = reiwaMatch[1] === "元" ? 1 : parseInt(reiwaMatch[1]!, 10);
    const year = 2018 + eraYear;
    const month = parseInt(reiwaMatch[2]!, 10);
    const day = parseInt(reiwaMatch[3]!, 10);
    return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
  }

  // 平成（元年対応）
  const heiseiMatch = normalized.match(/平成(元|\d+)年(\d+)月(\d+)日/);
  if (heiseiMatch) {
    const eraYear = heiseiMatch[1] === "元" ? 1 : parseInt(heiseiMatch[1]!, 10);
    const year = 1988 + eraYear;
    const month = parseInt(heiseiMatch[2]!, 10);
    const day = parseInt(heiseiMatch[3]!, 10);
    return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
  }

  return null;
}

/**
 * リンクテキストから年度・定例会回次・議員名を正規表現で解析する。
 * 形式: 令和{N}年第{M}回定例会(一般質問){議員名}議員【PDF】
 *
 * 返り値:
 *  - year: 西暦年
 *  - session: 定例会回次 (e.g., "第4回")
 *  - speakerName: 議員名
 */
export function parseLinkText(text: string): {
  year: number | null;
  session: string | null;
  speakerName: string | null;
} {
  const match = text.match(
    /令和(\d+)年第(\d+)回定例会\(一般質問\)(.+?)議員/,
  );
  if (!match) {
    return { year: null, session: null, speakerName: null };
  }

  const eraYear = parseInt(match[1]!, 10);
  const year = 2018 + eraYear;
  const session = `第${match[2]}回`;
  const speakerName = match[3]!.trim();

  return { year, session, speakerName };
}
