/**
 * dbsr.jp スクレイパー — detail フェーズ
 *
 * 議事録詳細ページを取得し、MeetingData に変換する。
 */

import type { MeetingData, ParsedStatement } from "../../../utils/types";
import { toStatements } from "../to-statements";

const USER_AGENT =
  "open-gikai-bot/1.0 (https://github.com/matsupiee/open-gikai; contact: please see github)";

/**
 * 議事録詳細ページを取得し、MeetingData に変換して返す。
 * 本文が空の場合は null を返す。
 */
export async function fetchMeetingDetail(
  detailUrl: string,
  municipalityId: string,
  meetingId: string,
  listTitle?: string
): Promise<MeetingData | null> {
  try {
    const res = await fetch(detailUrl, {
      headers: { "User-Agent": USER_AGENT },
    });
    if (!res.ok) return null;

    const html = await res.text();

    const statements: ParsedStatement[] = extractStatements(html);

    const rawText = statements.map((s) => s.content).join("\n");

    const title = extractTitle(html) ?? listTitle ?? null;
    if (!title) return null;

    const heldOn = extractDate(html, rawText);
    if (!heldOn) return null;

    const meetingType = detectMeetingType(html, rawText);
    const externalId = `dbsearch_${meetingId}`;

    return {
      municipalityId,
      title,
      meetingType,
      heldOn,
      sourceUrl: detailUrl,
      externalId,
      statements,
    };
  } catch {
    return null;
  }
}

function extractTitle(html: string): string | null {
  // dbsr.jp の詳細ページは <p class="view__title"> にタイトルがある
  const viewTitleMatch = html.match(/class="view__title">([^<]+)<\/p>/);
  if (viewTitleMatch?.[1]) {
    const title = viewTitleMatch[1].replace(/\s+/g, " ").trim();
    if (title.length > 0) return title;
  }

  // フォールバック: <title> タグ（ただし汎用的なサイトタイトルは除外）
  const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
  if (titleMatch?.[1]) {
    const title = titleMatch[1].replace(/\s+/g, " ").trim();
    // "閲覧 | xxx" や "検索" のような汎用タイトルはスキップ
    if (
      title.length > 0 &&
      !title.includes("閲覧") &&
      !title.includes("検索")
    ) {
      return title;
    }
  }

  return null;
}

function extractDate(html: string, rawText: string): string | null {
  // dbsr.jp の詳細ページは <time>2025-12-18</time> に日付がある
  const timeMatch = html.match(/<time>(\d{4}-\d{2}-\d{2})<\/time>/);
  if (timeMatch?.[1]) return timeMatch[1];

  // フォールバック: 和暦・西暦テキストから日付を抽出
  const searchText = normalizeFullWidth(html + " " + rawText);

  const wareki: Record<string, number> = {
    令和: 2018,
    平成: 1988,
    昭和: 1925,
  };

  for (const [era, base] of Object.entries(wareki)) {
    const m = searchText.match(
      new RegExp(`${era}(\\d+)年(\\d{1,2})月(\\d{1,2})日`)
    );
    if (m?.[1] && m[2] && m[3]) {
      const y = base + Number(m[1]);
      return `${y}-${m[2].padStart(2, "0")}-${m[3].padStart(2, "0")}`;
    }
  }

  const m = searchText.match(/(\d{4})[.\-\/年](\d{1,2})[.\-\/月](\d{1,2})/);
  if (m?.[1] && m[2] && m[3]) {
    return `${m[1]}-${m[2].padStart(2, "0")}-${m[3].padStart(2, "0")}`;
  }

  return null;
}

function detectMeetingType(title: string, rawText: string): string {
  const text = (title + " " + rawText).toLowerCase();
  if (text.includes("委員会")) return "committee";
  if (text.includes("臨時会") || text.includes("臨時")) return "extraordinary";
  return "plenary";
}

function normalizeFullWidth(str: string): string {
  return str.replace(/[０-９]/g, (c) =>
    String.fromCharCode(c.charCodeAt(0) - 0xfee0)
  );
}

function stripHtmlTags(html: string): string {
  return html
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "")
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .trim();
}

/**
 * dbsr.jp の議事録詳細 HTML から ParsedStatement 配列を生成する。
 *
 * <ul class="voice__list"> の各 <li> を1発言として抽出する
 * voice__list が見つからない場合は <div class="view__body"> からフォールバック取得する。
 */
function extractStatements(html: string): ParsedStatement[] {
  // 主経路: <ul class="voice__list"> の各 <li> を抽出
  const voiceListMatch = html.match(
    /<ul[^>]+class="[^"]*voice__list[^"]*"[^>]*>([\s\S]*?)<\/ul>/i
  );
  if (voiceListMatch?.[1]) {
    const parts: string[] = [];
    const liPattern = /<li[^>]*>([\s\S]*?)<\/li>/gi;
    let m: RegExpExecArray | null;
    while ((m = liPattern.exec(voiceListMatch[1])) !== null) {
      const text = stripHtmlTags(m[1] ?? "")
        .replace(/\s+/g, " ")
        .trim();
      if (text) parts.push(text);
    }
    return parts.map((p) => {
      // TODO 変換処理
    }));
  }

  return [];
}
