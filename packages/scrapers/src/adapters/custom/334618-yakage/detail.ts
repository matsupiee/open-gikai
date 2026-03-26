/**
 * 矢掛町議会 — detail フェーズ
 *
 * PDF をダウンロードしてテキストを抽出し、○ マーカーで発言を分割して
 * ParsedStatement 配列を生成する。
 *
 * 発言フォーマット例:
 *   ○議長（山田 太郎君） ただいまから会議を開きます。
 *   ○町長（鈴木 一郎君） お答えいたします。
 *   ○3番（田中 二郎君） 質問いたします。
 *   ○総務課長（中村 三郎君） ご説明いたします。
 */

import { createHash } from "node:crypto";
import { extractText, getDocumentProxy } from "../../../utils/pdf";
import type { MeetingData, ParsedStatement } from "../../../utils/types";
import type { YakageMeeting } from "./list";
import { detectMeetingType, fetchBinary } from "./shared";

// 役職サフィックス（長いものを先に置いて誤マッチを防ぐ）
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
  "委員",
];

// 行政側の役職（答弁者として分類する）
const ANSWER_ROLES = new Set([
  "町長",
  "副町長",
  "教育長",
  "副教育長",
  "事務局長",
  "局長",
  "部長",
  "副部長",
  "課長",
  "副課長",
  "室長",
  "係長",
  "参事",
  "主幹",
  "主査",
  "補佐",
]);

/**
 * ○ マーカー付きの発言ヘッダーから発言者情報を抽出する。
 *
 * 対応パターン:
 *   ○議長（山田 太郎君） → role=議長, name=山田 太郎
 *   ○町長（鈴木 一郎君） → role=町長, name=鈴木 一郎
 *   ○3番（田中 二郎君） → role=議員, name=田中 二郎
 *   ○総務課長（中村 三郎君） → role=課長, name=中村 三郎
 */
export function parseSpeaker(text: string): {
  speakerName: string | null;
  speakerRole: string | null;
  content: string;
} {
  const stripped = text.replace(/^[○◯◎●]\s*/, "");

  // パターン: role（name + 君|様|省略）content
  const match = stripped.match(
    /^(.+?)[（(](.+?)(?:君|様)?[）)]\s*([\s\S]*)/
  );
  if (match) {
    const rolePart = match[1]!.trim();
    const rawName = match[2]!.trim();
    const content = match[3]!.trim();

    // 番号付き議員: ○3番（田中 二郎君） または ○○番（名前）
    const cleanName = rawName
      .replace(/^[\d０-９]+番\s*/, "")
      .replace(/君$|様$/, "")
      .trim();

    // 役職マッチ
    for (const suffix of ROLE_SUFFIXES) {
      if (rolePart === suffix || rolePart.endsWith(suffix)) {
        return {
          speakerName: cleanName || null,
          speakerRole: suffix,
          content,
        };
      }
    }

    // ○○番（名前）パターン: 番号部分が役職として認識されない場合は議員扱い
    if (/^[○◯◎●\d０-９]+番$/.test(rolePart) || /^\d+$/.test(rolePart)) {
      return {
        speakerName: cleanName || rawName || null,
        speakerRole: "議員",
        content,
      };
    }

    return {
      speakerName: cleanName || rawName || null,
      speakerRole: rolePart || null,
      content,
    };
  }

  // カッコパターンに合致しない場合（スペース区切り）
  const headerMatch = stripped.match(/^([^\s　]{1,30})[\s　]+([\s\S]*)/);
  if (headerMatch && /^[○◯◎●]/.test(text)) {
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
 * ○ マーカーで始まるブロックを発言として分割する。
 */
export function parseStatements(text: string): ParsedStatement[] {
  // ○ マーカーで発言を分割
  const blocks = text.split(/(?=○[^）\n]{1,30}[（(])/);
  const statements: ParsedStatement[] = [];
  let offset = 0;

  for (const block of blocks) {
    const trimmed = block.trim();
    if (!trimmed || !/^[○◯◎●]/.test(trimmed)) continue;

    // ト書き（登壇等）をスキップ
    if (/^[○◯◎●]\s*[（(].+?(?:登壇|退席|退場|着席)[）)]$/.test(trimmed))
      continue;

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

    const pdf = await getDocumentProxy(new Uint8Array(buffer));
    const { text } = await extractText(pdf, { mergePages: true });
    return text;
  } catch (err) {
    console.warn(
      `[334618-yakage] PDF 取得失敗: ${pdfUrl}`,
      err instanceof Error ? err.message : err
    );
    return null;
  }
}

/**
 * PDF をダウンロード・テキスト抽出し、MeetingData に変換する。
 */
export async function fetchMeetingData(
  meeting: YakageMeeting,
  municipalityCode: string
): Promise<MeetingData | null> {
  const text = await fetchPdfText(meeting.pdfUrl);
  if (!text) return null;

  const statements = parseStatements(text);
  if (statements.length === 0) return null;

  // externalId: PDF URL のファイル名部分を使用
  const fileMatch = meeting.pdfUrl.match(/\/([^/]+?)(?:\.pdf)+$/i);
  const idKey = fileMatch ? fileMatch[1] : null;
  const externalId = idKey ? `yakage_${idKey}` : null;

  return {
    municipalityCode,
    title: meeting.title,
    meetingType: detectMeetingType(meeting.meetingKind),
    heldOn: meeting.heldOn ?? "",
    sourceUrl: meeting.pdfUrl,
    externalId,
    statements,
  };
}
