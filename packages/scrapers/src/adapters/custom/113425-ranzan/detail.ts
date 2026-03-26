/**
 * 嵐山町議会 会議録 — detail フェーズ
 *
 * PDF をダウンロードしてテキストを抽出し、○ マーカーで発言を分割して
 * ParsedStatement 配列を生成する。
 *
 * 発言フォーマット（PDF 内テキスト）:
 *   ○議長（山田太郎）　ただいまから本日の会議を開きます。
 *   ○町長（鈴木一郎）　お答えいたします。
 *   ○３番（佐藤花子）　質問いたします。
 *   ○総務課長（高橋次郎）　ご説明いたします。
 */

import { createHash } from "node:crypto";
import { extractText, getDocumentProxy } from "../../../utils/pdf";
import type { MeetingData, ParsedStatement } from "../../../utils/types";
import type { RanzanMeeting } from "./list";
import { detectMeetingType, fetchBinary } from "./shared";

// 役職サフィックス（長い方を先に置いて誤マッチを防ぐ）
const ROLE_SUFFIXES = [
  "副委員長",
  "委員長",
  "副議長",
  "副町長",
  "教育長",
  "代表監査委員",
  "議長",
  "町長",
  "委員",
  "議員",
  "副部長",
  "副課長",
  "事務局長",
  "部長",
  "課長",
  "室長",
  "局長",
  "係長",
  "参事",
  "主幹",
  "次長",
  "主査",
  "補佐",
];

// 行政側の役職（答弁者として分類する）
const ANSWER_ROLES = new Set([
  "町長",
  "副町長",
  "教育長",
  "代表監査委員",
  "部長",
  "副部長",
  "課長",
  "副課長",
  "事務局長",
  "室長",
  "局長",
  "係長",
  "参事",
  "主幹",
  "次長",
  "主査",
  "補佐",
]);

/**
 * ○ マーカー付きの発言ヘッダーから発言者情報を抽出する。
 *
 * 対応パターン:
 *   ○議長（山田太郎）　→ role=議長, name=山田太郎
 *   ○町長（鈴木一郎）　→ role=町長, name=鈴木一郎
 *   ○３番（佐藤花子）　→ role=議員, name=佐藤花子
 *   ○総務課長（高橋次郎）　→ role=課長, name=高橋次郎
 */
export function parseSpeaker(text: string): {
  speakerName: string | null;
  speakerRole: string | null;
  content: string;
} {
  const stripped = text.replace(/^[○◯◎●]\s*/, "");

  // パターン: role（name）content
  const match = stripped.match(/^(.+?)[（(](.+?)[）)]\s*([\s\S]*)/);
  if (match) {
    const rolePart = match[1]!.replace(/[\s　]+/g, "").trim();
    const rawName = match[2]!.replace(/[\s　]+/g, "").trim();
    const content = match[3]!.trim();

    // 番号付き議員: ○３番（佐藤花子）
    if (/^[\d０-９]+番$/.test(rolePart)) {
      return { speakerName: rawName, speakerRole: "議員", content };
    }

    // 役職マッチ（長い方から順にチェック）
    for (const suffix of ROLE_SUFFIXES) {
      if (rolePart === suffix || rolePart.endsWith(suffix)) {
        return { speakerName: rawName, speakerRole: suffix, content };
      }
    }

    // 役職不明でもカッコパターンに合致した場合は rolePart をそのまま使用
    return { speakerName: rawName, speakerRole: rolePart || null, content };
  }

  // カッコパターンに合致しない場合
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
 * ○ マーカーで発言を分割し、各ブロックから話者名・役職・本文を抽出する。
 */
export function parseStatements(text: string): ParsedStatement[] {
  const blocks = text.split(/(?=[○◯◎●])/);
  const statements: ParsedStatement[] = [];
  let offset = 0;

  for (const block of blocks) {
    const trimmed = block.trim();
    if (!trimmed || !/^[○◯◎●]/.test(trimmed)) continue;

    // ページヘッダー・フッター行をスキップ
    if (
      /^[○◯◎●]\s*(?:開\s*会|散\s*会|出席議員|欠席議員|説明のための出席者|議会事務局職員出席者|傍聴者)/.test(
        trimmed,
      )
    ) {
      continue;
    }

    // ト書き（登壇等）をスキップ
    if (
      /^[○◯◎●]\s*[（(].+?(?:登壇|退席|退場|着席)[）)]$/.test(trimmed)
    )
      continue;

    const normalized = trimmed
      .replace(/\x0c/g, "") // フォームフィード文字を除去
      .replace(/\s+/g, " ")
      .trim();

    if (!normalized) continue;

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
      `[113425-ranzan] PDF 取得失敗: ${pdfUrl}`,
      err instanceof Error ? err.message : err,
    );
    return null;
  }
}

/**
 * PDF をダウンロード・テキスト抽出し、MeetingData に変換する。
 */
export async function fetchMeetingData(
  meeting: RanzanMeeting,
  municipalityCode: string,
): Promise<MeetingData | null> {
  const text = await fetchPdfText(meeting.pdfUrl);
  if (!text) return null;

  const statements = parseStatements(text);
  if (statements.length === 0) return null;

  // PDF URL からファイル名部分を externalId として利用
  const urlPath = new URL(meeting.pdfUrl).pathname;
  const fileName = urlPath.split("/").pop()?.replace(/\.pdf$/i, "") ?? null;
  const externalId = fileName ? `ranzan_${fileName}` : null;

  return {
    municipalityCode,
    title: meeting.title,
    meetingType: detectMeetingType(meeting.title),
    heldOn: meeting.heldOn,
    sourceUrl: meeting.pdfUrl,
    externalId,
    statements,
  };
}
