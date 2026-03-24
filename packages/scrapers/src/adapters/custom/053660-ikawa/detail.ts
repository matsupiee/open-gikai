/**
 * 井川町議会 — detail フェーズ
 *
 * 議会だより PDF をダウンロードしてテキストを抽出し、
 * 発言ブロックを ParsedStatement 配列に変換する。
 *
 * 議会だよりは広報紙形式のため、会議録全文ではなく要約が掲載されている。
 * 問（質問）・答（答弁）形式の発言と一般質問セクションを抽出する。
 *
 * 発言パターン例:
 *   問（議員名や委員会名） テキスト
 *   答（町長、担当課長など） テキスト
 *   ○八柳 喜行 議員 テキスト（一般質問見出し）
 */

import { createHash } from "node:crypto";
import { extractText, getDocumentProxy } from "unpdf";
import type { MeetingData, ParsedStatement } from "../../../utils/types";
import type { IkawaMeeting } from "./list";
import {
  convertJapaneseEra,
  detectMeetingType,
  extractExternalId,
  fetchBinary,
} from "./shared";

// 役職サフィックス（長い方を先に置いて誤マッチを防ぐ）
const ROLE_SUFFIXES = [
  "副委員長",
  "委員長",
  "副議長",
  "議長",
  "副町長",
  "町長",
  "副教育長",
  "教育長",
  "事務局長",
  "局長",
  "副部長",
  "部長",
  "副課長",
  "課長",
  "室長",
  "係長",
  "参事",
  "主幹",
  "主査",
  "補佐",
  "議員",
  "委員会",
  "委員",
];

// 行政側の役職（答弁者として分類する）
const ANSWER_ROLES = new Set([
  "町長",
  "副町長",
  "教育長",
  "副教育長",
  "部長",
  "副部長",
  "課長",
  "副課長",
  "室長",
  "局長",
  "事務局長",
  "係長",
  "参事",
  "主幹",
  "主査",
  "補佐",
]);

/**
 * 発言テキストから話者名・役職・本文を抽出する。
 *
 * 対応パターン:
 *   問（八柳議員） テキスト → role=議員, name=八柳
 *   答（町長）　テキスト → role=町長, name=null
 *   答（総務課長　田中）テキスト → role=課長, name=田中
 *   ○八柳 喜行 議員 テキスト → role=議員, name=八柳 喜行
 */
export function parseSpeaker(text: string): {
  speakerName: string | null;
  speakerRole: string | null;
  content: string;
} {
  const stripped = text.trim();

  // 問（...）/ 答（...）パターン
  const qaPrefixMatch = stripped.match(/^([問答])[（(]([^）)]*)[）)]\s*([\s\S]*)/);
  if (qaPrefixMatch) {
    const prefix = qaPrefixMatch[1]!; // 問 or 答
    const rolePart = qaPrefixMatch[2]!.trim();
    const content = qaPrefixMatch[3]!.trim();

    // 答弁者の役職を抽出
    for (const suffix of ROLE_SUFFIXES) {
      if (rolePart === suffix || rolePart.endsWith(suffix)) {
        const nameCandidate = rolePart.slice(0, rolePart.length - suffix.length).trim();
        const name = nameCandidate || null;
        return { speakerName: name, speakerRole: suffix, content };
      }
    }

    // 役職が特定できない場合は prefix で判断
    if (prefix === "問") {
      return { speakerName: rolePart || null, speakerRole: "議員", content };
    }
    return { speakerName: rolePart || null, speakerRole: null, content };
  }

  // ○/◯ マーカー付きパターン（一般質問見出し等）
  const markerMatch = stripped.match(/^[○◯◎●]\s*([\s\S]+)/);
  if (markerMatch) {
    const inner = markerMatch[1]!.trim();

    // ○役職（名前君）パターン
    const bracketMatch = inner.match(/^(.+?)[（(](.+?)(?:君|様|議員)[）)]\s*([\s\S]*)/);
    if (bracketMatch) {
      const rolePart = bracketMatch[1]!.trim();
      const rawName = bracketMatch[2]!.replace(/[\s　]+/g, "").trim();
      const content = bracketMatch[3]!.trim();

      for (const suffix of ROLE_SUFFIXES) {
        if (rolePart === suffix || rolePart.endsWith(suffix)) {
          return { speakerName: rawName, speakerRole: suffix, content };
        }
      }
      return { speakerName: rawName, speakerRole: rolePart || null, content };
    }

    // ○名前 役職 内容 パターン
    // 例: "八柳 喜行 議員 一般質問の要旨です。"
    // ROLE_SUFFIXES にマッチするトークンを探し、それより前を名前、後ろを内容とする
    const tokens = inner.split(/[\s　]+/);
    for (let i = 1; i < tokens.length; i++) {
      const token = tokens[i]!;
      for (const suffix of ROLE_SUFFIXES) {
        if (token === suffix || token.endsWith(suffix)) {
          const namePart = tokens.slice(0, i).join(" ").trim() || null;
          const content = tokens.slice(i + 1).join(" ").trim();
          return { speakerName: namePart, speakerRole: suffix, content };
        }
      }
    }

    // 先頭トークンだけに役職サフィックスがある場合
    const firstToken = tokens[0]!;
    for (const suffix of ROLE_SUFFIXES) {
      if (firstToken.endsWith(suffix)) {
        const name = firstToken.length > suffix.length
          ? firstToken.slice(0, -suffix.length)
          : null;
        const content = tokens.slice(1).join(" ").trim();
        return { speakerName: name, speakerRole: suffix, content };
      }
    }

    return { speakerName: null, speakerRole: null, content: inner };
  }

  return { speakerName: null, speakerRole: null, content: stripped };
}

/** 役職から発言種別を分類 */
export function classifyKind(
  speakerRole: string | null,
): "remark" | "question" | "answer" {
  if (!speakerRole) return "remark";
  if (ANSWER_ROLES.has(speakerRole)) return "answer";
  if (
    speakerRole === "議長" ||
    speakerRole === "副議長" ||
    speakerRole === "委員長" ||
    speakerRole === "副委員長"
  )
    return "remark";
  for (const role of ANSWER_ROLES) {
    if (speakerRole.endsWith(role)) return "answer";
  }
  return "question";
}

/**
 * PDF テキストから開催日を推測する。
 * 表紙の発行日または定例会情報から年月を取得し、月の初日を返す。
 *
 * パターン:
 *   「第2回定例会 会期 6月10日〜13日」 → 会期の初日
 *   「令和7年6月」 → 年月のみ判明した場合は月初日
 */
export function parseDateFromPdfText(
  text: string,
  meetingYear: number,
  meetingMonth: number,
): string | null {
  // 全角数字を半角に変換
  const normalized = text.replace(/[０-９]/g, (c) =>
    String.fromCharCode(c.charCodeAt(0) - 0xfee0),
  );

  // 「N月M日〜」パターンから開始日を抽出
  const periodMatch = normalized.match(
    /(\d+)月(\d+)日[〜～ー―](\d+)日/,
  );
  if (periodMatch) {
    const month = parseInt(periodMatch[1]!, 10);
    const day = parseInt(periodMatch[2]!, 10);
    if (month >= 1 && month <= 12 && day >= 1 && day <= 31) {
      return `${meetingYear}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    }
  }

  // 「令和/平成N年N月N日」パターン
  const dateMatch = normalized.match(/(令和|平成)(元|\d+)年(\d+)月(\d+)日/);
  if (dateMatch) {
    const year = convertJapaneseEra(dateMatch[1]!, dateMatch[2]!);
    if (!year) return null;
    const month = parseInt(dateMatch[3]!, 10);
    const day = parseInt(dateMatch[4]!, 10);
    return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
  }

  // フォールバック: リストページから取得した年月で月初日を返す
  return `${meetingYear}-${String(meetingMonth).padStart(2, "0")}-01`;
}

/**
 * PDF テキストを ParsedStatement 配列に変換する。
 *
 * 問/答パターンや ○マーカーを持つ行を発言として抽出する。
 */
export function parseStatements(text: string): ParsedStatement[] {
  const statements: ParsedStatement[] = [];
  let offset = 0;

  // 行に分割して処理
  const lines = text.split(/\n+/);

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line) continue;

    const hasQAMarker = /^[問答][（(]/.test(line);
    const hasCircleMarker = /^[○◯◎●]/.test(line);

    if (!hasQAMarker && !hasCircleMarker) continue;

    const normalized = line.replace(/\s+/g, " ");
    const { speakerName, speakerRole, content } = parseSpeaker(normalized);
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
 * PDF URL からテキストを取得する。
 */
async function fetchPdfText(pdfUrl: string): Promise<string | null> {
  try {
    const buffer = await fetchBinary(pdfUrl);
    if (!buffer) return null;

    const pdf = await getDocumentProxy(new Uint8Array(buffer));
    const { text } = await extractText(pdf, { mergePages: true });
    return text;
  } catch (err) {
    console.warn(
      `[053660-ikawa] PDF 取得失敗: ${pdfUrl}`,
      err instanceof Error ? err.message : err,
    );
    return null;
  }
}

/**
 * PDF をダウンロード・テキスト抽出し、MeetingData に変換する。
 */
export async function fetchMeetingData(
  meeting: IkawaMeeting,
  municipalityId: string,
): Promise<MeetingData | null> {
  const text = await fetchPdfText(meeting.pdfUrl);
  if (!text) return null;

  const statements = parseStatements(text);
  if (statements.length === 0) return null;

  const heldOn = parseDateFromPdfText(text, meeting.year, meeting.month);
  if (!heldOn) return null;

  const externalId = extractExternalId(meeting.pdfUrl);

  return {
    municipalityId,
    title: meeting.title,
    meetingType: detectMeetingType(meeting.title),
    heldOn,
    sourceUrl: meeting.pdfUrl,
    externalId,
    statements,
  };
}
