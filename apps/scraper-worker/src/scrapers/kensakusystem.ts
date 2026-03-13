/**
 * kensakusystem.jp スクレイパー（複数自治体が利用する検索システム）
 *
 * kensakusystem.jp は複数の自治体の議会が利用する共通の検索システムです。
 * URL パターンが異なる複数のタイプに対応:
 *   - index.html: シンプルなインデックスページ
 *   - sapphire.html: Sapphire UI（フレーム構成のブラウザ）
 *   - cgi-bin3/Search2.exe: CGI ベースの検索インターフェース
 *   - root: ルートページ
 *
 * CFW 互換: fetch のみ使用。Playwright 不使用。
 * HTML パース: 正規表現と string 操作を使用。
 */

import type { MeetingData } from "../utils/types";

const USER_AGENT =
  "open-gikai-bot/1.0 (https://github.com/matsupiee/open-gikai; contact: please see github)";

/**
 * baseUrl から slug （自治体識別子）を抽出する。
 * 例: http://www.kensakusystem.jp/hirosaki/index.html → "hirosaki"
 */
export function extractSlugFromUrl(baseUrl: string): string | null {
  const match = baseUrl.match(/kensakusystem\.jp\/([^/]+)/);
  return match?.[1] ?? null;
}

/**
 * fetchWithEncoding: fetch して Shift-JIS → UTF-8 に変換
 * kensakusystem.jp のページは Shift-JIS エンコーディングの場合が多い
 */
async function fetchWithEncoding(url: string): Promise<string | null> {
  try {
    const res = await fetch(url, {
      headers: { "User-Agent": USER_AGENT },
    });
    if (!res.ok) return null;

    // ArrayBuffer として取得して Shift-JIS デコード
    const buffer = await res.arrayBuffer();
    const decoder = new TextDecoder("shift_jis");
    return decoder.decode(buffer);
  } catch {
    return null;
  }
}

/**
 * 日本語の全角数字を半角に正規化
 */
function normalizeFullWidth(str: string): string {
  return str.replace(/[０-９]/g, (c) =>
    String.fromCharCode(c.charCodeAt(0) - 0xfee0)
  );
}

/**
 * テキストから日付を抽出 (YYYY-MM-DD 形式で返す)
 * 対応フォーマット:
 *   - 令和/平成/昭和 Y年M月D日
 *   - YYYY-MM-DD, YYYY/MM/DD, YYYY.MM.DD など
 */
function extractDate(text: string): string | null {
  const normalized = normalizeFullWidth(text);

  // 和暦対応
  const wareki: Record<string, number> = {
    令和: 2018,
    平成: 1988,
    昭和: 1925,
  };

  for (const [era, base] of Object.entries(wareki)) {
    const m = normalized.match(
      new RegExp(`${era}(\\d+)年(\\d{1,2})月(\\d{1,2})日`)
    );
    if (m?.[1] && m[2] && m[3]) {
      const y = base + Number(m[1]);
      return `${y}-${m[2].padStart(2, "0")}-${m[3].padStart(2, "0")}`;
    }
  }

  // 西暦対応
  const m = normalized.match(/(\d{4})[.\-\/年](\d{1,2})[.\-\/月](\d{1,2})/);
  if (m?.[1] && m[2] && m[3]) {
    return `${m[1]}-${m[2].padStart(2, "0")}-${m[3].padStart(2, "0")}`;
  }

  return null;
}

/**
 * テキストから会議タイプを検出
 */
function detectMeetingType(text: string): string {
  if (text.includes("委員会")) return "committee";
  if (text.includes("臨時会")) return "extraordinary";
  return "plenary";
}

/**
 * HTML から script タグや style タグを除去し、プレーンテキストを抽出
 */
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
 * baseUrl が sapphire.html のタイプか判定
 */
export function isSapphireType(baseUrl: string): boolean {
  return baseUrl.includes("sapphire.html");
}

/**
 * baseUrl が CGI (Search2.exe) タイプか判定
 */
export function isCgiType(baseUrl: string): boolean {
  return baseUrl.includes("Search2.exe");
}

/**
 * baseUrl が index.html タイプか判定
 */
export function isIndexHtmlType(baseUrl: string): boolean {
  return baseUrl.includes("index.html");
}

/**
 * sapphire.html から議事録一覧を取得
 * sapphire.html はフレーム構成で、実際のコンテンツは別フレームから読み込まれる可能性がある。
 * ここではフレーム情報から議事録スケジュール情報を抽出する。
 */
export async function fetchFromSapphire(
  baseUrl: string
): Promise<SapphireSchedule[] | null> {
  const html = await fetchWithEncoding(baseUrl);
  if (!html) return null;

  const schedules: SapphireSchedule[] = [];

  // フレームセット内の src を探して、実際のコンテンツを取得する
  // Sapphire UI のパターンを解析
  const frameMatch = html.match(/src=["']([^"']*)/gi);
  if (!frameMatch) return null;

  // フレーム src から候補 URL を抽出し、ベース URL と組み合わせる
  for (const frame of frameMatch) {
    const frameUrl = frame.replace(/^src=["']/, "").replace(/["']$/, "");
    if (!frameUrl || frameUrl.startsWith("http")) continue;

    const absoluteUrl = new URL(frameUrl, baseUrl).toString();
    const contentHtml = await fetchWithEncoding(absoluteUrl);
    if (!contentHtml) continue;

    // フレーム内のテーブルから議事録リンクを抽出
    // <a href="See.exe?Code=xxx"> のパターンを探す
    const linkMatches = contentHtml.matchAll(
      /href=["']([^"']*See\.exe[^"']*)["']\s*[^>]*>([^<]+)</gi
    );

    for (const match of linkMatches) {
      const href = match[1];
      const rawTitle = match[2];
      if (!href || !rawTitle) continue;
      const title = stripHtmlTags(rawTitle).trim();

      if (href && title) {
        const heldOn = extractDate(title);
        if (heldOn) {
          schedules.push({
            title,
            heldOn,
            url: new URL(href, baseUrl).toString(),
          });
        }
      }
    }
  }

  return schedules.length > 0 ? schedules : null;
}

/**
 * CGI (Search2.exe) インターフェースから議事録一覧を取得
 */
export async function fetchFromCgi(
  baseUrl: string
): Promise<CgiSchedule[] | null> {
  const html = await fetchWithEncoding(baseUrl);
  if (!html) return null;

  const schedules: CgiSchedule[] = [];

  // CGI ページ内の <a href="See.exe?Code=..."> のパターンを探す
  const linkMatches = html.matchAll(
    /href=["']([^"']*See\.exe[^"']*)["']\s*[^>]*>([^<]+)</gi
  );

  for (const match of linkMatches) {
    const href = match[1];
    const rawTitle = match[2];
    if (!href || !rawTitle) continue;
    const title = stripHtmlTags(rawTitle).trim();

    if (title) {
      const heldOn = extractDate(title);
      if (heldOn) {
        schedules.push({
          title,
          heldOn,
          url: new URL(href, baseUrl).toString(),
        });
      }
    }
  }

  return schedules.length > 0 ? schedules : null;
}

/**
 * index.html ページから議事録一覧を取得
 */
export async function fetchFromIndexHtml(
  baseUrl: string
): Promise<IndexHtmlSchedule[] | null> {
  const html = await fetchWithEncoding(baseUrl);
  if (!html) return null;

  const schedules: IndexHtmlSchedule[] = [];

  // index.html 内の <a href="cgi-bin3/See.exe?Code=..."> のパターンを探す
  const linkMatches = html.matchAll(
    /href=["']([^"']*(?:cgi-bin3\/)?See\.exe[^"']*)["']\s*[^>]*>([^<]+)</gi
  );

  for (const match of linkMatches) {
    const href = match[1];
    const rawTitle = match[2];
    if (!href || !rawTitle) continue;
    const title = stripHtmlTags(rawTitle).trim();

    if (title) {
      const heldOn = extractDate(title);
      if (heldOn) {
        schedules.push({
          title,
          heldOn,
          url: new URL(href, baseUrl).toString(),
        });
      }
    }
  }

  return schedules.length > 0 ? schedules : null;
}

/**
 * 議事録詳細ページから本文を取得
 */
export async function fetchMeetingContent(
  detailUrl: string
): Promise<string | null> {
  const html = await fetchWithEncoding(detailUrl);
  if (!html) return null;

  // See.exe のレスポンス内のメインコンテンツを抽出
  // 通常、<pre> タグまたはテーブルセルにテキストが格納されている
  const preMatch = html.match(/<pre[^>]*>([\s\S]*?)<\/pre>/i);
  if (preMatch?.[1]) {
    const text = stripHtmlTags(preMatch[1]).trim();
    if (text.length > 100) return text; // 最小限の長さ
  }

  // <body> または <main> の内容を取得
  const bodyMatch = html.match(/<body[^>]*>([\s\S]*?)<\/body>/i);
  if (bodyMatch?.[1]) {
    // スクリプトやナビゲーションを除去
    let text = bodyMatch[1]
      .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "")
      .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "")
      .replace(/<nav[^>]*>[\s\S]*?<\/nav>/gi, "")
      .replace(/<header[^>]*>[\s\S]*?<\/header>/gi, "")
      .replace(/<footer[^>]*>[\s\S]*?<\/footer>/gi, "");

    text = stripHtmlTags(text).trim();
    if (text.length > 100) return text;
  }

  // フォールバック: 全体からタグを除去
  const text = stripHtmlTags(html).trim();
  return text.length > 100 ? text : null;
}

/**
 * 一覧から個別の議事録を取得して MeetingData に変換
 */
export async function fetchMeetingDataFromSchedule(
  schedule: SapphireSchedule | CgiSchedule | IndexHtmlSchedule,
  municipalityId: string,
  slug: string
): Promise<MeetingData | null> {
  const content = await fetchMeetingContent(schedule.url);
  if (!content) return null;

  const title = schedule.title;
  const meetingType = detectMeetingType(title);

  // externalId: kensakusystem_{slug}_{See.exe の Code パラメータ}
  const codeMatch = schedule.url.match(/[?&]Code=([^&]+)/);
  const code = codeMatch?.[1] ?? "";
  const externalId = code ? `kensakusystem_${slug}_${code}` : null;

  return {
    municipalityId,
    title,
    meetingType,
    heldOn: schedule.heldOn,
    sourceUrl: schedule.url,
    externalId,
    rawText: content,
  };
}

// --- 型定義 ---

interface BaseSchedule {
  title: string;
  heldOn: string; // YYYY-MM-DD
  url: string; // 詳細ページの URL
}

export interface SapphireSchedule extends BaseSchedule {}
export interface CgiSchedule extends BaseSchedule {}
export interface IndexHtmlSchedule extends BaseSchedule {}
