/**
 * 藍住町議会 — list フェーズ
 *
 * 年別ページ (r{N}.html / h{N}.html) から PDF リンクを抽出する。
 * 各 PDF が1回の定例会に対応する。
 *
 * リンクテキスト例: 令和7年第4回(12月)定例会会議録[PDF：923KB]
 */

import {
  BASE_ORIGIN,
  buildYearPageUrl,
  detectMeetingType,
  parseWarekiYear,
  fetchPage,
} from "./shared";

export interface AizumiSessionInfo {
  /** 会議タイトル（例: "令和7年第4回定例会"） */
  title: string;
  /** 開催月から推定した日付 YYYY-MM-01 */
  heldOn: string;
  /** PDF の絶対 URL */
  pdfUrl: string;
  /** 会議種別 */
  meetingType: string;
  /** 外部 ID 用キー (PDF URL のパス部分) */
  pdfPath: string;
}

/**
 * 指定年の全定例会 PDF を収集する。
 */
export async function fetchSessionList(
  _baseUrl: string,
  year: number,
): Promise<AizumiSessionInfo[]> {
  const yearPageUrl = buildYearPageUrl(year);
  if (!yearPageUrl) return [];

  const html = await fetchPage(yearPageUrl);
  if (!html) return [];

  return parseYearPage(html, year);
}

/**
 * 年別ページ HTML から PDF リンクを抽出する（テスト可能な純粋関数）。
 */
export function parseYearPage(
  html: string,
  expectedYear: number,
): AizumiSessionInfo[] {
  const records: AizumiSessionInfo[] = [];

  // PDF リンクを抽出: <a href="...pdf">テキスト</a>
  const pattern =
    /<a\s[^>]*href="([^"]*\.pdf)"[^>]*>([\s\S]*?)<\/a>/gi;

  let m: RegExpExecArray | null;
  while ((m = pattern.exec(html)) !== null) {
    const href = m[1]!;
    const linkText = m[2]!.replace(/\s+/g, " ").trim();

    // 会議録の PDF のみ対象（会議録を含むリンクテキスト）
    if (!linkText.includes("会議録")) continue;

    const parsed = parseSessionFromLinkText(linkText, href, expectedYear);
    if (parsed) {
      records.push(parsed);
    }
  }

  return records;
}

/**
 * リンクテキストからセッション情報を抽出する。
 *
 * 期待フォーマット: 令和X年第N回(M月)定例会会議録[PDF：サイズ]
 */
export function parseSessionFromLinkText(
  linkText: string,
  href: string,
  expectedYear: number,
): AizumiSessionInfo | null {
  // 会期情報の抽出
  const sessionPattern =
    /(令和|平成)(\d+|元)年(第(\d+)回)\((\d+)月\)(定例会|臨時会)/;
  const match = linkText.match(sessionPattern);
  if (!match) return null;

  const era = match[1]!;
  const eraYear = match[2]!;
  const sessionNum = match[4]!;
  const month = parseInt(match[5]!, 10);
  const sessionType = match[6]!;

  // 和暦テキストから西暦年を取得
  const warekiText = `${era}${eraYear}年`;
  const year = parseWarekiYear(warekiText);
  if (!year || year !== expectedYear) return null;

  const heldOn = `${year}-${String(month).padStart(2, "0")}-01`;

  // PDF URL を絶対パスに
  const pdfUrl = href.startsWith("http")
    ? href
    : new URL(href, BASE_ORIGIN).toString();

  // タイトル: [PDF:...] 部分を除去
  const title = `${era}${eraYear}年第${sessionNum}回${sessionType}`;

  const meetingType = detectMeetingType(sessionType);

  // pdfPath: URL のパス部分を外部 ID として使用
  const pdfPath = new URL(pdfUrl).pathname;

  return {
    title,
    heldOn,
    pdfUrl,
    meetingType,
    pdfPath,
  };
}
