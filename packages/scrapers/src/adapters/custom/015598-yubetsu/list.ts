/**
 * 湧別町議会 — list フェーズ
 *
 * https://www.town.yubetsu.lg.jp/administration/town/detail.html?content=516
 * の単一ページから全年度・全会議種別の「会議録」PDF リンクを収集する。
 *
 * HTML 構造:
 *   <h2>令和8年（会議結果・議事録）</h2>
 *   <ul>
 *     <li>
 *       <h3>第1回定例会（令和8年3月4日）</h3>
 *     </li>
 *     <li>
 *       <a href="../../common/img/content/content_xxx.pdf">3月4日　会議結果（1日目）　PDF(33KB)</a>
 *     </li>
 *     <li>
 *       <a href="../../common/img/content/content_yyy.pdf">3月4日　会議録（1日目）　PDF(740KB)</a>
 *     </li>
 *   </ul>
 *
 * 「会議録」を含むリンクテキストのみを対象とし、「会議結果」は除外する。
 *
 * 開催日の取得:
 *   - リンクテキストに月日がある場合 (例: "9月16日　会議録（1日目）") → 直前の h2 の年度と合わせて組み立てる
 *   - リンクテキストに月日がない場合 (例: "会議録　PDF(740KB)") → h3 の meeting title から取得
 *   - どちらでも取得できない場合 → null（PDF テキストから取得）
 */

import {
  BASE_URL,
  detectMeetingType,
  eraToWesternYear,
  fetchPage,
  normalizeNumbers,
  parseJapaneseDate,
  resolvePdfUrl,
} from "./shared";

export interface YubetsuMeeting {
  /** PDF の完全 URL */
  pdfUrl: string;
  /** 会議タイトル（例: "令和7年 第1回臨時会 会議録"） */
  title: string;
  /** 開催日 YYYY-MM-DD（解析できない場合は null） */
  heldOn: string | null;
  /** 会議種別（"plenary" / "extraordinary" / "committee"） */
  meetingType: string;
}

/** HTML タグを除去してプレーンテキストを返す */
function stripHtml(html: string): string {
  return html.replace(/<[^>]+>/g, "").replace(/&nbsp;/g, " ").trim();
}

/**
 * リンクテキストから開催日（月日）を抽出する。
 * 年は別途コンテキストから渡す。
 *
 * パターン:
 *   "9月16日　会議録（1日目）　PDF(1294KB)" → month=9, day=16
 *   "会議録　PDF(740KB)" → null
 */
function parseDateFromLinkText(
  linkText: string,
  westernYear: number,
): string | null {
  const normalized = normalizeNumbers(linkText);
  const match = normalized.match(/(\d+)月(\d+)日/);
  if (!match) return null;

  const month = parseInt(match[1]!, 10);
  const day = parseInt(match[2]!, 10);
  return `${westernYear}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

/**
 * 一覧ページ HTML をパースして PDF リンク一覧を返す（テスト可能な純粋関数）。
 *
 * 構造:
 *   h2 で年度を区切り（例: "令和8年（会議結果・議事録）"）
 *   h3 で会議種別を区切り（例: "第1回定例会（令和8年3月4日）"）
 *   各 h3 セクション内の a[href$=".pdf"] から PDF URL と開催日を抽出する。
 */
export function parseListPage(html: string): YubetsuMeeting[] {
  const results: YubetsuMeeting[] = [];

  // h2 見出しの位置と年度を収集
  const h2Pattern = /<h2[^>]*>([\s\S]*?)<\/h2>/gi;
  const h2s: { index: number; westernYear: number; text: string }[] = [];
  for (const match of html.matchAll(h2Pattern)) {
    const text = stripHtml(match[1]!);
    const normalized = normalizeNumbers(text);
    const yearMatch = normalized.match(/(令和|平成)(元|\d+)年/);
    if (!yearMatch) continue;
    const westernYear = eraToWesternYear(yearMatch[1]!, yearMatch[2]!);
    if (!westernYear) continue;
    h2s.push({ index: match.index!, westernYear, text });
  }

  // h3 見出しの位置と会議名を収集（例: "第1回定例会（令和8年3月4日）"）
  const h3Pattern = /<h3[^>]*>([\s\S]*?)<\/h3>/gi;
  const h3s: { index: number; name: string; heldOn: string | null }[] = [];
  for (const match of html.matchAll(h3Pattern)) {
    const text = stripHtml(match[1]!);
    // 開催日を h3 テキストから抽出（例: "第1回定例会（令和8年3月4日）"）
    const heldOn = parseJapaneseDate(text);
    // 会議名部分を抽出（括弧前まで）
    const name = text.replace(/（[\s\S]*?）$/, "").trim();
    h3s.push({ index: match.index!, name, heldOn });
  }

  // PDF リンクを収集（会議録のみ）
  const linkPattern = /<a[^>]+href="([^"]*\.pdf)"[^>]*>([\s\S]*?)<\/a>/gi;

  for (const linkMatch of html.matchAll(linkPattern)) {
    const linkIndex = linkMatch.index!;
    const href = linkMatch[1]!;
    const linkText = stripHtml(linkMatch[2]!);

    // 「会議録」を含まないリンクはスキップ（「会議結果」など）
    if (!linkText.includes("会議録")) continue;

    // PDF URL を絶対 URL に変換
    const pdfUrl = resolvePdfUrl(href);

    // リンク位置より前にある最近の h2 年度を特定
    let currentWesternYear: number | null = null;
    let currentYearText = "";
    for (const h2 of h2s) {
      if (h2.index < linkIndex) {
        currentWesternYear = h2.westernYear;
        currentYearText = h2.text;
      }
    }

    // リンク位置より前にある最近の h3 会議名を特定
    let currentMeetingName = "";
    let h3HeldOn: string | null = null;
    for (const h3 of h3s) {
      if (h3.index < linkIndex) {
        currentMeetingName = h3.name;
        h3HeldOn = h3.heldOn;
      }
    }

    // 開催日を解析
    // 1. リンクテキストに月日があれば年度コンテキストと組み合わせる
    let heldOn: string | null = null;
    if (currentWesternYear !== null) {
      heldOn = parseDateFromLinkText(linkText, currentWesternYear);
    }
    // 2. リンクテキストに月日がなければ h3 の日付を使う（単一日の会議）
    if (!heldOn) {
      heldOn = h3HeldOn;
    }

    // タイトルを組み立てる
    const yearPart = currentYearText
      ? normalizeNumbers(currentYearText).replace(/（.*）$/, "").trim()
      : "";
    const meetingPart = currentMeetingName || "";
    const title = [yearPart, meetingPart, "会議録"]
      .filter(Boolean)
      .join(" ");

    results.push({
      pdfUrl,
      title,
      heldOn,
      meetingType: detectMeetingType(title),
    });
  }

  return results;
}

/**
 * 指定年の会議録 PDF リンクを取得する。
 */
export async function fetchMeetingList(year: number): Promise<YubetsuMeeting[]> {
  const html = await fetchPage(BASE_URL);
  if (!html) return [];

  const allMeetings = parseListPage(html);

  // 開催日でフィルタ。取得できていないものも残す（PDF 内から取得する）
  return allMeetings.filter((m) => {
    if (!m.heldOn) return true;
    const meetingYear = parseInt(m.heldOn.split("-")[0]!, 10);
    return meetingYear === year;
  });
}
