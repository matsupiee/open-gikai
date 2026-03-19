/**
 * dbsr.jp スクレイパー — detail フェーズ
 *
 * 議事録詳細ページを取得し、MeetingData に変換する。
 *
 * HTML 構造（実際のページから確認済み）:
 *   タイトル: <span class="command__docname">
 *   日付:     <span class="command__date">YYYY-MM-DD</span>
 *   発言一覧: <ul class="page-list" id="page-list">
 *               <li class="voice-block" data-voice-title="◯議長（高瀬博文）">
 *                 <p class="voice__text">本文テキスト</p>
 *               </li>
 *             </ul>
 */

import { createHash } from "node:crypto";
import type { MeetingData, ParsedStatement } from "../../../utils/types";

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
  listTitle?: string
): Promise<MeetingData | null> {
  try {
    const res = await fetch(detailUrl, {
      headers: { "User-Agent": USER_AGENT },
    });
    if (!res.ok) return null;

    const html = await res.text();

    const statements = extractStatements(html);

    const title = extractTitle(html) ?? listTitle ?? null;
    if (!title) return null;

    const heldOn = extractDate(html);
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
  } catch {
    return null;
  }
}

/**
 * タイトルを <span class="command__docname"> から取得する。
 */
/** @internal テスト用にexport */
export function extractTitle(html: string): string | null {
  const m = html.match(/class="command__docname">([^<]+)<\/span>/);
  if (m?.[1]) {
    const title = m[1].replace(/\s+/g, " ").trim();
    if (title.length > 0) return title;
  }
  return null;
}

/**
 * 日付を <span class="command__date"> から取得する。
 * フォーマットは YYYY-MM-DD。
 */
/** @internal テスト用にexport */
export function extractDate(html: string): string | null {
  const m = html.match(/class="command__date">(\d{4}-\d{2}-\d{2})<\/span>/);
  return m?.[1] ?? null;
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
    .replace(/^[◯○◎●][^（\n]*(?:（[^）]*）)?(?:〔[^〕]*〕)?[\s\u3000\n]+/, "")
    .trim();
}

/**
 * dbsr.jp の議事録詳細 HTML から ParsedStatement 配列を生成する。
 *
 * <ul class="page-list"> の各 <li class="voice-block"> を1発言として抽出する。
 * 発言者は data-voice-title 属性から、本文は <p class="voice__text"> から取得する。
 */
/** @internal テスト用にexport */
export function extractStatements(html: string): ParsedStatement[] {
  const statements: ParsedStatement[] = [];
  let offset = 0;

  // voice-block の li を順番に抽出
  // data-voice-title 属性と voice__text p タグをペアで取得
  const voiceBlockPattern =
    /<li[^>]+class="[^"]*voice[_-]block[^"]*"[^>]*data-voice-title="([^"]*)"[^>]*>([\s\S]*?)<\/li>/gi;

  let m: RegExpExecArray | null;
  while ((m = voiceBlockPattern.exec(html)) !== null) {
    const voiceTitle = m[1] ?? "";
    const liInner = m[2] ?? "";

    // <p class="voice__text"> の内容を抽出
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
