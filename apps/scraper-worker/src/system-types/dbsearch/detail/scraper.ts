/**
 * dbsr.jp スクレイパー — detail フェーズ
 *
 * 議事録詳細ページを取得し、MeetingData に変換する。
 */

import type { MeetingData } from "../../../utils/types";

const USER_AGENT =
  "open-gikai-bot/1.0 (https://github.com/matsupiee/open-gikai; contact: please see github)";

/**
 * 議事録詳細ページを取得し、MeetingData に変換して返す。
 * 本文が空の場合は null を返す。
 */
export async function fetchMeetingDetail(
  detailUrl: string,
  municipalityId: string,
  meetingId: string
): Promise<MeetingData | null> {
  try {
    const res = await fetch(detailUrl, {
      headers: { "User-Agent": USER_AGENT },
    });
    if (!res.ok) return null;

    const html = await res.text();

    const rawText = extractBodyText(html);
    if (!rawText.trim().length) return null;

    const title = extractTitle(html);
    if (!title) return null;

    const heldOn = extractDate(html, rawText);
    if (!heldOn) return null;

    const meetingType = detectMeetingType(title, rawText);
    const externalId = `dbsearch_${meetingId}`;

    return {
      municipalityId,
      title,
      meetingType,
      heldOn,
      sourceUrl: detailUrl,
      externalId,
      rawText,
    };
  } catch {
    return null;
  }
}

// --- 内部ユーティリティ ---

function extractBodyText(html: string): string {
  return html
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, "")
    .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, "")
    .replace(/<[^>]+>/g, " ")
    .replace(/&[a-z]+;/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function extractTitle(html: string): string | null {
  let match = html.match(/<title[^>]*>([^<]+)<\/title>/i);
  if (match?.[1]) {
    const title = match[1].trim();
    if (title && title.length > 0) return title;
  }

  match = html.match(/<h[12][^>]*>([^<]+)<\/h[12]>/i);
  if (match?.[1]) {
    const title = match[1].trim();
    if (title && title.length > 0) return title;
  }

  return null;
}

function extractDate(html: string, rawText: string): string | null {
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
