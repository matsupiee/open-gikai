/**
 * kensakusystem.jp スクレイパー — detail フェーズ
 *
 * 議事録詳細ページから本文を取得し、MeetingData に変換する。
 */

import { createHash } from "node:crypto";
import type { MeetingData, ParsedStatement } from "../../../utils/types";
import {
  fetchWithEncoding,
  detectMeetingType,
  stripHtmlTags,
} from "../_shared";

export interface KensakusystemDetailSchedule {
  title: string;
  heldOn: string;
  url: string;
}

// 役職サフィックス（長い方を先に置いて誤マッチを防ぐ）
const ROLE_SUFFIXES = [
  "委員長",
  "副委員長",
  "副議長",
  "副市長",
  "副町長",
  "副村長",
  "副部長",
  "副課長",
  "市長室長",
  "議長",
  "市長",
  "町長",
  "村長",
  "委員",
  "議員",
  "部長",
  "課長",
  "室長",
  "局長",
  "係長",
  "主任",
  "補佐",
  "主査",
];

// 行政側の役職（答弁者として分類する）
const ANSWER_ROLES = new Set([
  "市長",
  "町長",
  "村長",
  "副市長",
  "副町長",
  "副村長",
  "市長室長",
  "部長",
  "課長",
  "室長",
  "局長",
  "係長",
  "主任",
  "補佐",
  "主査",
]);

function parseSpeaker(text: string): {
  speakerName: string | null;
  speakerRole: string | null;
  content: string;
} {
  const hasMarker = /^[○◯◎●]/.test(text);
  const stripped = text.replace(/^[○◯◎●]\s*/, "");
  const headerMatch = stripped.match(/^([^\s　]{1,30})[\s　]+/);
  if (headerMatch?.[1]) {
    const header = headerMatch[1];
    const content = stripped.slice(headerMatch[0].length).trim();

    // パターン1: 役職（名前）形式 — 例: "議長（川越桂路君）"
    const roleWithNameMatch = header.match(/^([^（(]{1,15})[（(]([^）)]*)[）)]/);
    if (roleWithNameMatch?.[1] && roleWithNameMatch[2] !== undefined) {
      const rolePart = roleWithNameMatch[1].trim();
      const rawName = roleWithNameMatch[2].replace(/[君様]$/, "").trim();
      for (const suffix of ROLE_SUFFIXES) {
        if (rolePart === suffix || rolePart.endsWith(suffix)) {
          return {
            speakerName: rawName || null,
            speakerRole: suffix,
            content,
          };
        }
      }
    }

    // パターン2: 名前役職形式 — 例: "田中市長"
    for (const suffix of ROLE_SUFFIXES) {
      if (header.endsWith(suffix)) {
        const name =
          header.length > suffix.length
            ? header.slice(0, -suffix.length)
            : null;
        return { speakerName: name, speakerRole: suffix, content };
      }
    }

    // ○ マーカーがある場合、役職が不明でも先頭の名前部分を content から除去する
    if (hasMarker) {
      return { speakerName: header, speakerRole: null, content };
    }
  }
  return { speakerName: null, speakerRole: null, content: stripped.trim() };
}

function classifyKind(speakerRole: string | null): string {
  if (!speakerRole) return "remark";
  if (ANSWER_ROLES.has(speakerRole)) return "answer";
  if (speakerRole === "議長" || speakerRole === "委員長") return "remark";
  return "question";
}

/**
 * kensakusystem.jp の詳細ページ HTML から ParsedStatement 配列を生成する。
 *
 * kensakusystem の ResultFrame.exe ページは <p> タグや <br> で区切られた
 * テキストブロックに「○発言者名　内容」の形式で発言が並ぶ。
 *
 * 処理フロー:
 * 1. <p> タグを全て抽出し、テキスト化する
 * 2. ○ 記号で始まるブロックを発言の区切りとして使い、複数 <p> をまとめる
 * 3. <p> から取得できない場合は HTML 全体からテキストを抽出し ○ で分割する
 */
function extractStatements(html: string): ParsedStatement[] {
  // <p> タグから段落を収集
  const paragraphs: string[] = [];
  const pPattern = /<p[^>]*>([\s\S]*?)<\/p>/gi;
  let m: RegExpExecArray | null;

  while ((m = pPattern.exec(html)) !== null) {
    const text = stripHtmlTags(m[1] ?? "")
      .replace(/\s+/g, " ")
      .trim();
    if (text.length > 0) paragraphs.push(text);
  }

  // ○ 記号で始まる段落を発言ブロックの先頭として集約
  const speechBlocks: string[] = [];
  let currentBlock = "";
  for (const para of paragraphs) {
    if (/^[○◯◎●]/.test(para)) {
      if (currentBlock) speechBlocks.push(currentBlock);
      currentBlock = para;
    } else if (currentBlock) {
      currentBlock += " " + para;
    }
  }
  if (currentBlock) speechBlocks.push(currentBlock);

  // <p> からブロックが得られなかった場合: HTML 全体を平文化して ○ で分割
  if (speechBlocks.length === 0) {
    const bodyText = stripHtmlTags(html).replace(/\s+/g, " ").trim();
    const parts = bodyText.split(/(?=[○◯◎●])/);
    for (const part of parts) {
      const trimmed = part.trim();
      if (trimmed.length > 0) speechBlocks.push(trimmed);
    }
  }

  const statements: ParsedStatement[] = [];
  let offset = 0;
  for (const block of speechBlocks) {
    const { speakerName, speakerRole, content } = parseSpeaker(block);
    if (!content) continue;
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
 * 議事録詳細ページから発言一覧を取得する
 */
export async function fetchMeetingStatements(
  detailUrl: string
): Promise<ParsedStatement[] | null> {
  const html = await fetchWithEncoding(detailUrl);
  if (!html) return null;

  const statements = extractStatements(html);
  return statements.length > 0 ? statements : null;
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
  if (!statements) return null;

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
