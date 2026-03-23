/**
 * 出水市議会 議事録検索システム — list フェーズ
 *
 * 一覧トップページから MasterCouncil ID と会議名を収集し、
 * 指定年に対応する detail_select ID を特定する。
 *
 * ## 戦略
 * 1. トップページから MasterCouncil チェックボックスの ID と会議名を取得
 * 2. 会議名の年情報で対象年の会議があるか確認
 * 3. 二分探索で対象年の detail_select ID 開始位置を特定
 * 4. 開始位置から連番でスキャンし、対象年のみを収集
 *    - レート制限: リクエスト間に 1 秒待機
 */

import {
  buildDetailUrl,
  fetchPage,
  INDEX_URL,
  parseJapaneseDate,
} from "./shared";

export interface IzumiMeeting {
  /** detail_select の会議 ID */
  councilId: number;
  /** ページタイトル（"出水市令和7年第4回定例会 第１日" 形式） */
  title: string;
  /** 開催日 YYYY-MM-DD */
  heldOn: string;
}

/**
 * トップページの HTML から MasterCouncil チェックボックスの ID と
 * それに紐づく会議名（年情報）を取得する。
 */
export function parseMasterCouncilList(html: string): Array<{
  masterCouncilId: number;
  councilName: string;
}> {
  const result: Array<{ masterCouncilId: number; councilName: string }> = [];

  // ProceedingMasterCouncil{ID} でsplitして会議名を取得
  const parts = html.split(/id="ProceedingMasterCouncil(\d+)"/);
  for (let i = 1; i < parts.length; i += 2) {
    const id = parseInt(parts[i]!, 10);
    const nextText = parts[i + 1] ?? "";
    // 最初のaタグのテキストを取得
    const m = nextText.match(/<a[^>]+>([^<]+)<\/a>/);
    if (!m) continue;
    result.push({ masterCouncilId: id, councilName: m[1]!.trim() });
  }

  return result;
}

/**
 * 会議名から西暦年を抽出する。
 * 例: "出水市令和7年第4回定例会" → 2025
 * 変換できない場合は null を返す。
 */
export function extractYearFromCouncilName(name: string): number | null {
  // 全角数字を半角に変換してからマッチ
  const normalized = name.replace(/[０-９]/g, (c) =>
    String.fromCharCode(c.charCodeAt(0) - 0xff10 + 0x30),
  );
  const m = normalized.match(/(令和|平成|昭和)(元|\d+)年/);
  if (!m) return null;
  const era = m[1]!;
  const yearInEra = m[2] === "元" ? 1 : parseInt(m[2]!, 10);
  if (era === "令和") return yearInEra + 2018;
  if (era === "平成") return yearInEra + 1988;
  if (era === "昭和") return yearInEra + 1925;
  return null;
}

/**
 * detail_select/{id}/1 ページのタイトルから会議名を取得する。
 * 例: "出水市令和7年第4回定例会 第１日 | 議会議事録検索｜..."
 *      → "出水市令和7年第4回定例会 第１日"
 * ページが存在しない場合は null を返す。
 */
export function parseDetailTitle(html: string): string | null {
  const m = html.match(/<title>([^<]+)<\/title>/);
  if (!m) return null;
  const titlePart = m[1]!.split("|")[0]!.trim();
  // ページが「お探しのページ」など存在しないコンテンツの場合はスキップ
  if (
    titlePart.includes("お探しのページ") ||
    titlePart.includes("404") ||
    !titlePart.includes("出水市")
  ) {
    return null;
  }
  return titlePart;
}

/**
 * detail_select/{id}/1 ページの HTML から開催日を取得する。
 * text_{n} の id を持つ最初の p 要素（ヘッダー）から日付を抽出する。
 * 解析できない場合は null を返す。
 */
export function parseDetailDate(html: string): string | null {
  const headerMatch = html.match(/<p[^>]*id="text_\d+"[^>]*>([\s\S]*?)<\/p>/);
  if (!headerMatch) return null;
  const headerText = headerMatch[1]!.replace(/<[^>]+>/g, "");
  return parseJapaneseDate(headerText);
}

/**
 * 指定した detail_select ID のページの開催年を取得する。
 * ページが存在しない場合は null を返す（欠番 ID は null）。
 * 404 でも null を返す。
 */
export async function fetchMeetingYear(
  councilId: number,
): Promise<number | null> {
  const url = buildDetailUrl(councilId);
  const html = await fetchPage(url);
  if (!html) return null;

  // タイトルが出水市のページでなければスキップ
  const title = parseDetailTitle(html);
  if (!title) return null;

  const heldOn = parseDetailDate(html);
  if (!heldOn) return null;

  return parseInt(heldOn.substring(0, 4), 10);
}

/**
 * 指定した detail_select ID のページから会議情報を取得する。
 * 存在しない場合は null を返す。
 */
export async function fetchMeetingInfo(
  councilId: number,
): Promise<IzumiMeeting | null> {
  const url = buildDetailUrl(councilId);
  const html = await fetchPage(url);
  if (!html) return null;

  const title = parseDetailTitle(html);
  if (!title) return null;

  const heldOn = parseDetailDate(html);
  if (!heldOn) return null;

  return { councilId, title, heldOn };
}

/**
 * 二分探索で指定年の detail_select ID 開始位置を特定する。
 * 欠番が含まれるため、最も近い有効な ID を返す。
 * 見つからない場合は null を返す。
 */
async function binarySearchYearStart(
  year: number,
  low: number,
  high: number,
): Promise<number | null> {
  // 有効な ID を見つけるためのヘルパー（前後にずらす）
  const findValidId = async (id: number, maxOffset = 5): Promise<{ id: number; year: number } | null> => {
    for (let offset = 0; offset <= maxOffset; offset++) {
      for (const candidate of [id + offset, id - offset]) {
        if (candidate < 1) continue;
        // レート制限
        await new Promise((resolve) => setTimeout(resolve, 1000));
        const y = await fetchMeetingYear(candidate);
        if (y !== null) return { id: candidate, year: y };
      }
    }
    return null;
  };

  let result: number | null = null;

  while (low <= high) {
    const mid = Math.floor((low + high) / 2);
    const info = await findValidId(mid);

    if (!info) {
      // 有効な ID が見つからない場合は範囲を狭める
      high = mid - 1;
      continue;
    }

    if (info.year < year) {
      low = mid + 1;
    } else if (info.year > year) {
      high = mid - 1;
    } else {
      // 対象年を見つけた。より小さい ID を探す
      result = info.id;
      high = info.id - 1;
    }
  }

  return result;
}

/**
 * 指定年の会議一覧を返す。
 *
 * ## アルゴリズム
 * 1. トップページから対象年の会議が存在するか確認
 * 2. 二分探索で対象年の detail_select ID 開始位置を特定
 * 3. 開始位置から連番でスキャンし、対象年のみを収集
 *    - レート制限: リクエスト間に 1 秒待機
 */
export async function fetchMeetingList(year: number): Promise<IzumiMeeting[]> {
  // トップページを取得
  const indexHtml = await fetchPage(INDEX_URL);
  if (!indexHtml) {
    console.warn("[izumi] Failed to fetch index page");
    return [];
  }

  const masterCouncils = parseMasterCouncilList(indexHtml);

  // 対象年の MasterCouncil が存在するか確認
  const hasTargetYear = masterCouncils.some(
    (c) => extractYearFromCouncilName(c.councilName) === year,
  );

  if (!hasTargetYear) {
    return [];
  }

  // トップページに掲載されている最大の detail_select ID を取得
  const latestIdMatches = Array.from(indexHtml.matchAll(/detail_select\/(\d+)\/\d+/g));
  let maxKnownId = 0;
  for (const m of latestIdMatches) {
    const id = parseInt(m[1]!, 10);
    if (id > maxKnownId) maxKnownId = id;
  }
  if (maxKnownId === 0) maxKnownId = 600;
  const scanLimit = maxKnownId + 20;

  // 二分探索で対象年の開始 ID を特定
  const startId = await binarySearchYearStart(year, 1, scanLimit);

  if (startId === null) {
    return [];
  }

  // 開始 ID から連番でスキャンし、対象年のみを収集
  const meetings: IzumiMeeting[] = [];

  for (let id = startId; id <= scanLimit; id++) {
    await new Promise((resolve) => setTimeout(resolve, 1000));

    const meeting = await fetchMeetingInfo(id);
    if (!meeting) continue;

    const meetingYear = parseInt(meeting.heldOn.substring(0, 4), 10);

    // 対象年より後になったらスキャン終了
    if (meetingYear > year) break;

    if (meetingYear === year) {
      meetings.push(meeting);
    }
  }

  return meetings;
}
