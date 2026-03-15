/**
 * kensakusystem.jp スクレイパー — detail フェーズ
 *
 * 議事録詳細ページから本文を取得し、MeetingData に変換する。
 */

import type { MeetingData, ParsedStatement } from "../../../utils/types";
import { fetchWithEncoding, detectMeetingType } from "../_shared";

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
export async function fetchMeetingStatements(
  detailUrl: string
): Promise<ParsedStatement[] | null> {
  const html = await fetchWithEncoding(detailUrl);
  if (!html) return null;

  // FRAMESET ページの場合: r_TextFrame.exe → GetText3.exe の順に追跡
}

/**
 * 一覧から個別の議事録を取得して MeetingData に変換
 */
export async function fetchMeetingDataFromSchedule(
  schedule: KensakusystemDetailSchedule,
  municipalityId: string,
  slug: string
): Promise<MeetingData | null> {
  const statements = await fetchMeetingStatements(schedule.url);

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
    statements,
  };
}
