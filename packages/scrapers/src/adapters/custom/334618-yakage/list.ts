/**
 * 矢掛町議会 — list フェーズ
 *
 * 単一の会議録一覧ページから PDF リンクを収集する。
 *
 * HTML 構造:
 *   <p class="link01"><a href="...pdf">平成28年9月定例議会会議録（PDF:1159KB）</a></p>
 *   <p class="link01"><a href="...pdf">令和5年第1回矢掛町議会第1回定例会・第2回矢掛町議会第1回臨時会（PDF:3.07MB）</a></p>
 *
 * 注意事項:
 * - リンクテキストに会議名・ファイルサイズが含まれる
 * - 一部の PDF は二重拡張子（.pdf.pdf）
 * - 複数の会議が1つの PDF にまとめられているケースがある
 * - 「第N回議会第N回定例会」などの通し番号方式（令和3年以降）に対応
 */

import { BASE_ORIGIN, buildEraTitle, eraToWesternYear, fetchPage } from "./shared";

export interface YakageMeeting {
  pdfUrl: string;
  title: string;
  heldOn: string | null;
  meetingKind: string;
}

/**
 * リンクテキストからファイルサイズ表記を除去する。
 * e.g., "平成28年9月定例議会会議録（PDF:1159KB）" → "平成28年9月定例議会会議録"
 */
export function removeSizeAnnotation(text: string): string {
  return text
    .replace(/[（(]PDF[:：].+?[）)]/gi, "")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * リンクテキストから会議情報を解析する。
 *
 * パターン1: "平成28年9月定例議会会議録"
 *   → year=2016, month=9, kind=定例議会
 *
 * パターン2: "令和5年第1回矢掛町議会第1回定例会・第2回矢掛町議会第1回臨時会"
 *   → year=2023, kind=定例会 (先頭の会議種別を使用)
 *
 * パターン3: "令和3年第3回議会第3回定例会"
 *   → year=2021, kind=定例会
 *
 * 戻り値の heldOn は YYYY-MM 形式（日は不明のため）。
 */
export function parseLinkText(rawText: string): {
  year: number;
  month: number | null;
  meetingKind: string;
  title: string;
} | null {
  const text = removeSizeAnnotation(rawText);

  // 和暦パターンを抽出
  const eraMatch = text.match(/(平成|令和)(元|[\d]+)年/);
  if (!eraMatch) return null;

  const era = eraMatch[1]!;
  const yearStr = eraMatch[2]!;
  const year = eraToWesternYear(era, yearStr);

  // 会議種別を特定 (定例議会 > 臨時議会 > 定例会 > 臨時会 の優先順)
  let meetingKind: string;
  if (text.includes("臨時議会") || text.includes("臨時会")) {
    // 定例と臨時が両方含まれる場合は定例を優先
    if (text.includes("定例議会") || text.includes("定例会")) {
      meetingKind = text.includes("定例議会") ? "定例議会" : "定例会";
    } else {
      meetingKind = text.includes("臨時議会") ? "臨時議会" : "臨時会";
    }
  } else if (text.includes("定例議会")) {
    meetingKind = "定例議会";
  } else if (text.includes("定例会")) {
    meetingKind = "定例会";
  } else {
    // 不明な場合はその他
    meetingKind = "定例議会";
  }

  // 開催月を抽出
  // パターン1: "9月定例議会" → 9
  // パターン2: "第1回定例会" → 月情報なし
  let month: number | null = null;

  // 月+会議種別パターン
  const monthMatch = text.match(/(\d+)月(?:定例議会|臨時議会)/);
  if (monthMatch) {
    month = parseInt(monthMatch[1]!, 10);
    if (month < 1 || month > 12) month = null;
  }

  // 第N回定例会パターン: 月が不明の場合はセッション番号から推定しない
  // (実際の月はリンクテキストから取れないため null のまま)

  return { year, month, meetingKind, title: text };
}

/**
 * 開催月から heldOn を生成する。
 * 月が不明の場合は null を返す（"1970-01-01" 禁止）。
 */
export function buildHeldOn(year: number, month: number | null): string | null {
  if (!month) return null;
  return `${year}-${String(month).padStart(2, "0")}-01`;
}

/**
 * タイトルを正規化する。
 * ファイルサイズ表記を除去して整形する。
 */
export function buildTitle(year: number, text: string): string {
  const cleaned = removeSizeAnnotation(text);
  // 既に和暦年を含むタイトルをそのまま使う
  if (/(平成|令和)/.test(cleaned)) return cleaned;
  return `${buildEraTitle(year)}${cleaned}`;
}

/**
 * 会議録一覧ページの HTML から PDF リンクを抽出する。
 *
 * - `<p class="link01">` 内の `<a href="...pdf">` を抽出
 * - 指定年の PDF のみ抽出
 */
export function parseListPage(html: string, year: number): YakageMeeting[] {
  const results: YakageMeeting[] = [];

  // PDF リンクを抽出: href が .pdf または .pdf.pdf で終わるリンク
  const linkRegex = /<a\s[^>]*href="([^"]*\.pdf(?:\.pdf)?)"[^>]*>([\s\S]*?)<\/a>/gi;

  for (const match of html.matchAll(linkRegex)) {
    const href = match[1]!;
    const rawText = match[2]!
      .replace(/<[^>]+>/g, "")
      .replace(/\s+/g, " ")
      .trim();

    if (!rawText) continue;

    const info = parseLinkText(rawText);
    if (!info) continue;

    // 対象年のみ抽出
    if (info.year !== year) continue;

    // PDF の絶対 URL を構築
    let pdfUrl: string;
    if (href.startsWith("http")) {
      pdfUrl = href;
    } else if (href.startsWith("//")) {
      pdfUrl = `http:${href}`;
    } else if (href.startsWith("/")) {
      pdfUrl = `${BASE_ORIGIN}${href}`;
    } else {
      pdfUrl = `${BASE_ORIGIN}/${href}`;
    }

    const heldOn = buildHeldOn(info.year, info.month);
    const title = buildTitle(info.year, rawText);

    results.push({
      pdfUrl,
      title,
      heldOn,
      meetingKind: info.meetingKind,
    });
  }

  // heldOn でソート（null は末尾）
  results.sort((a, b) => {
    if (!a.heldOn && !b.heldOn) return 0;
    if (!a.heldOn) return 1;
    if (!b.heldOn) return -1;
    return a.heldOn.localeCompare(b.heldOn);
  });

  return results;
}

/**
 * 指定年の全 PDF リンクを取得する。
 */
export async function fetchMeetingList(
  baseUrl: string,
  year: number
): Promise<YakageMeeting[]> {
  const html = await fetchPage(baseUrl);
  if (!html) return [];

  return parseListPage(html, year);
}
