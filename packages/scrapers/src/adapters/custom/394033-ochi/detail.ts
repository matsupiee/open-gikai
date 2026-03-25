/**
 * 越知町議会 — detail フェーズ
 *
 * PDF をダウンロードしてテキストを抽出し、発言を分割して
 * ParsedStatement 配列を生成する。
 *
 * 発言フォーマット（PDF テキスト）:
 *   議　長（小 田 範 博 君）おはようございます。
 *   ８　番（武 智　 龍 君）それでは、一般質問をさせていただきます。
 *   産業課長（武智 久幸 君）お答えいたします。
 *
 * 特徴:
 * - 氏名の間にスペース（全角・半角）が入る: 「小 田 範 博」
 * - 議長は「議　長」（全角スペース）形式
 * - 番号議員は「N　番」（全角スペースあり）形式
 * - 役職付きは「役職名（氏名 君）」形式
 */

import { createHash } from "node:crypto";
import { extractText, getDocumentProxy } from "unpdf";
import type { MeetingData, ParsedStatement } from "../../../utils/types";
import type { OchiMeeting } from "./list";
import { parseMeetingDateFromText, parseMeetingTitleFromText } from "./list";
import { fetchBinary, normalizeDigits } from "./shared";

// 行政側の役職（答弁者として分類する）
const ANSWER_ROLES = new Set([
  "市長",
  "副市長",
  "町長",
  "副町長",
  "村長",
  "副村長",
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

// 役職サフィックス（長いものを先に並べて誤マッチを防ぐ）
const ROLE_SUFFIXES = [
  "副委員長",
  "委員長",
  "副議長",
  "議長",
  "副町長",
  "副市長",
  "副村長",
  "町長",
  "市長",
  "村長",
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

/**
 * 越知町議会 PDF の発言行から話者情報を抽出する。
 *
 * 発言フォーマット:
 *   議　長（小 田 範 博 君）発言内容
 *   ８　番（武 智　 龍 君）発言内容
 *   産業課長（武智 久幸 君）発言内容
 */
export function parseSpeaker(line: string): {
  speakerName: string | null;
  speakerRole: string | null;
  content: string;
} {
  // 全角スペースを含む役職・番号パターンに対応するため、全角スペースを半角に変換してからマッチ
  const normalized = line.replace(/　/g, " ").replace(/\s+/g, " ").trim();

  // カッコ形式: 役職（氏名 君）発言内容
  // 例: "議 長（小 田 範 博 君）おはようございます。"
  const parenMatch = normalized.match(
    /^(.+?)[（(](.+?)(?:君|様|議員)[）)]\s*([\s\S]*)/
  );
  if (parenMatch) {
    const rolePart = parenMatch[1]!.replace(/\s/g, "").trim();
    // 氏名中のスペースを除去して正規化
    const rawName = parenMatch[2]!.replace(/\s/g, "").trim();
    const content = parenMatch[3]!.trim();

    // 番号議員パターン: "8番" or "１番" → 議員
    const digitNorm = normalizeDigits(rolePart);
    if (/^\d+番$/.test(digitNorm)) {
      return { speakerName: rawName, speakerRole: "議員", content };
    }

    const role = matchRole(rolePart);
    return {
      speakerName: rawName,
      speakerRole: role ?? (rolePart || null),
      content,
    };
  }

  return { speakerName: null, speakerRole: null, content: normalized };
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
 * 発言行かどうかを判定する。
 *
 * 越知町の発言行パターン:
 *   「役職（氏名 君）」または「N番（氏名 君）」の形式
 *   全角スペース・半角スペースが混在する。
 */
function isSpeakerLine(line: string): boolean {
  const normalized = line.replace(/　/g, " ").replace(/\s+/g, " ").trim();
  // 「（...君）」または「（...様）」を含む行
  return /[（(].+?(?:君|様|議員)[）)]/.test(normalized);
}

/**
 * PDF から抽出したテキストを ParsedStatement 配列に変換する。
 *
 * 越知町の発言行は「役職（氏名 君）発言内容」形式。
 * 複数行にまたがる発言内容も結合して処理する。
 */
export function parseStatements(text: string): ParsedStatement[] {
  // 全角数字を半角に変換して処理しやすくする
  const normalized = normalizeDigits(text);

  // 行分割して発言ブロックを検出
  const lines = normalized.split(/\n/);
  const blocks: string[] = [];
  let current = "";

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;

    if (isSpeakerLine(trimmed)) {
      if (current) {
        blocks.push(current.trim());
      }
      current = trimmed;
    } else {
      if (current) {
        current += " " + trimmed;
      }
      // current が空の場合（発言者なし）はスキップ
    }
  }
  if (current) {
    blocks.push(current.trim());
  }

  const statements: ParsedStatement[] = [];
  let offset = 0;

  for (const block of blocks) {
    const { speakerName, speakerRole, content } = parseSpeaker(block);
    if (!content || content.length < 3) continue;

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
      `[394033-ochi] PDF 取得失敗: ${pdfUrl}`,
      err instanceof Error ? err.message : err
    );
    return null;
  }
}

/**
 * PDF URL からファイル名部分を抜き出して externalId を生成する。
 * e.g., "/storage/files/gikai/gijiroku7.3-1.pdf" → "ochi_gijiroku7.3-1"
 */
function buildExternalId(pdfUrl: string): string | null {
  const match = pdfUrl.match(/\/([^/]+)\.pdf$/i);
  if (!match) return null;
  return `ochi_${match[1]}`;
}

/**
 * PDF をダウンロード・テキスト抽出し、MeetingData に変換する。
 */
export async function fetchMeetingData(
  meeting: OchiMeeting,
  municipalityId: string
): Promise<MeetingData | null> {
  const text = await fetchPdfText(meeting.pdfUrl);
  if (!text) return null;

  const statements = parseStatements(text);
  if (statements.length === 0) return null;

  const heldOn = parseMeetingDateFromText(text);
  if (!heldOn) return null;

  const titleFromText = parseMeetingTitleFromText(text);
  const title = titleFromText ?? meeting.linkText ?? "越知町議会 会議録";

  const externalId = buildExternalId(meeting.pdfUrl);

  // 会議種別の判定
  const meetingType = title.includes("臨時") ? "extraordinary" : "plenary";

  return {
    municipalityId,
    title,
    meetingType,
    heldOn,
    sourceUrl: meeting.pdfUrl,
    externalId,
    statements,
  };
}
