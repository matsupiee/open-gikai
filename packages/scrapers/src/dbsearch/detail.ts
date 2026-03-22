/**
 * dbsr.jp スクレイパー — detail フェーズ
 *
 * 議事録詳細ページを取得し、MeetingData に変換する。
 *
 * HTML 構造（3 世代のバリアント）:
 *
 * 旧形式（単一ページ）:
 *   タイトル: <span class="command__docname">
 *   日付:     <span class="command__date">YYYY-MM-DD</span>
 *   発言一覧: <li class="voice-block" data-voice-title="..."><p class="voice__text">
 *
 * 中間形式（単一ページ）:
 *   タイトル: <p class="view__title">
 *   日付:     <p class="view__date"><time>YYYY-MM-DD</time></p>
 *   発言一覧: <li> 内の voice__header + voice__textwrap
 *
 * 新形式（フレームセット）:
 *   Template=doc-one-frame / doc-all-frame → frameset で返る
 *   command サブフレーム: <h2 class="command__title"> + <span class="command__date">
 *   page サブフレーム:    <div class="page-text__voice"><p class="page-text__text">
 */

import { createHash } from "node:crypto";
import type { MeetingData, ParsedStatement } from "../types";

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
  listTitle?: string,
  listDate?: string
): Promise<MeetingData | null> {
  try {
    // 新形式のフレームセットURLの場合、全文表示に変換してからフェッチ
    const fetchUrl = detailUrl
      .replace("Template=doc-one-frame", "Template=doc-all-frame")
      .replace("VoiceType=onehit", "VoiceType=all");

    const res = await fetch(fetchUrl, {
      headers: { "User-Agent": USER_AGENT },
    });
    if (!res.ok) return null;

    const html = await res.text();

    // フレームセットページの場合はサブフレームから取得
    if (html.includes("<frameset")) {
      return fetchFromFrameset(html, fetchUrl, municipalityId, meetingId, listTitle, listDate);
    }

    // 旧形式・中間形式: 単一ページから直接パース
    const statements = extractStatements(html);

    const title = extractTitle(html) ?? listTitle ?? null;
    if (!title) return null;

    const heldOn = extractDate(html) ?? listDate ?? null;
    if (!heldOn) return null;

    const meetingType = detectMeetingType(title);
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
  } catch (err) {
    console.warn(`[dbsearch] fetchMeetingDetail failed for ${detailUrl}:`, err instanceof Error ? err.message : err);
    return null;
  }
}

/**
 * フレームセット HTML からサブフレームを順にフェッチし、MeetingData を組み立てる。
 */
async function fetchFromFrameset(
  framesetHtml: string,
  detailUrl: string,
  municipalityId: string,
  meetingId: string,
  listTitle?: string,
  listDate?: string
): Promise<MeetingData | null> {
  const origin = new URL(detailUrl).origin;
  const pathPrefix = detailUrl.includes("/index.php/") ? "/index.php/" : "/";

  // frame src からセッション ID と各サブフレームの Template を抽出
  const commandFrameMatch = framesetHtml.match(
    /src="[^"]*\/(\d+)\?Template=(doc-(?:all|one)-command)"/
  );
  if (!commandFrameMatch?.[1]) return null;
  const sessionId = commandFrameMatch[1];

  // page フレームの Template 名を取得（doc-page, doc-page1 など）
  const pageFrameMatch = framesetHtml.match(
    /src="[^"]*\/\d+\?Template=(doc-page\d*)"/
  );
  const pageTemplate = pageFrameMatch?.[1] ?? "doc-page";

  // command サブフレームからタイトルと日付を取得
  const commandUrl = `${origin}${pathPrefix}${sessionId}?Template=doc-all-command`;
  const commandRes = await fetch(commandUrl, {
    headers: { "User-Agent": USER_AGENT },
  });
  if (!commandRes.ok) return null;
  const commandHtml = await commandRes.text();

  let title = extractTitle(commandHtml) ?? null;
  let heldOn = extractDate(commandHtml) ?? null;

  // page サブフレームから発言内容を取得
  const pageUrl = `${origin}${pathPrefix}${sessionId}?Template=${pageTemplate}`;
  const pageRes = await fetch(pageUrl, {
    headers: { "User-Agent": USER_AGENT },
  });
  if (!pageRes.ok) return null;
  const pageHtml = await pageRes.text();

  // command フレームからタイトル/日付が取れない場合、page フレームからフォールバック
  // page-text__title 形式: <h1 class="page-text__title">2025-12-19 : タイトル</h1>
  if (!title || !heldOn) {
    const pageTitle = extractPageTextTitle(pageHtml);
    if (pageTitle) {
      title ??= pageTitle.title;
      heldOn ??= pageTitle.date;
    }
  }

  // さらにフォールバック: command フレームの素の h2 からタイトル/日付を抽出
  // 宗像市等: <h2>2025年12月19日：自治体名：タイトル</h2>
  if (!title || !heldOn) {
    const plainH2 = commandHtml.match(/<h2>([^<]+)<\/h2>/);
    if (plainH2?.[1]) {
      const h2Text = plainH2[1].trim();
      const dateMatch = h2Text.match(/(\d{4})年(\d{1,2})月(\d{1,2})日/);
      if (dateMatch && !heldOn) {
        heldOn = `${dateMatch[1]}-${dateMatch[2].padStart(2, "0")}-${dateMatch[3].padStart(2, "0")}`;
      }
      // 最後の「：」以降をタイトルとする
      const titlePart = h2Text.split(/[：:]/).pop()?.trim();
      if (titlePart && !title) {
        title = titlePart.replace(/\s+/g, " ").trim();
      }
    }
  }

  // 最終フォールバック: リストから渡されたタイトル/日付
  title ??= listTitle ?? null;
  heldOn ??= listDate ?? null;

  if (!title || !heldOn) return null;

  const statements = extractStatements(pageHtml);

  const meetingType = detectMeetingType(title);
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
}

/**
 * タイトルを取得する。
 * 旧形式: <span class="command__docname">
 * 中間形式: <p class="view__title">
 * 新形式: <h1|h2 class="command__title"> (日付 span/date を含む場合あり)
 */
/** @internal テスト用にexport */
export function extractTitle(html: string): string | null {
  // 旧形式・中間形式: テキストのみ
  const simple =
    html.match(/class="command__docname">([^<]+)<\/span>/) ??
    html.match(/class="view__title">([^<]+)<\/p>/);
  if (simple?.[1]) {
    const title = simple[1].replace(/\s+/g, " ").trim();
    if (title.length > 0) return title;
  }

  // 新形式: h1 または h2 の command__title (子タグを含む場合あり)
  const commandTitle = html.match(
    /<(?:h1|h2)[^>]+class="[^"]*command__title[^"]*"[^>]*>([\s\S]*?)<\/(?:h1|h2)>/i
  );
  if (commandTitle?.[1]) {
    // 子タグ (<date>, <span> 等) とその内容を除去し、先頭の区切り文字も除去
    const title = commandTitle[1]
      .replace(/<[^>]+>[^<]*<\/[^>]+>/g, "")
      .replace(/^[：:\s]+/, "")
      .replace(/\s+/g, " ")
      .trim();
    if (title.length > 0) return title;
  }

  return null;
}

/**
 * 日付を取得する。フォーマットは YYYY-MM-DD。
 * 旧形式: <span class="command__date">YYYY-MM-DD</span>
 * 新形式: <date class="command__date">YYYY-MM-DD</date>
 * 中間形式: <p class="view__date">開催日: <time>YYYY-MM-DD</time></p>
 * 日本語形式: <span class="date">YYYY年MM月DD日</span> 等
 */
/** @internal テスト用にexport */
export function extractDate(html: string): string | null {
  // ISO 形式 (YYYY-MM-DD) を span / date タグから取得
  const iso =
    html.match(/class="command__date">(\d{4}-\d{2}-\d{2})<\/(?:span|date)>/) ??
    html.match(/class="view__date">[^<]*<time>(\d{4}-\d{2}-\d{2})<\/time>/);
  if (iso?.[1]) return iso[1];

  // 日本語形式 (YYYY年MM月DD日) → ISO に変換
  const ja = html.match(/class="(?:command__)?date">(\d{4})年(\d{1,2})月(\d{1,2})日<\//);
  if (ja?.[1] && ja[2] && ja[3]) {
    return `${ja[1]}-${ja[2].padStart(2, "0")}-${ja[3].padStart(2, "0")}`;
  }

  return null;
}

/**
 * page フレームの h1.page-text__title からタイトルと日付を抽出する。
 * 形式: <h1 class="page-text__title">2025-12-19 : タイトル</h1>
 */
function extractPageTextTitle(html: string): { title: string; date: string } | null {
  const m = html.match(
    /<h1[^>]+class="[^"]*page-text__title[^"]*"[^>]*>(\d{4}-\d{2}-\d{2})\s*[：:]\s*([\s\S]*?)<\/h1>/i
  );
  if (!m?.[1] || !m[2]) return null;
  const title = m[2].replace(/\s+/g, " ").trim();
  if (!title) return null;
  return { title, date: m[1] };
}

/**
 * タイトルから会議種別を決定する。
 */
/** @internal テスト用にexport */
export function detectMeetingType(title: string): string {
  if (title.includes("委員会")) return "committee";
  if (title.includes("臨時会") || title.includes("臨時"))
    return "extraordinary";
  return "plenary";
}

// 行政側の役職（答弁者として分類する）
const ANSWER_ROLES = new Set([
  "市長",
  "町長",
  "村長",
  "副市長",
  "副町長",
  "副村長",
  "副知事",
  "知事",
  "部長",
  "課長",
  "室長",
  "局長",
  "係長",
  "主任",
  "補佐",
  "主査",
  "事務局長",
  "議会事務局長",
  "書記",
  "参事",
  "次長",
  "理事",
  "総務部長",
  "財政部長",
]);

/**
 * data-voice-title 属性値から speakerName / speakerRole を抽出する。
 *
 * 形式: "◯議長（高瀬博文）" または "◯議会事務局長（八鍬政幸）" など
 *   → speakerRole="議長", speakerName="高瀬博文"
 * 括弧なし: "◯議長" → speakerRole="議長", speakerName=null
 */
/** @internal テスト用にexport */
export function parseSpeakerFromTitle(voiceTitle: string): {
  speakerName: string | null;
  speakerRole: string | null;
} {
  // 先頭の ◯ や ○ などの記号を除去
  const stripped = voiceTitle.replace(/^[◯○◎●]\s*/, "").trim();

  // 「役職（氏名）」形式
  const withNameMatch = stripped.match(/^(.+?)（(.+?)）$/);
  if (withNameMatch?.[1] && withNameMatch[2]) {
    const rawName = withNameMatch[2].trim();
    const speakerName = rawName.replace(/(さん|くん|君)$/, "").trim();
    return {
      speakerRole: withNameMatch[1].trim(),
      speakerName: speakerName || null,
    };
  }

  // 括弧なし（役職のみ）
  if (stripped.length > 0) {
    return { speakerRole: stripped, speakerName: null };
  }

  return { speakerRole: null, speakerName: null };
}

/**
 * speakerRole から kind を決定する。
 * - 議員・委員 → "question"
 * - 行政側（市長・部長・課長等） → "answer"
 * - 議長・委員長・不明 → "remark"
 */
/** @internal テスト用にexport */
export function classifyKind(speakerRole: string | null): string {
  if (!speakerRole) return "remark";
  if (speakerRole.endsWith("議員") || speakerRole.endsWith("委員"))
    return "question";
  // 「７番」「１７番」のような議席番号表記の議員
  if (/^[0-9０-９]+番$/.test(speakerRole)) return "question";
  if (speakerRole === "議長" || speakerRole.endsWith("委員長")) return "remark";
  // 行政側役職の完全一致・部分一致
  for (const role of ANSWER_ROLES) {
    if (speakerRole === role || speakerRole.endsWith(role)) return "answer";
  }
  return "remark";
}

/**
 * HTML エンティティをデコードし、<br> を改行に変換してタグを除去する。
 */
/** @internal テスト用にexport */
export function cleanVoiceText(html: string): string {
  return html
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/**
 * 「◯役職（氏名）　本文」形式の先頭から発言者ヘッダーを除去する。
 * data-voice-title に発言者情報が別途存在するため、content には本文のみを格納する。
 */
/** @internal テスト用にexport */
export function stripSpeakerPrefix(content: string): string {
  // ◯総務課長（小海途　聡君）　… のような先頭ヘッダーを除去
  // ◯役職（氏名）〔登壇〕 のような先頭ヘッダーを除去（〔〕の補足表記は任意）
  return content
    .replace(/^[◯○◎●][^（\n]*(?:（[^）]*）)?(?:〔[^〕]*〕)?[\s\u3000\n]*/, "")
    .trim();
}

/**
 * dbsr.jp の議事録詳細 HTML から ParsedStatement 配列を生成する。
 *
 * 旧形式: <li class="voice-block" data-voice-title="..."> + <p class="voice__text">
 * 中間形式: <li> 内の <span class="voice__title"> + <p class="js-textwrap-container">
 * 新形式: <div class="page-text__voice"> + <p class="page-text__text">
 */
/** @internal テスト用にexport */
export function extractStatements(html: string): ParsedStatement[] {
  // 各形式を順に試行
  const oldStatements = extractStatementsOld(html);
  if (oldStatements.length > 0) return oldStatements;
  const newStatements = extractStatementsNew(html);
  if (newStatements.length > 0) return newStatements;
  return extractStatementsPageText(html);
}

function extractStatementsOld(html: string): ParsedStatement[] {
  const statements: ParsedStatement[] = [];
  let offset = 0;

  const voiceBlockPattern =
    /<li[^>]+class="[^"]*voice[_-]block[^"]*"[^>]*data-voice-title="([^"]*)"[^>]*>([\s\S]*?)<\/li>/gi;

  let m: RegExpExecArray | null;
  while ((m = voiceBlockPattern.exec(html)) !== null) {
    const voiceTitle = m[1] ?? "";
    const liInner = m[2] ?? "";

    const textMatch = liInner.match(
      /<p[^>]+class="[^"]*voice__text[^"]*"[^>]*>([\s\S]*?)<\/p>/i
    );
    if (!textMatch?.[1]) continue;

    const rawContent = cleanVoiceText(textMatch[1]);
    if (!rawContent) continue;

    const content = stripSpeakerPrefix(rawContent);
    if (!content) continue;

    const { speakerName, speakerRole } = parseSpeakerFromTitle(voiceTitle);
    const contentHash = createHash("sha256").update(content).digest("hex");
    const startOffset = offset;
    const endOffset = offset + content.length;

    statements.push({
      kind: classifyKind(speakerRole),
      speakerName,
      speakerRole,
      content,
      contentHash,
      startOffset,
      endOffset,
    });

    offset = endOffset + 1;
  }

  return statements;
}

function extractStatementsNew(html: string): ParsedStatement[] {
  const statements: ParsedStatement[] = [];
  let offset = 0;

  // 中間形式: voice__list 内の各 <li> から voice__title と js-textwrap-container を抽出
  const liPattern =
    /<li>\s*<div[^>]+class="[^"]*voice__header[^"]*"[^>]*>([\s\S]*?)<\/div>\s*<div[^>]+class="[^"]*voice__textwrap[^"]*"[^>]*>([\s\S]*?)<\/div>\s*<\/li>/gi;

  let m: RegExpExecArray | null;
  while ((m = liPattern.exec(html)) !== null) {
    const headerInner = m[1] ?? "";
    const textInner = m[2] ?? "";

    // <span class="voice__title"> から発言者を取得
    const titleMatch = headerInner.match(
      /<span[^>]+class="[^"]*voice__title[^"]*"[^>]*>([^<]+)<\/span>/i
    );
    const voiceTitle = titleMatch?.[1]?.trim() ?? "";

    // <p class="js-textwrap-container"> から本文を取得
    const textMatch = textInner.match(
      /<p[^>]+class="[^"]*js-textwrap-container[^"]*"[^>]*>([\s\S]*?)<\/p>/i
    );
    if (!textMatch?.[1]) continue;

    // 印刷用の番号 span を除去してからテキスト化する
    const cleanedHtml = textMatch[1].replace(
      /<span[^>]+class="[^"]*visible-print-block[^"]*"[^>]*>[^<]*<\/span>/gi,
      ""
    );
    const rawContent = cleanVoiceText(cleanedHtml);
    if (!rawContent) continue;

    const content = stripSpeakerPrefix(rawContent);
    if (!content) continue;

    const { speakerName, speakerRole } = parseSpeakerFromTitle(voiceTitle);
    const contentHash = createHash("sha256").update(content).digest("hex");
    const startOffset = offset;
    const endOffset = offset + content.length;

    statements.push({
      kind: classifyKind(speakerRole),
      speakerName,
      speakerRole,
      content,
      contentHash,
      startOffset,
      endOffset,
    });

    offset = endOffset + 1;
  }

  return statements;
}

/**
 * 新形式（フレームセット）の page サブフレームから発言を抽出する。
 *
 * HTML 構造:
 *   <div class="page-text__voice" id="VoiceNo1">
 *     <p class="page-text__text ...">
 *       <span class="page-text__number ...">1</span>
 *       ◯議長（奈良岡隆君）　本文テキスト<br />...
 *     </p>
 *   </div>
 */
function extractStatementsPageText(html: string): ParsedStatement[] {
  const statements: ParsedStatement[] = [];
  let offset = 0;

  const voicePattern =
    /<div[^>]+class="[^"]*page-text__voice[^"]*"[^>]*>([\s\S]*?)<\/div>/gi;

  let m: RegExpExecArray | null;
  while ((m = voicePattern.exec(html)) !== null) {
    const divInner = m[1] ?? "";

    const textMatch = divInner.match(
      /<p[^>]+class="[^"]*page-text__text[^"]*"[^>]*>([\s\S]*?)<\/p>/i
    );
    if (!textMatch?.[1]) continue;

    // page-text__number span を除去
    const cleanedHtml = textMatch[1].replace(
      /<span[^>]*class="[^"]*page-text__number[^"]*"[^>]*>[^<]*<\/span>/gi,
      ""
    );

    const rawContent = cleanVoiceText(cleanedHtml);
    if (!rawContent) continue;

    // テキスト先頭から発言者情報を抽出
    const speakerMatch = rawContent.match(/^[◯○◎●]([^（\n]+?)(?:（([^）]+?)）)?[\s\u3000]/);
    const voiceTitle = speakerMatch
      ? `◯${speakerMatch[1]}${speakerMatch[2] ? `（${speakerMatch[2]}）` : ""}`
      : "";

    const content = stripSpeakerPrefix(rawContent);
    if (!content) continue;

    const { speakerName, speakerRole } = parseSpeakerFromTitle(voiceTitle);
    const contentHash = createHash("sha256").update(content).digest("hex");
    const startOffset = offset;
    const endOffset = offset + content.length;

    statements.push({
      kind: classifyKind(speakerRole),
      speakerName,
      speakerRole,
      content,
      contentHash,
      startOffset,
      endOffset,
    });

    offset = endOffset + 1;
  }

  return statements;
}
