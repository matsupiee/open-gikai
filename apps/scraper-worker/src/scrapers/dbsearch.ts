/**
 * dbsr.jp (大和速記情報センター) スクレイパー
 *
 * 複数の自治体が dbsr.jp ドメインでホストする議事録検索システムをスクレイプする。
 * 各自治体は異なるドメイン（例: city.aomori.aomori.dbsr.jp）を持つが、
 * 基本的な HTML 構造は共通している。
 *
 * フロー:
 *   1. baseUrl の HTML を取得して議事録一覧を抽出
 *   2. 各議事録の ID（URL パラメータ）を抽出
 *   3. ID ごとに詳細ページを取得して本文を抽出
 *
 * CFW 互換: fetch のみ使用、正規表現で HTML をパース
 */

import type { MeetingData } from "../utils/types";

const USER_AGENT =
  "open-gikai-bot/1.0 (https://github.com/matsupiee/open-gikai; contact: please see github)";

export interface DbsearchMeetingRecord {
  id: string;
  url: string;
  title: string;
}

/**
 * 議事録一覧ページを取得して、議事録 ID と URL のリストを抽出する。
 * 失敗時は null を返す。
 */
export async function fetchMeetingList(baseUrl: string): Promise<DbsearchMeetingRecord[] | null> {
  try {
    const url = normalizeBaseUrl(baseUrl);
    const res = await fetch(url, {
      headers: { "User-Agent": USER_AGENT },
    });
    if (!res.ok) return null;

    const html = await res.text();

    // dbsr.jp の議事録一覧は通常、<a> タグで ID パラメータを持つ
    // 例: <a href="index.php/4880599?Template=search-detail">...
    const records: DbsearchMeetingRecord[] = [];

    // パターン1: index.php/XXXXXX 形式の ID
    const linkPattern = /index\.php\/(\d+)\?[^"']*(?:["\']|$)/gi;
    let match;
    const seenIds = new Set<string>();

    while ((match = linkPattern.exec(html)) !== null) {
      const id = match[1];
      if (id && !seenIds.has(id)) {
        seenIds.add(id);
        const detailUrl = buildDetailUrl(url, id);
        records.push({
          id,
          url: detailUrl,
          title: `議事録 ${id}`, // タイトルは詳細ページから取得
        });
      }
    }

    return records.length > 0 ? records : null;
  } catch {
    return null;
  }
}

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

    // 本文を抽出（複数のパターンに対応）
    const rawText = extractBodyText(html);
    if (!rawText.trim().length) return null;

    // タイトルを抽出
    const title = extractTitle(html);
    if (!title) return null;

    // 日付を抽出
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

/**
 * baseUrl を正規化する（クエリ文字列やフラグメントを削除）
 */
function normalizeBaseUrl(baseUrl: string): string {
  const url = new URL(baseUrl);
  url.search = "";
  url.hash = "";
  // index.php まで含める
  if (!url.pathname.endsWith("/")) {
    url.pathname += "/";
  }
  return url.toString().replace(/\/$/, "");
}

/**
 * 議事録詳細ページの URL を組み立てる
 */
function buildDetailUrl(baseUrl: string, id: string): string {
  const base = normalizeBaseUrl(baseUrl);
  return `${base}/index.php/${id}?Template=search-detail`;
}

/**
 * HTML から本文テキストを抽出する
 * dbsr.jp は複数の形式でコンテンツをホストしているため、複数のセレクタを試す
 */
function extractBodyText(html: string): string {
  // HTML タグを除去してプレーンテキストを取得
  let text = html
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, "")
    .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, "")
    .replace(/<[^>]+>/g, " ")
    .replace(/&[a-z]+;/gi, " ")
    .replace(/\s+/g, " ")
    .trim();

  return text;
}

/**
 * HTML からタイトルを抽出する
 */
function extractTitle(html: string): string | null {
  // パターン1: <title> タグ
  let match = html.match(/<title[^>]*>([^<]+)<\/title>/i);
  if (match?.[1]) {
    const title = match[1].trim();
    if (title && title.length > 0) return title;
  }

  // パターン2: <h1> タグ
  match = html.match(/<h[12][^>]*>([^<]+)<\/h[12]>/i);
  if (match?.[1]) {
    const title = match[1].trim();
    if (title && title.length > 0) return title;
  }

  return null;
}

/**
 * HTML または rawText から開催日（YYYY-MM-DD）を抽出する
 */
function extractDate(html: string, rawText: string): string | null {
  // HTML テキスト統合
  const searchText = normalizeFullWidth(html + " " + rawText);

  // 令和・平成・昭和 + 西暦 両対応
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

  // パターン2: 西暦直接指定 (YYYY-MM-DD or YYYY/MM/DD or YYYY.MM.DD)
  const m = searchText.match(/(\d{4})[.\-\/年](\d{1,2})[.\-\/月](\d{1,2})/);
  if (m?.[1] && m[2] && m[3]) {
    return `${m[1]}-${m[2].padStart(2, "0")}-${m[3].padStart(2, "0")}`;
  }

  return null;
}

/**
 * タイトルと本文から会議の種別を判定する
 */
function detectMeetingType(title: string, rawText: string): string {
  const text = (title + " " + rawText).toLowerCase();
  if (text.includes("委員会")) return "committee";
  if (text.includes("臨時会") || text.includes("臨時")) return "extraordinary";
  return "plenary";
}

/**
 * 全角数字を半角に正規化する
 */
function normalizeFullWidth(str: string): string {
  return str.replace(/[０-９]/g, (c) =>
    String.fromCharCode(c.charCodeAt(0) - 0xfee0)
  );
}
