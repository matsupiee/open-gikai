/**
 * 坂町議会 — list フェーズ
 *
 * WordPress REST API（post ID: 1195）から全会議録の PDF リンクを取得し、
 * 年度でフィルタリングして ListRecord を返す。
 *
 * ページ構造:
 *   - h2 で年度別（近年分）または「過去の会議はこちら」配下 h3 で年度別
 *   - 各年度内は li 要素で会議録を列挙
 *   - 臨時会: <li><a href="...pdf">会議名</a></li>
 *   - 定例会: <li>会議名（<a href="...pdf">１日目</a>/<a href="...pdf">２日目</a>）</li>
 */

import {
  WP_API_URL,
  detectMeetingType,
  fetchJson,
  parseWarekiYear,
  toHalfWidth,
  delay,
} from "./shared";

export interface SakaSessionInfo {
  /** 会議タイトル */
  title: string;
  /** 開催日 YYYY-MM-DD（解析できない場合は null） */
  heldOn: string | null;
  /** PDF の絶対 URL */
  pdfUrl: string;
  /** 会議種別 */
  meetingType: string;
}

const INTER_PAGE_DELAY_MS = 1500;

/**
 * WordPress REST API レスポンスから content.rendered を取得する。
 */
function extractRenderedContent(json: unknown): string | null {
  if (
    typeof json !== "object" ||
    json === null ||
    !("content" in json) ||
    typeof (json as Record<string, unknown>).content !== "object" ||
    (json as Record<string, unknown>).content === null
  ) {
    return null;
  }
  const content = (json as Record<string, unknown>).content as Record<
    string,
    unknown
  >;
  if (typeof content.rendered !== "string") return null;
  return content.rendered;
}

/**
 * HTML エンティティをデコードする（簡易版）
 */
function decodeHtmlEntities(str: string): string {
  return str
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(parseInt(code, 10)));
}

/**
 * li テキストと PDF リンクテキストから会議タイトルを構築する。
 *
 * パターン:
 *   - 臨時会: リンクテキスト自体が会議名（例: "令和７年坂町議会第１０回臨時会"）
 *   - 定例会: li テキスト + 日目（例: "令和７年坂町議会第９回定例会（１日目）"）
 */
function buildTitle(liText: string, linkText: string): string {
  // リンクテキストに会議名が含まれる場合（臨時会等）
  if (
    linkText.match(/(令和|平成)(元|\d+)年/) &&
    (linkText.includes("臨時会") || linkText.includes("定例会"))
  ) {
    return linkText.trim();
  }

  // 日目パターン（定例会の各日）
  const dayMatch = toHalfWidth(linkText).match(/^([1-4])日目$/);
  if (dayMatch) {
    const liClean = liText
      .replace(/（.*）/g, "")
      .replace(/\(.*\)/g, "")
      .trim();
    return `${liClean}（${linkText.trim()}）`;
  }

  // フォールバック: li テキストを使用
  return liText.trim();
}

/**
 * 会議名から開催年を抽出する。
 * 全角数字は半角に変換して解析する。
 */
function extractYearFromTitle(title: string): number | null {
  return parseWarekiYear(toHalfWidth(title));
}

/**
 * heldOn は坂町の場合 PDF から抽出するため、list フェーズでは null を返す。
 * 代わりに年情報のみを付与する。
 */

/**
 * content.rendered HTML から指定年度の PDF リンクを抽出する。
 */
export function parsePdfLinksForYear(
  html: string,
  targetYear: number,
): SakaSessionInfo[] {
  const results: SakaSessionInfo[] = [];

  // HTML をセクションに分割（h2/h3 タグで区切る）
  // h2: 近年分の年度見出し、h3: 過去分の年度見出し
  const sectionPattern =
    /<(h[23])[^>]*>([\s\S]*?)<\/\1>([\s\S]*?)(?=<h[23]|$)/gi;

  let sectionMatch: RegExpExecArray | null;
  while ((sectionMatch = sectionPattern.exec(html)) !== null) {
    const headingText = decodeHtmlEntities(
      sectionMatch[2]!.replace(/<[^>]+>/g, "").trim(),
    );
    const sectionContent = sectionMatch[3]!;

    // 見出しから年度を抽出
    const year = parseWarekiYear(toHalfWidth(headingText));
    if (!year || year !== targetYear) continue;

    // セクション内の li 要素を処理
    const liPattern = /<li[^>]*>([\s\S]*?)<\/li>/gi;
    let liMatch: RegExpExecArray | null;

    while ((liMatch = liPattern.exec(sectionContent)) !== null) {
      const liContent = liMatch[1]!;
      const liText = decodeHtmlEntities(
        liContent.replace(/<[^>]+>/g, " ").trim(),
      );

      // li 内の PDF リンクを全件抽出
      const linkPattern =
        /<a\s[^>]*href="([^"]*\.pdf[^"]*)"[^>]*>([\s\S]*?)<\/a>/gi;
      let linkMatch: RegExpExecArray | null;

      while ((linkMatch = linkPattern.exec(liContent)) !== null) {
        const pdfUrl = decodeHtmlEntities(linkMatch[1]!);
        const linkText = decodeHtmlEntities(
          linkMatch[2]!.replace(/<[^>]+>/g, "").trim(),
        );

        // PDF URL の絶対化（相対パスの場合）
        const absolutePdfUrl = pdfUrl.startsWith("http")
          ? pdfUrl
          : `https://www.town.saka.lg.jp${pdfUrl}`;

        const title = buildTitle(liText, linkText);
        const titleYear = extractYearFromTitle(title);

        // タイトルから年が取れる場合は対象年と一致するか確認
        if (titleYear !== null && titleYear !== targetYear) continue;

        const meetingType = detectMeetingType(title);

        results.push({
          title,
          heldOn: null, // PDF から詳細取得時に解析
          pdfUrl: absolutePdfUrl,
          meetingType,
        });
      }
    }
  }

  return results;
}

/**
 * 指定年度の全 PDF セッションを収集する。
 */
export async function fetchSessionList(
  _baseUrl: string,
  year: number,
): Promise<SakaSessionInfo[]> {
  // WordPress REST API から content.rendered を取得
  const json = await fetchJson(WP_API_URL);
  if (!json) return [];

  const html = extractRenderedContent(json);
  if (!html) return [];

  await delay(INTER_PAGE_DELAY_MS);

  return parsePdfLinksForYear(html, year);
}
