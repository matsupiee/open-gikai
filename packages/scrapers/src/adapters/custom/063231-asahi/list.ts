/**
 * 朝日町教育委員会 定例会会議録 — list フェーズ
 *
 * 一覧ページ（9645.html）から PDF リンクを取得する。
 * 1ページに年度内の全会議録 PDF リンクが掲載される単純な構造。
 *
 * PDF 命名規則:
 *   R{和暦年}_{月}.pdf          — 通常 (e.g., R6_4.pdf)
 *   R{和暦年}_{月}shusei.pdf   — 修正版 (e.g., R6_7shusei.pdf)
 *   R{和暦年}_{月}rinji.pdf    — 臨時会 (e.g., R7_3rinji.pdf)
 *
 * リンクテキスト: "令和6年4月定例会 (PDFファイル: 258.1KB)"
 */

import { BASE_ORIGIN, INDEX_PATH, fetchPage, toEraPrefix } from "./shared";

export interface AsahiMeeting {
  pdfUrl: string;
  title: string;
  heldOn: string;
  sessionName: string;
}

/**
 * PDF ファイル名から和暦年・月を抽出する。
 * e.g., "R6_4.pdf" → { eraChar: "R", eraYear: 6, month: 4 }
 *       "R6_7shusei.pdf" → { eraChar: "R", eraYear: 6, month: 7 }
 *       "R7_3rinji.pdf" → { eraChar: "R", eraYear: 7, month: 3 }
 */
function parseFilename(filename: string): {
  eraChar: string;
  eraYear: number;
  month: number;
  suffix: string;
} | null {
  const match = filename.match(
    /^([RH])(\d+)_(\d+)(shusei|rinji)?\.pdf$/i
  );
  if (!match) return null;
  return {
    eraChar: match[1]!.toUpperCase(),
    eraYear: parseInt(match[2]!, 10),
    month: parseInt(match[3]!, 10),
    suffix: match[4] ?? "",
  };
}

/**
 * 和暦年と月から西暦の YYYY-MM-01 を生成する。
 * 教育委員会定例会は月単位なので日は 01 固定。
 */
export function toHeldOn(eraChar: string, eraYear: number, month: number): string {
  let westernYear: number;
  if (eraChar === "R") {
    westernYear = eraYear + 2018;
  } else {
    westernYear = eraYear + 1988;
  }
  return `${westernYear}-${String(month).padStart(2, "0")}-01`;
}

/**
 * 一覧ページ HTML から PDF リンクを抽出する。
 *
 * 修正版（shusei サフィックス）がある月は修正版を優先し、
 * 通常版はスキップする。
 */
export function parseListPage(
  html: string,
  eraPrefix: string
): AsahiMeeting[] {
  const meetings: AsahiMeeting[] = [];
  const eraPrefixUpper = eraPrefix.toUpperCase();

  // PDF リンクを抽出
  const linkPattern =
    /<a[^>]+href="([^"]+\.pdf)"[^>]*>([^<]*)<\/a>/gi;

  for (const match of html.matchAll(linkPattern)) {
    let href = match[1]!;
    const linkText = match[2]!.trim();

    // material/files/group/11/ 配下の PDF のみ対象
    if (!href.includes("material/files/group/11/")) continue;

    // protocol-relative URL を https に変換
    if (href.startsWith("//")) {
      href = `https:${href}`;
    } else if (!href.startsWith("http")) {
      href = `${BASE_ORIGIN}${href.startsWith("/") ? "" : "/"}${href}`;
    }

    const filename = href.split("/").pop() ?? "";
    const parsed = parseFilename(filename);
    if (!parsed) continue;

    // 対象年度のプレフィックスでフィルタ
    const filePrefix = `${parsed.eraChar}${parsed.eraYear}`;
    if (filePrefix !== eraPrefixUpper) continue;

    const heldOn = toHeldOn(parsed.eraChar, parsed.eraYear, parsed.month);

    // リンクテキストからタイトルを抽出（ファイルサイズ部分を除去）
    const titleMatch = linkText.match(/^(.+?)\s*[\(（]/);
    const title = titleMatch ? titleMatch[1]!.trim() : linkText;

    const sessionName = parsed.suffix === "rinji" ? "臨時会" : "定例会";

    meetings.push({
      pdfUrl: href,
      title,
      heldOn,
      sessionName,
    });
  }

  // 修正版がある月は通常版をスキップ
  return deduplicateWithShusei(meetings);
}

/**
 * 同じ月に通常版と修正版が存在する場合、修正版を優先する。
 */
function deduplicateWithShusei(meetings: AsahiMeeting[]): AsahiMeeting[] {
  // 修正版が存在する月を特定
  const shuseiMonths = new Set<string>();
  for (const m of meetings) {
    const filename = m.pdfUrl.split("/").pop() ?? "";
    if (filename.includes("shusei")) {
      // heldOn (YYYY-MM-01) を月キーとして使用
      shuseiMonths.add(m.heldOn);
    }
  }

  return meetings.filter((m) => {
    const filename = m.pdfUrl.split("/").pop() ?? "";
    // 修正版がある月の通常版はスキップ
    if (shuseiMonths.has(m.heldOn) && !filename.includes("shusei") && !filename.includes("rinji")) {
      return false;
    }
    return true;
  });
}

/**
 * 指定年度の全会議録 PDF 一覧を取得する。
 * year は年度の開始年（西暦）。e.g., 2024 → 令和6年度
 *
 * 年度は 4月〜翌3月。PDF の命名規則上、
 * R6_4 〜 R6_12 が令和6年度前半、R7_1 〜 R7_3 が令和6年度後半。
 */
export async function fetchMeetingList(
  year: number
): Promise<AsahiMeeting[]> {
  const eraPrefix = toEraPrefix(year);
  if (!eraPrefix) return [];

  // 翌年のプレフィックスも必要（1〜3月分）
  const nextEraPrefix = toEraPrefix(year + 1);

  const indexUrl = `${BASE_ORIGIN}${INDEX_PATH}`;
  const indexHtml = await fetchPage(indexUrl);
  if (!indexHtml) return [];

  // 年度前半（4〜12月）
  const firstHalf = parseListPage(indexHtml, eraPrefix).filter((m) => {
    const month = parseInt(m.heldOn.split("-")[1]!, 10);
    return month >= 4;
  });

  // 年度後半（1〜3月）
  const secondHalf = nextEraPrefix
    ? parseListPage(indexHtml, nextEraPrefix).filter((m) => {
        const month = parseInt(m.heldOn.split("-")[1]!, 10);
        return month >= 1 && month <= 3;
      })
    : [];

  return [...firstHalf, ...secondHalf];
}
