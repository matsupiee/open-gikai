/**
 * 有田川町議会 会議録 -- detail フェーズ
 *
 * PDF をダウンロードしてテキストを抽出し、○ マーカーで発言を分割して
 * ParsedStatement 配列を生成する。
 *
 * 有田川町の PDF 会議録は一般的な地方議会会議録フォーマットに従い、
 * ○ マーカーで発言者を区切る形式を想定する。
 *
 * 発言フォーマット（想定）:
 *   ○議長（山田太郎）　ただいまより本日の会議を開きます。
 *   ○3番（佐藤花子）　質問します。
 *   ○町長（鈴木一郎）　お答えいたします。
 */

import { createHash } from "node:crypto";
import { extractText, getDocumentProxy } from "unpdf";
import type { MeetingData, ParsedStatement } from "../../../utils/types";
import type { AridagawaMeeting } from "./list";
import { fetchBinary } from "./shared";

// 役職サフィックス（長い方を先に置いて誤マッチを防ぐ）
const ROLE_SUFFIXES = [
  "副委員長",
  "委員長",
  "副議長",
  "議長",
  "副町長",
  "町長",
  "事務局次長",
  "事務局長",
  "副部長",
  "部長",
  "副課長",
  "課長",
  "室長",
  "局長",
  "係長",
  "参事",
  "主幹",
  "主査",
  "管理者",
  "議員",
  "委員",
];

// 行政側の役職（答弁者として分類する）
const ANSWER_ROLES = new Set([
  "町長",
  "副町長",
  "部長",
  "副部長",
  "課長",
  "副課長",
  "室長",
  "局長",
  "係長",
  "参事",
  "主幹",
  "主査",
  "管理者",
  "事務局長",
  "事務局次長",
]);

/**
 * ○ マーカー付きの発言ヘッダーから発言者情報を抽出する。
 *
 * 対応パターン:
 *   ○議長（山田太郎）　テキスト
 *   ○3番（佐藤花子）　テキスト
 *   ○町長（鈴木一郎）　テキスト
 *   ○企画部長（田中次郎）　テキスト
 *   ○山田太郎議長　テキスト
 */
export function parseSpeaker(text: string): {
  speakerName: string | null;
  speakerRole: string | null;
  content: string;
} {
  const stripped = text.replace(/^[○◯◎●]\s*/, "");

  // パターン1: {number}番（{name}）content  or {number}番（{name}議員|君|様）content
  const bracketNumMatch = stripped.match(
    /^[\d０-９]+番[（(](.+?)(?:議員|君|様)?[）)]\s*([\s\S]*)/
  );
  if (bracketNumMatch) {
    const name = bracketNumMatch[1]!.trim().replace(/\s+/g, "");
    const content = bracketNumMatch[2]!.trim();
    return { speakerName: name, speakerRole: "議員", content };
  }

  // パターン2: {role}（{name}）content (e.g., 議長（山田太郎）)
  const roleBracketMatch = stripped.match(
    /^(.+?)[（(]([^）)]+)[）)]\s*([\s\S]*)/
  );
  if (roleBracketMatch) {
    const rolePart = roleBracketMatch[1]!.trim();
    const name = roleBracketMatch[2]!.trim().replace(/\s+/g, "");
    const content = roleBracketMatch[3]!.trim();

    for (const suffix of ROLE_SUFFIXES) {
      if (rolePart === suffix || rolePart.endsWith(suffix)) {
        return { speakerName: name, speakerRole: suffix, content };
      }
    }

    return { speakerName: name, speakerRole: rolePart || null, content };
  }

  // パターン3: {name}{role} content (e.g., 山田太郎議長 ...)
  const headerMatch = stripped.match(/^([^\s　]{1,30})[\s　]+([\s\S]*)/);
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

    // ○ マーカーがある場合、役職が不明でも先頭を名前として扱う
    if (/^[○◯◎●]/.test(text)) {
      return { speakerName: header, speakerRole: null, content };
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
 */
export function parseStatements(text: string): ParsedStatement[] {
  const blocks = text.split(/(?=[○◯◎●])/);
  const statements: ParsedStatement[] = [];
  let offset = 0;

  for (const block of blocks) {
    const trimmed = block.trim();
    if (!trimmed || !/^[○◯◎●]/.test(trimmed)) continue;

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
      `[303666-aridagawa] PDF 取得失敗: ${pdfUrl}`,
      err instanceof Error ? err.message : err
    );
    return null;
  }
}

/**
 * PDF をダウンロード・テキスト抽出し、MeetingData に変換する。
 */
export async function fetchMeetingData(
  meeting: AridagawaMeeting,
  municipalityId: string
): Promise<MeetingData | null> {
  const text = await fetchPdfText(meeting.pdfUrl);
  if (!text) return null;

  const statements = parseStatements(text);
  if (statements.length === 0) return null;

  // ファイル名から externalId を生成
  const filename = meeting.pdfUrl.split("/").pop()?.replace(/\.pdf$/i, "") ?? null;
  const externalId = filename ? `aridagawa_${filename}` : null;

  return {
    municipalityId,
    title: meeting.title,
    meetingType: meeting.meetingType,
    heldOn: meeting.heldOn,
    sourceUrl: meeting.pdfUrl,
    externalId,
    statements,
  };
}
