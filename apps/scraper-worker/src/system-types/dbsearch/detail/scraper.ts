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

/**
 * dbsr.jp の議事録本文を抽出する。
 *
 * 優先: <ul class="voice__list"> の各 <li> を発言単位として抽出し
 *       "\n\n---\n\n" セパレータで結合する（splitIntoStatements で分割可能）。
 * フォールバック: タグを除去した生テキスト。
 */
function extractBodyText(html: string): string {
  const structured = extractVoiceList(html);
  if (structured) return structured;

  // フォールバック: <br> を改行に変換してからタグを除去
  return html
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, "")
    .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, "")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&[a-z]+;/gi, "")
    .replace(/[ \t]+/g, " ")
    .replace(/\n[ \t]+/g, "\n")
    .trim();
}

/**
 * dbsr.jp の <ul class="voice__list"> から発言ブロックを抽出する。
 * 各 <li> の <p class="js-textwrap-container"> が1発言に対応する。
 * 発言が見つからなければ null を返す。
 */
function extractVoiceList(html: string): string | null {
  const voiceListMatch = html.match(
    /<ul\s[^>]*class="[^"]*voice__list[^"]*"[^>]*>([\s\S]*?)<\/ul>/i
  );
  if (!voiceListMatch) return null;

  const voiceListHtml = voiceListMatch[1] ?? "";
  const statements: string[] = [];

  // 各 <li> を処理
  const liPattern = /<li\b[^>]*>([\s\S]*?)<\/li>/gi;
  let liMatch;
  while ((liMatch = liPattern.exec(voiceListHtml)) !== null) {
    const liHtml = liMatch[1] ?? "";

    // 発言本文は <p class="js-textwrap-container"> に格納されている
    const pMatch = liHtml.match(
      /<p\s[^>]*class="[^"]*js-textwrap-container[^"]*"[^>]*>([\s\S]*?)<\/p>/i
    );
    if (!pMatch) continue;

    let content = pMatch[1] ?? "";

    // 印刷用の番号 <span class="visible-print-block"> を除去
    content = content.replace(
      /<span\s[^>]*class="[^"]*visible-print-block[^"]*"[^>]*>[\s\S]*?<\/span>/gi,
      ""
    );

    // <br> → 改行
    content = content.replace(/<br\s*\/?>/gi, "\n");

    // 残りのタグを除去
    content = content.replace(/<[^>]+>/g, "");

    // HTML エンティティのデコード
    content = content
      .replace(/&nbsp;/gi, " ")
      .replace(/&amp;/gi, "&")
      .replace(/&lt;/gi, "<")
      .replace(/&gt;/gi, ">")
      .replace(/&[a-z]+;/gi, "");

    // 空白の正規化（行内スペースを圧縮、空行を削除）
    content = content
      .split("\n")
      .map((line) => line.replace(/[ \t]+/g, " ").trim())
      .filter(Boolean)
      .join("\n")
      .trim();

    if (content) statements.push(content);
  }

  if (statements.length === 0) return null;
  return statements.join("\n\n---\n\n");
}

function extractTitle(html: string): string | null {
  // dbsr.jp の詳細ページは <p class="view__title"> にタイトルがある
  const viewTitleMatch = html.match(
    /class="view__title">([^<]+)<\/p>/
  );
  if (viewTitleMatch?.[1]) {
    const title = viewTitleMatch[1].replace(/\s+/g, " ").trim();
    if (title.length > 0) return title;
  }

  // フォールバック: <title> タグ
  const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
  if (titleMatch?.[1]) {
    const title = titleMatch[1].replace(/\s+/g, " ").trim();
    if (title.length > 0) return title;
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
