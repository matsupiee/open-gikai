/**
 * 有田町議会 会議録 -- detail フェーズ
 *
 * PDF をダウンロードしてテキストを抽出し、`〔...〕` 形式の発言者ヘッダーで
 * ParsedStatement 配列を生成する。
 *
 * 発言フォーマット:
 *   〔今泉藤一郎議長〕再開します。
 *   〔３番 久保田豊君〕皆さんこんにちは。
 *   〔堀江商工観光課長〕お答えいたします。
 */

import { createHash } from "node:crypto";
import type { MeetingData, ParsedStatement } from "../../../utils/types";
import type { AritaMeeting } from "./list";
import { fetchBinary } from "./shared";

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
  "会計管理者",
  "事務局次長",
  "事務局長",
  "副部長",
  "部長",
  "副課長",
  "課長",
  "室長",
  "局長",
  "係長",
  "次長",
  "参事",
  "主幹",
  "主査",
  "補佐",
  "理事",
  "技監",
  "政策監",
  "議員",
  "委員",
];

// 行政側の役職（答弁者として分類する）
const ANSWER_ROLES = new Set([
  "町長",
  "副町長",
  "教育長",
  "副教育長",
  "会計管理者",
  "事務局長",
  "事務局次長",
  "部長",
  "副部長",
  "課長",
  "副課長",
  "室長",
  "局長",
  "係長",
  "次長",
  "参事",
  "主幹",
  "主査",
  "補佐",
  "理事",
  "技監",
  "政策監",
]);

function stripPageNoise(text: string): string {
  return text
    .split(/\r?\n/)
    .filter((line) => {
      const trimmed = line.trim();
      if (!trimmed) return true;
      if (/^\d+$/.test(trimmed)) return false;
      if (/^[−ー\-]\d+[−ー\-]$/.test(trimmed)) return false;
      return true;
    })
    .join("\n");
}

function normalizeContent(content: string): string {
  return content
    .replace(
      /(?<=[。！？」』）])\s+[0-9０-９]+\s+(?=[ぁ-んァ-ヶ一-龯])/g,
      " "
    )
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * `〔...〕` 形式の発言ヘッダーから発言者情報を抽出する。
 *
 * 対応パターン:
 *   〔今泉藤一郎議長〕再開します。       → role=議長, name=今泉藤一郎
 *   〔３番 久保田豊君〕こんにちは。      → role=議員, name=久保田豊
 *   〔堀江商工観光課長〕お答えします。   → role=課長, name=堀江商工観光
 */
export function parseSpeaker(text: string): {
  speakerName: string | null;
  speakerRole: string | null;
  content: string;
} {
  const match = text.match(/^〔([^〕]+)〕\s*([\s\S]*)$/);
  if (!match) {
    return { speakerName: null, speakerRole: null, content: text.trim() };
  }

  const header = match[1]!.replace(/　/g, " ").trim();
  const content = match[2]!.trim();
  const compactHeader = header.replace(/\s+/g, "");

  const memberMatch = compactHeader.match(/^([\d０-９]+)番(.+?)(?:君|様|議員)$/);
  if (memberMatch) {
    return {
      speakerName: memberMatch[2]!.replace(/\s+/g, ""),
      speakerRole: "議員",
      content,
    };
  }

  for (const suffix of ROLE_SUFFIXES) {
    if (compactHeader === suffix || compactHeader.endsWith(suffix)) {
      const speakerName =
        compactHeader.length > suffix.length
          ? compactHeader.slice(0, -suffix.length)
          : null;
      return {
        speakerName,
        speakerRole: suffix,
        content,
      };
    }
  }

  return {
    speakerName: compactHeader || null,
    speakerRole: null,
    content,
  };
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
  ) {
    return "remark";
  }
  for (const role of ANSWER_ROLES) {
    if (speakerRole.endsWith(role)) return "answer";
  }
  return "question";
}

/**
 * PDF から抽出したテキストを ParsedStatement 配列に変換する。
 */
export function parseStatements(rawText: string): ParsedStatement[] {
  const cleaned = stripPageNoise(rawText);
  const headerMatches = [...cleaned.matchAll(/〔[^〕]{1,40}〕/g)];
  if (headerMatches.length === 0) return [];

  const statements: ParsedStatement[] = [];
  let offset = 0;

  for (let i = 0; i < headerMatches.length; i++) {
    const current = headerMatches[i]!;
    const nextIndex =
      i + 1 < headerMatches.length ? headerMatches[i + 1]!.index! : cleaned.length;

    const block = cleaned.slice(current.index!, nextIndex).trim();
    if (!block) continue;

    if (/^〔[^〕]*(?:登壇|退席|退場|着席|拍手|一同)[^〕]*〕$/.test(block)) {
      continue;
    }

    const normalized = block.replace(/\s+/g, " ");
    const { speakerName, speakerRole, content } = parseSpeaker(normalized);
    if (!content) continue;
    if (!speakerName && !speakerRole) continue;

    const normalizedContent = normalizeContent(content);
    if (!normalizedContent) continue;

    const contentHash = createHash("sha256")
      .update(normalizedContent)
      .digest("hex");
    const startOffset = offset;
    const endOffset = offset + normalizedContent.length;

    statements.push({
      kind: classifyKind(speakerRole),
      speakerName,
      speakerRole,
      content: normalizedContent,
      contentHash,
      startOffset,
      endOffset,
    });

    offset = endOffset + 1;
  }

  return statements;
}

async function fetchPdfText(pdfUrl: string): Promise<string | null> {
  try {
    const buffer = await fetchBinary(pdfUrl);
    if (!buffer) return null;

    const { extractText, getDocumentProxy } = await import("../../../utils/pdf");
    const pdf = await getDocumentProxy(new Uint8Array(buffer));
    const { text } = await extractText(pdf, { mergePages: true });
    return text;
  } catch (err) {
    console.warn(
      `[414018-arita] PDF 取得失敗: ${pdfUrl}`,
      err instanceof Error ? err.message : err
    );
    return null;
  }
}

/**
 * PDF をダウンロード・テキスト抽出し、MeetingData に変換する。
 */
export async function fetchMeetingData(
  meeting: AritaMeeting,
  municipalityCode: string
): Promise<MeetingData | null> {
  const text = await fetchPdfText(meeting.pdfUrl);
  if (!text) return null;

  const statements = parseStatements(text);
  if (statements.length === 0) return null;

  const filename =
    new URL(meeting.pdfUrl).pathname.split("/").pop()?.replace(/\.pdf$/i, "") ?? null;
  const externalId = filename ? `arita_${filename}` : null;

  return {
    municipalityCode,
    title: meeting.title,
    meetingType: meeting.meetingType,
    heldOn: meeting.heldOn,
    sourceUrl: meeting.pdfUrl,
    externalId,
    statements,
  };
}
