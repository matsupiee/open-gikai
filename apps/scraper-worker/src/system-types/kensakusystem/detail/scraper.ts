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
 * 議事録詳細ページから本文を取得。
 *
 * ResultFrame.exe は FRAMESET を返すため、
 * r_TextFrame.exe フレームを追跡して実際のテキストを取得する。
 */
export async function fetchMeetingContent(
  detailUrl: string
): Promise<string | null> {
  const html = await fetchWithEncoding(detailUrl);
  if (!html) return null;

  // FRAMESET ページの場合: r_TextFrame.exe → GetText3.exe の順に追跡
  if (/<frameset/i.test(html)) {
    // r_TextFrame.exe を優先 (ResultFrame.exe の場合)
    const textFrameMatch = html.match(
      /<frame[^>]+src=["']([^"']*r_TextFrame\.exe[^"']*)["']/i
    );
    if (textFrameMatch?.[1]) {
      const textFrameUrl = new URL(textFrameMatch[1], detailUrl).toString();
      return fetchMeetingContent(textFrameUrl);
    }
    // GetText3.exe を追跡 (r_TextFrame.exe の場合、通常の議事録)
    const getText3Match = html.match(
      /<frame[^>]+src=["']([^"']*GetText3\.exe[^"']*)["']/i
    );
    if (getText3Match?.[1]) {
      // アンカー (#hit1) を除去してからfetch
      const rawUrl = getText3Match[1].replace(/#.*$/, "");
      const getText3Url = new URL(rawUrl, detailUrl).toString();
      return fetchMeetingContent(getText3Url);
    }
    // GetHTML.exe を追跡 (r_TextFrame.exe の場合、質問一覧など .html 形式)
    const getHtmlMatch = html.match(
      /<frame[^>]+src=["']([^"']*GetHTML\.exe[^"']*)["']/i
    );
    if (getHtmlMatch?.[1]) {
      const rawUrl = getHtmlMatch[1].replace(/#.*$/, "");
      const getHtmlUrl = new URL(rawUrl, detailUrl).toString();
      return fetchMeetingContent(getHtmlUrl);
    }
    return null;
  }

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

  const fileNameMatch = schedule.url.match(/[?&]fileName=([^&]+)/i);
  const codeMatch = schedule.url.match(/[?&]Code=([^&]+)/);
  const fileName = fileNameMatch?.[1] ?? "";
  const code = codeMatch?.[1] ?? "";
  const externalId = fileName
    ? `kensakusystem_${slug}_${fileName}`
    : code
      ? `kensakusystem_${slug}_${code}`
      : null;

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
