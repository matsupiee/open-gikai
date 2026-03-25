/**
 * 由布市議会 — list フェーズ
 *
 * 会議録一覧ページから PDF URL とメタ情報を収集する。
 *
 * ## ページ構造
 * - <h3> で年度区切り（例: "令和７年"、全角数字の場合あり）
 * - <p>◆第N回定例会</p> または <p>◆第N回臨時会</p> で会議区切り
 * - <p><a href="/uploads/files/...">初日（R7.2.25）</a></p> で個別 PDF リンク
 *
 * ## フロー
 * 1. 一覧ページを単一取得
 * 2. <h3> → <p> テキストで年度・会議種別を追跡
 * 3. <a href$=".pdf"> からリンクテキストと URL を収集
 * 4. リンクテキストの括弧内日付（例: "初日（R7.2.25）"）から開催日を抽出
 */

import {
  BASE_ORIGIN,
  LIST_URL,
  detectMeetingType,
  fetchPage,
  parseWarekiYear,
  toHalfWidth,
  delay,
} from "./shared";

export interface YufuSessionInfo {
  /** 会議タイトル（例: "令和7年第1回定例会 初日"） */
  title: string;
  /** 開催日 YYYY-MM-DD（解析できない場合は null） */
  heldOn: string | null;
  /** PDF の絶対 URL */
  pdfUrl: string;
  /** 会議種別 */
  meetingType: "plenary" | "extraordinary" | "committee";
}

const INTER_REQUEST_DELAY_MS = 1500;

/**
 * <h3> テキストから年度情報を解析する。
 * 例: "令和７年" → { era: "令和", yearStr: "7", westernYear: 2025 }
 * 全角数字も対応。
 */
export function parseYearHeading(heading: string): number | null {
  // 全角数字を半角に変換してから解析
  const normalized = toHalfWidth(heading);
  const m = normalized.match(/(令和|平成|昭和)(元|\d+)年/);
  if (!m) return null;
  return parseWarekiYear(m[1]!, m[2]!);
}

/**
 * <p> テキストから会議セクション情報（種別・回次・ラベル）を解析する。
 * 例: "◆第1回定例会" → { label: "第1回定例会", meetingType: "plenary" }
 * 解析できない場合は null を返す。
 */
export function parseSessionLabel(
  text: string,
): { label: string; meetingType: "plenary" | "extraordinary" | "committee" } | null {
  const m = text.match(/◆(.+)/);
  if (!m?.[1]) return null;
  const label = m[1].trim();
  return {
    label,
    meetingType: detectMeetingType(label),
  };
}

/**
 * リンクテキストから開催日 YYYY-MM-DD を抽出する。
 *
 * 由布市のリンクテキストは以下のパターン:
 * - "初日（R7.2.25）" → era=R, waYear=7, month=2, day=25
 * - "２日目（R7.2.28）" → era=R, waYear=7, month=2, day=28
 * - "初日（H17.9.5）" → era=H, waYear=17, month=9, day=5
 *
 * 解析できない場合は null を返す。
 */
export function extractDateFromLinkText(linkText: string): string | null {
  // 括弧内の元号略称付き日付を抽出: "（R7.2.25）" or "（H17.9.5）"
  const normalized = toHalfWidth(linkText);
  const m = normalized.match(/[（(]([RrHh])(\d+)\.(\d+)\.(\d+)[)）]/);
  if (!m) return null;

  const eraChar = m[1]!.toUpperCase();
  const waYear = parseInt(m[2]!, 10);
  const month = parseInt(m[3]!, 10);
  const day = parseInt(m[4]!, 10);

  let westernYear: number;
  if (eraChar === "R") {
    westernYear = 2018 + waYear;
  } else if (eraChar === "H") {
    westernYear = 1988 + waYear;
  } else {
    return null;
  }

  return `${westernYear}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

/**
 * 一覧ページの HTML から PDF リンク情報を収集する。
 * 指定年（westernYear）のレコードのみを返す。
 */
export function parsePdfLinksFromList(
  html: string,
  filterYear: number,
): YufuSessionInfo[] {
  const results: YufuSessionInfo[] = [];

  // HTMLを行単位で処理し、h3 / p の出現順にトラッキングする
  // 正規表現でブロック単位にパース
  let currentYear: number | null = null;
  let currentSessionLabel: string | null = null;
  let currentMeetingType: "plenary" | "extraordinary" | "committee" = "plenary";

  // h3タグとpタグを順番に処理するため、すべてのマッチを収集
  const tokenRegex =
    /<h3[^>]*>([\s\S]*?)<\/h3>|<p[^>]*>([\s\S]*?)<\/p>/gi;

  for (const match of html.matchAll(tokenRegex)) {
    const fullMatch = match[0]!;

    if (fullMatch.toLowerCase().startsWith("<h3")) {
      // h3 → 年度の更新
      const rawText = (match[1] ?? "")
        .replace(/<[^>]+>/g, "")
        .replace(/&nbsp;/g, " ")
        .trim();
      const year = parseYearHeading(rawText);
      if (year !== null) {
        currentYear = year;
        currentSessionLabel = null; // 年度が変わったらセッションをリセット
      }
    } else {
      // p → セッションラベルまたは PDF リンク
      const rawContent = match[2] ?? "";

      // ◆ で始まる場合は会議セクション
      const plainText = rawContent
        .replace(/<[^>]+>/g, "")
        .replace(/&nbsp;/g, " ")
        .trim();

      if (plainText.startsWith("◆")) {
        const sessionInfo = parseSessionLabel(plainText);
        if (sessionInfo) {
          currentSessionLabel = sessionInfo.label;
          currentMeetingType = sessionInfo.meetingType;
        }
        continue;
      }

      // PDF リンクを含む場合
      if (currentYear !== filterYear) continue;
      if (!currentSessionLabel) continue;

      // <a href="...pdf">...</a> を抽出
      const pdfPattern = /<a\s[^>]*href=["']([^"']*\.pdf)["'][^>]*>([\s\S]*?)<\/a>/gi;
      for (const pdfMatch of rawContent.matchAll(pdfPattern)) {
        const rawHref = pdfMatch[1] ?? "";
        const rawLinkText = pdfMatch[2] ?? "";

        if (!rawHref) continue;

        // 絶対 URL に変換
        let pdfUrl: string;
        if (rawHref.startsWith("http")) {
          pdfUrl = rawHref;
        } else {
          pdfUrl = `${BASE_ORIGIN}${rawHref}`;
        }

        // リンクテキストのHTMLを除去
        const linkText = rawLinkText
          .replace(/<[^>]+>/g, "")
          .replace(/&nbsp;/g, " ")
          .trim();

        if (!linkText) continue;

        const heldOn = extractDateFromLinkText(linkText);
        const title = `${currentYear}年${currentSessionLabel} ${linkText}`;

        results.push({
          title,
          heldOn,
          pdfUrl,
          meetingType: currentMeetingType,
        });
      }
    }
  }

  return results;
}

/**
 * 指定年の会議一覧を取得する。
 */
export async function fetchSessionList(year: number): Promise<YufuSessionInfo[]> {
  const html = await fetchPage(LIST_URL);
  if (!html) {
    console.warn(`[442135-yufu] Failed to fetch list page: ${LIST_URL}`);
    return [];
  }

  await delay(INTER_REQUEST_DELAY_MS);

  return parsePdfLinksFromList(html, year);
}
