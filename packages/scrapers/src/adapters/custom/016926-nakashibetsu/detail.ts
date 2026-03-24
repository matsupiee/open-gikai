/**
 * 中標津町議会 会議録 — detail フェーズ
 *
 * 一般質問 PDF をダウンロードしてテキストを抽出し、
 * 通告番号ベースで発言を分割して ParsedStatement 配列を生成する。
 *
 * 発言フォーマット（一般質問 PDF）:
 *   通告1　阿部隆弘議員
 *   【質問内容テキスト】
 *
 *   通告2　○○○○議員
 *   【質問内容テキスト】
 */

import { createHash } from "node:crypto";
import { extractText, getDocumentProxy } from "unpdf";
import type { MeetingData, ParsedStatement } from "../../../utils/types";
import type { NakashibetsuMeeting } from "./list";
import { detectMeetingType, extractExternalIdKey, fetchBinary } from "./shared";

// 役職サフィックス（長いものを先に置いて誤マッチを防ぐ）
const ROLE_SUFFIXES = [
  "副委員長",
  "委員長",
  "副議長",
  "議長",
  "副町長",
  "町長",
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
]);

/**
 * 通告ブロックのヘッダー行から発言者名を抽出する。
 *
 * 対応パターン:
 *   通告1　阿部隆弘議員    → name=阿部隆弘
 *   通告2 ○○議員          → name=○○
 */
export function parseSpeakerFromTsuukou(line: string): string | null {
  const match = line.match(/通告\d+[\s　]+(.+?)議員/);
  if (!match) return null;
  return match[1]!.trim().replace(/\s+/g, "");
}

/**
 * ○ マーカー付きの発言ヘッダーから発言者情報を抽出する。
 *
 * 対応パターン:
 *   ○議長（田中太郎君）　…         → role=議長, name=田中太郎
 *   ○町長（山田次郎君）　…         → role=町長, name=山田次郎
 *   ○3番（佐藤花子君）　…         → role=議員, name=佐藤花子
 *   ○田中太郎議長　…               → role=議長, name=田中太郎
 */
export function parseSpeaker(text: string): {
  speakerName: string | null;
  speakerRole: string | null;
  content: string;
} {
  const stripped = text.replace(/^[○◯◎●]\s*/, "");

  // パターン1: {number}番（{name}君|議員|様）content
  const numberBracketMatch = stripped.match(
    /^[\d０-９]+番[（(](.+?)(?:君|議員|様)[）)]\s*([\s\S]*)/,
  );
  if (numberBracketMatch) {
    const name = numberBracketMatch[1]!.trim().replace(/\s+/g, "");
    const content = numberBracketMatch[2]!.trim();
    return { speakerName: name, speakerRole: "議員", content };
  }

  // パターン2: {role}（{name}君|議員|様）content (e.g., 議長（田中太郎君）)
  const roleBracketMatch = stripped.match(
    /^(.+?)[（(](.+?)(?:君|議員|様)[）)]\s*([\s\S]*)/,
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

  // パターン3: {name}{role} content (e.g., 田中太郎議長 ...)
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
export function classifyKind(speakerRole: string | null): "remark" | "question" | "answer" {
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
 * 通告番号形式で分割されたPDFテキストをパースして ParsedStatement を生成する。
 *
 * 一般質問PDFは「通告N 議員名議員」形式のヘッダーブロックで区切られる。
 * ○ マーカー形式の発言もサポートする（逐語録形式の場合）。
 */
export function parseStatements(text: string): ParsedStatement[] {
  // ○ マーカー形式のテキストが含まれる場合
  if (/[○◯◎●]/.test(text)) {
    return parseStatementsFromMarkers(text);
  }

  // 通告形式のテキスト
  return parseStatementsFromTsuukou(text);
}

/**
 * ○ マーカー形式で発言をパースする。
 */
function parseStatementsFromMarkers(text: string): ParsedStatement[] {
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
 * 通告番号形式でブロックをパースして ParsedStatement を生成する。
 *
 * 「通告N 議員名議員」行をヘッダーとして各ブロックを分割し、
 * ブロック本文を1つの発言として扱う。
 */
function parseStatementsFromTsuukou(text: string): ParsedStatement[] {
  // 通告番号行でテキストを分割
  const blocks = text.split(/(?=通告\d+[\s　])/);
  const statements: ParsedStatement[] = [];
  let offset = 0;

  for (const block of blocks) {
    const trimmed = block.trim();
    if (!trimmed) continue;

    // 通告ヘッダー行と本文を分離
    const lines = trimmed.split(/\n/);
    const headerLine = lines[0]!;

    // 通告形式かチェック
    if (!/^通告\d+/.test(headerLine)) continue;

    const speakerName = parseSpeakerFromTsuukou(headerLine);
    const content = lines.slice(1).join("\n").trim();

    if (!content) continue;

    const contentHash = createHash("sha256").update(content).digest("hex");
    const startOffset = offset;
    const endOffset = offset + content.length;

    statements.push({
      kind: "question",
      speakerName,
      speakerRole: "議員",
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
      `[016926-nakashibetsu] PDF 取得失敗: ${pdfUrl}`,
      err instanceof Error ? err.message : err,
    );
    return null;
  }
}

/**
 * 一般質問 PDF をダウンロード・テキスト抽出し、MeetingData に変換する。
 */
export async function fetchMeetingData(
  meeting: NakashibetsuMeeting,
  municipalityId: string,
): Promise<MeetingData | null> {
  const text = await fetchPdfText(meeting.pdfUrl);
  if (!text) return null;

  const statements = parseStatements(text);
  if (statements.length === 0) return null;

  const idKey = extractExternalIdKey(meeting.pdfUrl);
  const externalId = idKey ? `nakashibetsu_${idKey}` : null;

  // 開催日は月初とする（PDFから正確な日付を取得できないため）
  const heldOn = `${meeting.year}-${String(meeting.month).padStart(2, "0")}-01`;

  return {
    municipalityId,
    title: meeting.title,
    meetingType: detectMeetingType(meeting.sessionName),
    heldOn,
    sourceUrl: meeting.pdfUrl,
    externalId,
    statements,
  };
}
