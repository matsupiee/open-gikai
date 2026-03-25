/**
 * 芸西村議会 — detail フェーズ
 *
 * PDF をダウンロードしてテキストを抽出し、○ マーカーで発言を分割して
 * ParsedStatement 配列を生成する。
 *
 * 発言フォーマット（実際の PDF テキスト）:
 *   ○ 岡村 俊彰 議長 ただいまの出席議員は 10 名です。...
 *   ○ 溝渕 孝 村長 おはようございます。...
 *   ○ 西笛 千代子 議員 おはようございます。...
 *
 * 注意: 出席表に「1 ○ 2 ○ 3 ○」のような出欠マーカーがあるため、
 * ○ の後ろが短いテキスト（数字のみ等）の場合はスキップする。
 */

import { createHash } from "node:crypto";
import { extractText, getDocumentProxy } from "unpdf";
import type { MeetingData, ParsedStatement } from "../../../utils/types";
import type { GeiseiMeeting } from "./list";
import {
  detectMeetingType,
  extractExternalIdKey,
  fetchBinary,
} from "./shared";

// 行政側の役職（答弁者として分類する）
const ANSWER_ROLES = new Set([
  "村長",
  "副村長",
  "町長",
  "副町長",
  "市長",
  "副市長",
  "教育長",
  "副教育長",
  "部長",
  "副部長",
  "課長",
  "副課長",
  "課長補佐",
  "室長",
  "局長",
  "事務局長",
  "係長",
  "参事",
  "主幹",
  "主査",
  "補佐",
  "教育次長",
]);

// 進行役の役職
const REMARK_ROLES = new Set([
  "議長",
  "副議長",
  "委員長",
  "副委員長",
]);

/**
 * ○ マーカー付きの発言ヘッダーから発言者情報を抽出する。
 *
 * 芸西村の PDF テキストは以下の形式:
 *   ○ 姓 名 役職 発言内容...
 *   例: ○ 岡村 俊彰 議長 ただいまの出席議員は...
 *   例: ○ 溝渕 孝 村長 おはようございます。...
 *   例: ○ 池田 加奈 総務課長 ご説明いたします。...
 *
 * また従来のカッコ形式にも対応:
 *   ○議長（山本松一君）　発言内容...
 */
export function parseSpeaker(text: string): {
  speakerName: string | null;
  speakerRole: string | null;
  content: string;
} {
  const stripped = text.replace(/^[○◯◎●]\s*/, "");

  // パターン1: カッコ形式 — role（name + 君|様|議員）content
  const parenMatch = stripped.match(
    /^(.+?)[（(](.+?)(?:君|様|議員)[）)]\s*([\s\S]*)/
  );
  if (parenMatch) {
    const rolePart = parenMatch[1]!.trim();
    const rawName = parenMatch[2]!.replace(/[\s　]+/g, "").trim();
    const content = parenMatch[3]!.trim();

    if (/^[\d０-９]+番$/.test(rolePart)) {
      return { speakerName: rawName, speakerRole: "議員", content };
    }

    const role = matchRole(rolePart);
    return {
      speakerName: rawName,
      speakerRole: role ?? (rolePart || null),
      content,
    };
  }

  // パターン2: スペース区切り形式 — 姓 名 役職 content
  // 例: "岡村 俊彰 議長 ただいまの出席議員は..."
  // 例: "池田 加奈 総務課長 ご説明いたします。"
  // トークンに分割し、3番目以降で役職にマッチするものを探す
  const tokens = stripped.split(/\s+/);
  if (tokens.length >= 4) {
    // tokens[0]=姓, tokens[1]=名, tokens[2]=役職(or 部署+役職), tokens[3..]=content
    // 3番目のトークンから役職をチェック
    for (let i = 2; i <= Math.min(3, tokens.length - 2); i++) {
      const rolePart = tokens[i]!;
      const role = matchRole(rolePart);
      if (role) {
        const name = tokens.slice(0, i).join("");
        const content = tokens.slice(i + 1).join(" ").trim();
        return { speakerName: name, speakerRole: role, content };
      }
    }
  }

  return { speakerName: null, speakerRole: null, content: stripped.trim() };
}

/**
 * 役職文字列からロールサフィックスをマッチさせる。
 * 長いパターンを先にチェックして誤マッチを防ぐ。
 */
function matchRole(rolePart: string): string | null {
  // 長い順に並べた役職リスト
  const roles = [
    "副委員長",
    "委員長",
    "副議長",
    "議長",
    "副村長",
    "副町長",
    "副市長",
    "村長",
    "町長",
    "市長",
    "副教育長",
    "教育長",
    "教育次長",
    "事務局長",
    "局長",
    "副部長",
    "部長",
    "課長補佐",
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

  for (const suffix of roles) {
    if (rolePart === suffix || rolePart.endsWith(suffix)) {
      return suffix;
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
  if (REMARK_ROLES.has(speakerRole)) return "remark";
  for (const role of ANSWER_ROLES) {
    if (speakerRole.endsWith(role)) return "answer";
  }
  return "question";
}

/**
 * PDF から抽出したテキストを ParsedStatement 配列に変換する。
 *
 * 出席表の「1 ○ 2 ○ 3 ○」パターンを除外するため、
 * ○ の後ろが5文字未満の短いテキストの場合はスキップする。
 */
export function parseStatements(text: string): ParsedStatement[] {
  const blocks = text.split(/(?=[○◯◎●])/);
  const statements: ParsedStatement[] = [];
  let offset = 0;

  for (const block of blocks) {
    const trimmed = block.trim();
    if (!trimmed || !/^[○◯◎●]/.test(trimmed)) continue;

    // 出席表の出欠マーカー除外: ○ の後が短いテキスト（数字、空白のみ等）
    const afterMarker = trimmed.replace(/^[○◯◎●]\s*/, "").trim();
    if (afterMarker.length < 5) continue;

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
      `[393070-geisei] PDF 取得失敗: ${pdfUrl}`,
      err instanceof Error ? err.message : err
    );
    return null;
  }
}

/**
 * PDF をダウンロード・テキスト抽出し、MeetingData に変換する。
 */
export async function fetchMeetingData(
  meeting: GeiseiMeeting,
  municipalityCode: string
): Promise<MeetingData | null> {
  const text = await fetchPdfText(meeting.pdfUrl);
  if (!text) return null;

  const statements = parseStatements(text);
  if (statements.length === 0) return null;

  const idKey = extractExternalIdKey(new URL(meeting.pdfUrl).pathname);
  const externalId = idKey ? `geisei_${idKey}` : null;

  return {
    municipalityCode,
    title: meeting.title,
    meetingType: detectMeetingType(meeting.section),
    heldOn: meeting.heldOn,
    sourceUrl: meeting.pdfUrl,
    externalId,
    statements,
  };
}
