/**
 * 都農町議会 — list フェーズ
 *
 * UrbanOS バックエンド API から2つの articleId に対してリクエストを送り、
 * PDF リンクを収集する。
 *
 * API レスポンスの textContentSec 配列:
 *   - textType: "T1" → 年度ごとの見出し（例: "令和7年定例会会議録"）
 *   - textType: "L"  → PDF リンク（linkDisplayName にラベル、linkUrl に URL）
 *   - textType: "C"  → 説明テキスト（スキップ）
 */

import {
  ARTICLE_IDS,
  extractYearFromHeading,
  fetchArticle,
  parseLinkLabel,
  toEraString,
} from "./shared";

export interface TsunoMeeting {
  pdfUrl: string;
  title: string;
  /** YYYY-MM-DD 形式（年のみ判明の場合は YYYY-01-01） */
  heldOn: string;
  meetingKind: string;
  /** 回次（第N回の N） */
  session: number | null;
}

interface TextContentSec {
  textType: "C" | "T1" | "L";
  textContent: string | null;
  linkDisplayName: string | null;
  linkUrl: string | null;
  textContentSortOrder: number;
}

/**
 * API レスポンスから TextContentSec 配列を取得する。
 */
function extractSections(data: unknown): TextContentSec[] {
  if (
    typeof data !== "object" ||
    data === null
  ) {
    return [];
  }

  try {
    const d = data as Record<string, unknown>;
    const dataField = d["data"] as Record<string, unknown> | undefined;
    if (!dataField) return [];

    const jpn = dataField["jpn"] as Record<string, unknown> | undefined;
    if (!jpn) return [];

    const contentsSec = jpn["contentsSec"] as Record<string, unknown> | undefined;
    if (!contentsSec) return [];

    const sections = contentsSec["textContentSec"];
    if (!Array.isArray(sections)) return [];

    return sections as TextContentSec[];
  } catch {
    return [];
  }
}

/**
 * API レスポンスの sections から指定年の TsunoMeeting を抽出する。
 */
export function extractMeetingsFromSections(
  sections: TextContentSec[],
  year: number
): TsunoMeeting[] {
  const results: TsunoMeeting[] = [];
  let currentHeadingYear: number | null = null;
  let currentMeetingKind: string | null = null;

  for (const sec of sections) {
    if (sec.textType === "T1" && sec.textContent) {
      currentHeadingYear = extractYearFromHeading(sec.textContent);
      // 見出しから種別も取得
      if (sec.textContent.includes("臨時会")) {
        currentMeetingKind = "臨時会";
      } else if (sec.textContent.includes("定例会")) {
        currentMeetingKind = "定例会";
      } else {
        currentMeetingKind = null;
      }
      continue;
    }

    if (sec.textType === "L" && sec.linkUrl) {
      const label = sec.linkDisplayName ?? "";
      const { session, meetingKind, labelYear } = parseLinkLabel(label);

      // 実際の年を決定: ラベルの年 > 見出しの年
      const effectiveYear = labelYear ?? currentHeadingYear;

      // 対象年以外はスキップ
      if (effectiveYear !== year) continue;

      // 種別: ラベルの種別 > 見出しの種別
      const effectiveMeetingKind = meetingKind ?? currentMeetingKind ?? "定例会";

      // PDF URL の末尾の余分なスペースを除去
      const pdfUrl = sec.linkUrl.trim();

      // タイトルを生成
      const eraStr = toEraString(effectiveYear);
      let title: string;
      if (session !== null) {
        title = `${eraStr}第${session}回${effectiveMeetingKind}`;
      } else {
        title = label.replace(/（PDF[^）]*）|\(PDF[^)]*\)/g, "").trim() || `${eraStr}${effectiveMeetingKind}`;
      }

      // heldOn: 年のみ分かる場合は YYYY-01-01 とする
      const heldOn = `${effectiveYear}-01-01`;

      results.push({
        pdfUrl,
        title,
        heldOn,
        meetingKind: effectiveMeetingKind,
        session,
      });
    }
  }

  // session 昇順でソート（同一 session は heldOn 昇順）
  results.sort((a, b) => {
    const sa = a.session ?? 999;
    const sb = b.session ?? 999;
    if (sa !== sb) return sa - sb;
    return a.heldOn.localeCompare(b.heldOn);
  });

  return results;
}

/**
 * 2つの articleId から指定年の全 PDF リンクを取得する。
 */
export async function fetchMeetingList(
  _baseUrl: string,
  year: number
): Promise<TsunoMeeting[]> {
  const allMeetings: TsunoMeeting[] = [];

  for (const articleId of ARTICLE_IDS) {
    const data = await fetchArticle(articleId);
    if (!data) continue;

    const sections = extractSections(data);
    const meetings = extractMeetingsFromSections(sections, year);
    allMeetings.push(...meetings);
  }

  return allMeetings;
}
