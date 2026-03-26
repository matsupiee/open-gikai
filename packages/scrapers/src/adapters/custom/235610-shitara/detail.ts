/**
 * 設楽町議会 — detail フェーズ
 *
 * PDF をダウンロードしてテキストを抽出し、発言者パターンで発言を分割して
 * ParsedStatement 配列を生成する。
 *
 * 発言フォーマット例（行頭の役職名または番号+氏名）:
 *   議長 皆さん、明けましておめでとうございます。
 *   町長 皆さんおはようございます。
 *   副町長 おはようございます、今年もよろしくお願いいたします。
 *   総務課長 それでは、説明をさせていただきます。
 *   ６今泉 おはようございます。
 */

import { createHash } from "node:crypto";
import { extractText, getDocumentProxy } from "../../../utils/pdf";
import type { MeetingData, ParsedStatement } from "../../../utils/types";
import type { ShitaraMeeting } from "./list";
import { detectMeetingType, fetchBinary, normalizeFullWidth } from "./shared";
import { buildExternalId } from "./list";

// 役職名パターン（長い方を先に置いて誤マッチを防ぐ）
const ROLE_NAMES = [
  "副委員長",
  "委員長",
  "副議長",
  "議長",
  "副町長",
  "町長",
  "副教育長",
  "教育長",
  "企画ダム対策課長",
  "津具総合支所長",
  "総務課長",
  "生活課長",
  "産業課長",
  "建設課長",
  "町民課長",
  "財政課長",
  "教育課長",
  "保健福祉センター所長",
  "出納室長",
  "事務局長",
  "副事務局長",
  "局長",
  "副局長",
  "副部長",
  "部長",
  "副課長",
  "課長",
  "室長",
  "係長",
  "参事",
  "主幹",
  "代表監査委員",
  "監査委員",
  "会計管理者",
];

// 行政側の役職（答弁者として分類する）
const ANSWER_ROLES = new Set([
  "町長",
  "副町長",
  "教育長",
  "副教育長",
  "企画ダム対策課長",
  "津具総合支所長",
  "総務課長",
  "生活課長",
  "産業課長",
  "建設課長",
  "町民課長",
  "財政課長",
  "教育課長",
  "保健福祉センター所長",
  "出納室長",
  "事務局長",
  "副事務局長",
  "局長",
  "副局長",
  "部長",
  "副部長",
  "課長",
  "副課長",
  "室長",
  "係長",
  "参事",
  "主幹",
  "代表監査委員",
  "監査委員",
  "会計管理者",
]);

/**
 * 行頭から発言者情報を抽出する。
 *
 * 設楽町の発言フォーマット:
 *   パターン1: "議長 発言内容" — 役職名のみ
 *   パターン2: "６今泉 発言内容" — 番号+氏名
 *   パターン3: "総務課長 発言内容" — 役職名（課長等）のみ
 */
export function parseSpeaker(line: string): {
  speakerName: string | null;
  speakerRole: string | null;
  content: string;
} | null {
  const trimmed = line.trim();
  if (!trimmed) return null;

  // スペース区切りで先頭トークンを取得
  const spaceMatch = trimmed.match(/^([^\s　]+)[\s　]+([\s\S]*)$/);
  if (!spaceMatch) return null;

  const header = spaceMatch[1]!;
  const content = spaceMatch[2]!.trim();

  if (!content) return null;

  // パターン1: 役職名のみ（ROLE_NAMES に完全一致）
  for (const role of ROLE_NAMES) {
    if (header === role) {
      return {
        speakerName: null,
        speakerRole: role,
        content,
      };
    }
  }

  // パターン2: 番号+氏名（全角・半角数字で始まる）
  // e.g., "６今泉", "10田中"
  const memberMatch = header.match(/^([０-９\d]+)(.+)$/);
  if (memberMatch) {
    const name = normalizeFullWidth(memberMatch[2]!.trim());
    return {
      speakerName: name || null,
      speakerRole: "議員",
      content,
    };
  }

  // パターン3: 役職サフィックス一致
  for (const role of ROLE_NAMES) {
    if (header.endsWith(role)) {
      const name =
        header.length > role.length ? header.slice(0, -role.length) : null;
      return {
        speakerName: name || null,
        speakerRole: role,
        content,
      };
    }
  }

  return null;
}

/** 役職から発言種別を分類 */
export function classifyKind(
  speakerRole: string | null
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
 * PDF から抽出したテキストを ParsedStatement 配列に変換する。
 *
 * 設楽町の PDF では発言者が行頭に役職名または番号+氏名で記載される。
 * 各行が発言行かどうかを判定して発言を結合する。
 */
export function parseStatements(text: string): ParsedStatement[] {
  const lines = text.split(/\n/);
  const statements: ParsedStatement[] = [];
  let offset = 0;

  let currentSpeakerName: string | null = null;
  let currentSpeakerRole: string | null = null;
  let currentContentLines: string[] = [];

  function flushCurrent() {
    if (currentContentLines.length === 0) return;
    const content = currentContentLines.join(" ").trim();
    if (!content) return;

    const contentHash = createHash("sha256").update(content).digest("hex");
    const startOffset = offset;
    const endOffset = offset + content.length;
    statements.push({
      kind: classifyKind(currentSpeakerRole),
      speakerName: currentSpeakerName,
      speakerRole: currentSpeakerRole,
      content,
      contentHash,
      startOffset,
      endOffset,
    });
    offset = endOffset + 1;
  }

  for (const rawLine of lines) {
    const line = rawLine.trim();

    // 空行はスキップ
    if (!line) continue;

    // ページ番号だけの行（数字のみ）はスキップ
    if (/^\d+$/.test(line)) continue;

    // 罫線はスキップ
    if (/^[-─━━\-=＝]+$/.test(line)) continue;

    const parsed = parseSpeaker(line);
    if (parsed) {
      // 現在の発言をフラッシュ
      flushCurrent();
      currentSpeakerName = parsed.speakerName;
      currentSpeakerRole = parsed.speakerRole;
      currentContentLines = [parsed.content];
    } else {
      // 発言の継続行として追加
      if (currentContentLines.length > 0) {
        currentContentLines.push(line);
      }
      // 発言者がまだ設定されていない場合は無視（メタ情報行）
    }
  }

  // 最後の発言をフラッシュ
  flushCurrent();

  return statements;
}

/**
 * PDF 内テキストから開催日を抽出する。
 *
 * パターン: "令和X年X月X日第X回設楽町議会定例会が設楽町役場議場に招集された。"
 */
export function extractHeldOnFromPdfText(text: string): string | null {
  const normalized = normalizeFullWidth(text);
  const match = normalized.match(
    /(令和|平成)(元|\d+)年(\d+)月(\d+)日/
  );
  if (!match) return null;

  const era = match[1]!;
  const eraYear = match[2] === "元" ? 1 : parseInt(match[2]!, 10);
  const month = parseInt(match[3]!, 10);
  const day = parseInt(match[4]!, 10);

  const westernYear = eraYear + (era === "平成" ? 1988 : 2018);

  return `${westernYear}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
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
      `[235610-shitara] PDF 取得失敗: ${pdfUrl}`,
      err instanceof Error ? err.message : err
    );
    return null;
  }
}

/**
 * PDF をダウンロード・テキスト抽出し、MeetingData に変換する。
 */
export async function fetchMeetingData(
  meeting: ShitaraMeeting,
  municipalityCode: string
): Promise<MeetingData | null> {
  const text = await fetchPdfText(meeting.pdfUrl);
  if (!text) return null;

  // PDF 内テキストから実際の開催日を取得
  const heldOn = extractHeldOnFromPdfText(text) ?? meeting.heldOn;

  const statements = parseStatements(text);
  if (statements.length === 0) return null;

  const externalId = buildExternalId(meeting.pdfUrl);

  return {
    municipalityCode,
    title: meeting.title,
    meetingType: detectMeetingType(meeting.meetingKind),
    heldOn,
    sourceUrl: meeting.pdfUrl,
    externalId,
    statements,
  };
}
