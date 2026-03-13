/**
 * kensakusystem.jp スクレイパー — detail フェーズ
 *
 * 議事録詳細ページから本文を取得し、MeetingData に変換する。
 */

import type { MeetingData } from "../../../utils/types";
import { fetchWithEncoding, detectMeetingType, stripHtmlTags } from "../_shared";

export interface KensakusystemDetailSchedule {
  title: string;
  heldOn: string;
  url: string;
}

/**
 * 議事録詳細ページから本文を取得
 */
export async function fetchMeetingContent(
  detailUrl: string
): Promise<string | null> {
  const html = await fetchWithEncoding(detailUrl);
  if (!html) return null;

  const preMatch = html.match(/<pre[^>]*>([\s\S]*?)<\/pre>/i);
  if (preMatch?.[1]) {
    const text = stripHtmlTags(preMatch[1]).trim();
    if (text.length > 100) return text;
  }

  const bodyMatch = html.match(/<body[^>]*>([\s\S]*?)<\/body>/i);
  if (bodyMatch?.[1]) {
    let text = bodyMatch[1]
      .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "")
      .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "")
      .replace(/<nav[^>]*>[\s\S]*?<\/nav>/gi, "")
      .replace(/<header[^>]*>[\s\S]*?<\/header>/gi, "")
      .replace(/<footer[^>]*>[\s\S]*?<\/footer>/gi, "");

    text = stripHtmlTags(text).trim();
    if (text.length > 100) return text;
  }

  const text = stripHtmlTags(html).trim();
  return text.length > 100 ? text : null;
}

/**
 * 一覧から個別の議事録を取得して MeetingData に変換
 */
export async function fetchMeetingDataFromSchedule(
  schedule: KensakusystemDetailSchedule,
  municipalityId: string,
  slug: string
): Promise<MeetingData | null> {
  const content = await fetchMeetingContent(schedule.url);
  if (!content) return null;

  const meetingType = detectMeetingType(schedule.title);

  const codeMatch = schedule.url.match(/[?&]Code=([^&]+)/);
  const code = codeMatch?.[1] ?? "";
  const externalId = code ? `kensakusystem_${slug}_${code}` : null;

  return {
    municipalityId,
    title: schedule.title,
    meetingType,
    heldOn: schedule.heldOn,
    sourceUrl: schedule.url,
    externalId,
    rawText: content,
  };
}
