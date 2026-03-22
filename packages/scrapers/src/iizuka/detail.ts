/**
 * 飯塚市議会スクレイパー — detail フェーズ
 *
 * 会議詳細ページを取得し、セッション日ごとの会議録 PDF URL を抽出して
 * MeetingData に変換する。
 *
 * PDF のテキスト抽出は将来の PDF 抽出サービス対応時に追加するため、
 * 現時点では statements は空配列とする。
 */

import type { MeetingData } from "../types";

const USER_AGENT =
  "open-gikai-bot/1.0 (https://github.com/matsupiee/open-gikai; contact: please see github)";

const BASE_ORIGIN = "https://www.city.iizuka.lg.jp";

export interface IizukaSessionRecord {
  /** 会議タイトル（例: "第2回定例会 6月12日（第1号）"） */
  title: string;
  /** 開催日 YYYY-MM-DD */
  heldOn: string;
  /** PDF の絶対 URL */
  pdfUrl: string;
  /** 会議種別 */
  meetingType: string;
}

/**
 * 会議詳細ページを取得し、セッション日ごとの MeetingData を返す。
 * PDF が未公開の場合は空配列を返す。
 */
export async function fetchMeetingDetails(
  detailUrl: string,
  municipalityId: string,
  pageId: string,
  listTitle: string
): Promise<MeetingData[]> {
  try {
    const res = await fetch(detailUrl, {
      headers: { "User-Agent": USER_AGENT },
    });
    if (!res.ok) return [];

    const html = await res.text();

    // 「作成次第、掲載いたします」→ PDF 未公開
    if (html.includes("作成次第、掲載いたします") && !html.includes("/uploaded/attachment/")) {
      return [];
    }

    const sessions = extractSessionRecords(html, listTitle);
    return sessions.map((s) => ({
      municipalityId,
      title: s.title,
      meetingType: s.meetingType,
      heldOn: s.heldOn,
      sourceUrl: s.pdfUrl,
      externalId: `iizuka_${pageId}_${s.heldOn}`,
      statements: [],
    }));
  } catch (err) {
    console.warn(
      `[iizuka] fetchMeetingDetails failed for ${detailUrl}:`,
      err instanceof Error ? err.message : err
    );
    return [];
  }
}

// --- 内部ユーティリティ ---

/**
 * 和暦の年表記から西暦を返す。
 * 例: "令和6年" → 2024, "令和8年" → 2026
 */
/** @internal テスト用にexport */
export function parseWarekiYear(text: string): number | null {
  const reiwa = text.match(/令和(\d+|元)年/);
  if (reiwa?.[1]) {
    const n = reiwa[1] === "元" ? 1 : parseInt(reiwa[1], 10);
    return 2018 + n;
  }

  const heisei = text.match(/平成(\d+|元)年/);
  if (heisei?.[1]) {
    const n = heisei[1] === "元" ? 1 : parseInt(heisei[1], 10);
    return 1988 + n;
  }

  return null;
}

/**
 * タイトルから会議種別を決定する。
 */
/** @internal テスト用にexport */
export function detectMeetingType(title: string): string {
  if (title.includes("委員会")) return "committee";
  if (title.includes("臨時会") || title.includes("臨時")) return "extraordinary";
  return "plenary";
}

/**
 * 会議詳細ページ HTML からセッション日ごとの PDF レコードを抽出する。
 *
 * PDF リンク構造:
 *   <a href="/uploaded/attachment/9082.pdf">6月12日（第1号）（PDFファイル：548KB）</a>
 *
 * フィルタリング:
 *   - 会期日程 / 議案付託一覧表 / 目次 は除外
 *   - .doc / .xls ファイルは除外
 *   - 「（第N号）」パターンを含むセッション日 PDF のみ対象
 */
/** @internal テスト用にexport */
export function extractSessionRecords(
  html: string,
  listTitle: string
): IizukaSessionRecord[] {
  const records: IizukaSessionRecord[] = [];
  const year = parseWarekiYear(listTitle);
  if (!year) return records;

  const meetingType = detectMeetingType(listTitle);
  // リストタイトルから基本会議名を抽出（括弧の中を除去）
  const baseMeetingName = listTitle.replace(/\(.*?\)|（.*?）/g, "").trim();

  // PDF リンクを抽出
  const pdfPattern =
    /<a\s[^>]*href="(\/uploaded\/attachment\/\d+\.pdf)"[^>]*>([^<]+)<\/a>/gi;

  let m: RegExpExecArray | null;
  while ((m = pdfPattern.exec(html)) !== null) {
    const pdfPath = m[1]!;
    const linkText = m[2]!.trim();

    // 会期日程・議案付託一覧表・目次を除外
    if (
      linkText.includes("日程") ||
      linkText.includes("一覧") ||
      linkText.includes("目次")
    ) {
      continue;
    }

    // セッション日パターン: 「N月N日（第N号）」
    const dateMatch = linkText.match(/(\d{1,2})月(\d{1,2})日/);
    if (!dateMatch) continue;

    const month = parseInt(dateMatch[1]!, 10);
    const day = parseInt(dateMatch[2]!, 10);

    // 年度をまたぐケースの処理:
    // 例: 令和8年2月開催 → 2月は year=2026、3月も year=2026
    // 開催月より前の月（1-3月で開催月が10-12月）の場合は翌年
    const openingMonth = parseOpeningMonth(listTitle);
    let sessionYear = year;
    if (openingMonth !== null && openingMonth >= 10 && month <= 3) {
      sessionYear = year + 1;
    }

    const heldOn = `${sessionYear}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;

    // セッション番号を抽出（例: 「第1号」）
    const sessionMatch = linkText.match(/第(\d+)号/);
    const sessionLabel = sessionMatch?.[1]
      ? `${month}月${day}日（第${sessionMatch[1]}号）`
      : `${month}月${day}日`;

    records.push({
      title: `${baseMeetingName} ${sessionLabel}`,
      heldOn,
      pdfUrl: `${BASE_ORIGIN}${pdfPath}`,
      meetingType,
    });
  }

  return records;
}

/**
 * リストタイトルから開催月を抽出する。
 * 例: "第2回定例会(令和6年6月開催)" → 6
 */
function parseOpeningMonth(listTitle: string): number | null {
  const m = listTitle.match(/(\d{1,2})月開催/);
  return m?.[1] ? parseInt(m[1], 10) : null;
}
