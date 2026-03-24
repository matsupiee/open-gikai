/**
 * 東洋町議会 — detail フェーズ
 *
 * PDF をダウンロードしてテキストを抽出し、○ マーカーで発言を分割して
 * ParsedStatement 配列を生成する。
 *
 * 発言フォーマット（実際の PDF テキスト）:
 *   ○ 議長（山田太郎君） ただいまから会議を開きます。
 *   ○ 町長（鈴木一郎君） お答えします。
 *   ○ 1番（田中花子君） 質問いたします。
 */

import { createHash } from "node:crypto";
import { extractText, getDocumentProxy } from "unpdf";
import type { MeetingData, ParsedStatement } from "../../../utils/types";
import type { ToyoPdfLink } from "./list";
import { parseDateFromLinkText } from "./list";
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

// 役職サフィックス（長い方を先に置いて誤マッチを防ぐ）
const ROLE_SUFFIXES = [
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

/**
 * ○ マーカー付きの発言テキストから話者情報を抽出する。
 *
 * 東洋町の PDF テキストはカッコ形式:
 *   ○ 議長（山田太郎君） 発言内容
 *   ○ 町長（鈴木一郎君） 発言内容
 *   ○ 1番（田中花子君） 発言内容
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

    // 番号議員パターン: "1番" → 議員
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

  // パターン2: スペース区切り形式
  const tokens = stripped.split(/\s+/);
  if (tokens.length >= 3) {
    for (let i = 1; i <= Math.min(3, tokens.length - 2); i++) {
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
  for (const suffix of ROLE_SUFFIXES) {
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
 * 東洋町の PDF は ○ マーカーで発言を区切る形式。
 * ○ マーカーがない場合は全テキストを単一の remark として扱う。
 */
export function parseStatements(text: string): ParsedStatement[] {
  const normalized = text.replace(/\s+/g, " ").trim();
  if (!normalized) return [];

  // ○ マーカーがある場合：発言ごとに分割
  if (/[○◯◎●]/.test(normalized)) {
    const blocks = normalized.split(/(?=[○◯◎●])/);
    const statements: ParsedStatement[] = [];
    let offset = 0;

    for (const block of blocks) {
      const trimmed = block.trim();
      if (!trimmed || !/^[○◯◎●]/.test(trimmed)) continue;

      // 出席表などの短いマーカーをスキップ
      const afterMarker = trimmed.replace(/^[○◯◎●]\s*/, "").trim();
      if (afterMarker.length < 5) continue;

      // ト書き（登壇等）をスキップ
      if (/^[○◯◎●]\s*[（(].+?(?:登壇|退席|退場|着席)[）)]$/.test(trimmed))
        continue;

      const { speakerName, speakerRole, content } = parseSpeaker(trimmed);
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

  // ○ マーカーなし：全テキストを単一の remark として扱う
  const contentHash = createHash("sha256").update(normalized).digest("hex");
  return [
    {
      kind: "remark",
      speakerName: null,
      speakerRole: null,
      content: normalized,
      contentHash,
      startOffset: 0,
      endOffset: normalized.length,
    },
  ];
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
      `[393011-toyo] PDF 取得失敗: ${pdfUrl}`,
      err instanceof Error ? err.message : err
    );
    return null;
  }
}

/**
 * PDF をダウンロード・テキスト抽出し、MeetingData に変換する。
 */
export async function fetchMeetingData(
  meeting: ToyoPdfLink,
  municipalityId: string
): Promise<MeetingData | null> {
  const heldOn = parseDateFromLinkText(meeting.text);
  if (!heldOn) return null;

  const text = await fetchPdfText(meeting.pdfUrl);
  if (!text) return null;

  const statements = parseStatements(text);
  if (statements.length === 0) return null;

  const idKey = extractExternalIdKey(new URL(meeting.pdfUrl).pathname);
  const externalId = idKey ? `toyo_${idKey}` : null;

  // タイトルを組み立てる（セッション情報 + リンクテキスト）
  const title = meeting.session
    ? meeting.session.replace(/\s+/g, " ").trim()
    : meeting.text.replace(/\s+/g, " ").trim();

  return {
    municipalityId,
    title,
    meetingType: detectMeetingType(meeting.session || meeting.text),
    heldOn,
    sourceUrl: meeting.pdfUrl,
    externalId,
    statements,
  };
}
