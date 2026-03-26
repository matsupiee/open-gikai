/**
 * 川棚町議会 会議録 — detail フェーズ
 *
 * PDF をダウンロードしてテキストを抽出し、○ マーカーで発言を分割して
 * ParsedStatement 配列を生成する。
 *
 * 発言フォーマット（想定）:
 *   ○議長（中村XX君）　ただいまから会議を開きます。
 *   ○町長（XX君）　お答えいたします。
 *   ○３番（XX君）　質問いたします。
 *   ○総務課長（XX君）　お答えいたします。
 *
 * マーカー: ○ (U+25CB), ◯ (U+25EF), 〇 (U+3007) のいずれか
 */

import { createHash } from "node:crypto";
import { extractText, getDocumentProxy } from "../../../utils/pdf";
import type { MeetingData, ParsedStatement } from "../../../utils/types";
import type { KawatanaMeeting } from "./list";
import { fetchBinary } from "./shared";

// 役職サフィックス（長い方を先に置いて誤マッチを防ぐ）
const ROLE_SUFFIXES = [
  "議会運営委員長",
  "副委員長",
  "委員長",
  "副議長",
  "議長",
  "副町長",
  "町長",
  "副教育長",
  "教育長",
  "教育次長",
  "事務局長",
  "局長",
  "会計管理者",
  "管理者",
  "副部長",
  "部長",
  "副参事",
  "参事",
  "副課長",
  "課長",
  "係長",
  "所長",
  "主幹",
  "主査",
  "補佐",
  "議員",
  "委員",
];

// 行政側の役職（答弁者として分類する）
const ANSWER_ROLES = new Set([
  "町長",
  "副町長",
  "教育長",
  "副教育長",
  "教育次長",
  "事務局長",
  "局長",
  "会計管理者",
  "管理者",
  "部長",
  "副部長",
  "課長",
  "副課長",
  "参事",
  "副参事",
  "係長",
  "所長",
  "主幹",
  "主査",
  "補佐",
]);

/**
 * ○ マーカー付きの発言ヘッダーから発言者情報を抽出する。
 *
 * 対応パターン:
 *   ○議長（中村XX君）　→ role=議長, name=中村XX
 *   ○町長（XX君）　→ role=町長, name=XX
 *   ○３番（XX君）　→ role=議員, name=XX
 *   ○総務課長（XX君）→ role=課長, name=XX
 */
export function parseSpeaker(text: string): {
  speakerName: string | null;
  speakerRole: string | null;
  content: string;
} {
  const stripped = text.replace(/^[○◯〇]\s*/, "");

  // パターン: role（name + 君|様|議員）content
  const match = stripped.match(
    /^(.+?)[（(](.+?)(?:君|様|議員)[）)]\s*([\s\S]*)/,
  );
  if (match) {
    const rolePart = match[1]!.trim();
    const rawName = match[2]!.replace(/[\s\u3000]+/g, "").trim();
    const content = match[3]!.trim();

    // 番号付き議員: ○３番（XX君）
    if (/^[\d０-９]+番$/.test(rolePart)) {
      return { speakerName: rawName, speakerRole: "議員", content };
    }

    // 役職マッチ
    for (const suffix of ROLE_SUFFIXES) {
      if (rolePart === suffix || rolePart.endsWith(suffix)) {
        return { speakerName: rawName, speakerRole: suffix, content };
      }
    }

    return { speakerName: rawName, speakerRole: rolePart || null, content };
  }

  // ○ マーカーはあるがカッコパターンに合致しない場合
  const headerMatch = stripped.match(
    /^([^\s\u3000]{1,30})[\s\u3000]+([\s\S]*)/,
  );
  if (headerMatch) {
    const header = headerMatch[1]!;
    const content = headerMatch[2]!.trim();

    for (const suffix of ROLE_SUFFIXES) {
      if (header.endsWith(suffix)) {
        const name =
          header.length > suffix.length
            ? header.slice(0, -suffix.length)
            : null;
        return { speakerName: name, speakerRole: suffix, content };
      }
    }
  }

  return { speakerName: null, speakerRole: null, content: stripped.trim() };
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
    speakerRole === "副委員長" ||
    speakerRole === "議会運営委員長"
  )
    return "remark";
  for (const role of ANSWER_ROLES) {
    if (speakerRole.endsWith(role)) return "answer";
  }
  return "question";
}

/**
 * PDF から抽出したテキストを ParsedStatement 配列に変換する。
 * ○/◯/〇 マーカーで分割する。
 */
export function parseStatements(text: string): ParsedStatement[] {
  const blocks = text.split(/(?=[○◯〇])/);
  const statements: ParsedStatement[] = [];
  let offset = 0;

  for (const block of blocks) {
    const trimmed = block.trim();
    if (!trimmed || !/^[○◯〇]/.test(trimmed)) continue;

    // 議事日程など見出し項目をスキップ
    if (/^[○◯〇]議事日程/.test(trimmed)) continue;
    if (/^[○◯〇]出席議員/.test(trimmed)) continue;
    if (/^[○◯〇]欠席議員/.test(trimmed)) continue;
    if (/^[○◯〇]出席説明員/.test(trimmed)) continue;
    if (/^[○◯〇]出席事務局/.test(trimmed)) continue;
    if (/^[○◯〇]説明のため/.test(trimmed)) continue;
    if (/^[○◯〇]議会事務局職員/.test(trimmed)) continue;

    const normalized = trimmed.replace(/\s+/g, " ");
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

    const pdf = await getDocumentProxy(buffer);
    const { text } = await extractText(pdf, { mergePages: true });
    return text;
  } catch (err) {
    console.warn(
      `[423220-kawatana] PDF 取得失敗: ${pdfUrl}`,
      err instanceof Error ? err.message : err,
    );
    return null;
  }
}

/**
 * KawatanaMeeting から MeetingData を組み立てる。
 * heldOn が null の場合は null を返す（フォールバック値禁止）。
 */
export async function buildMeetingData(
  meeting: KawatanaMeeting,
  municipalityCode: string,
): Promise<MeetingData | null> {
  if (!meeting.heldOn) return null;

  const text = await fetchPdfText(meeting.pdfUrl);
  if (!text) return null;

  const statements = parseStatements(text);
  if (statements.length === 0) return null;

  return {
    municipalityCode,
    title: meeting.title,
    meetingType: meeting.meetingType,
    heldOn: meeting.heldOn,
    sourceUrl: meeting.pdfUrl,
    externalId: meeting.externalId,
    statements,
  };
}
