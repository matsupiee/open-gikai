/**
 * 勝浦町議会 会議録 -- detail フェーズ
 *
 * PDF をダウンロードしてテキストを抽出し、
 * ○ マーカー付きの発言を ParsedStatement 配列に変換する。
 */

import { createHash } from "node:crypto";
import { extractText, getDocumentProxy } from "../../../utils/pdf";
import type { MeetingData, ParsedStatement } from "../../../utils/types";
import type { KatsuuraMeeting } from "./list";
import {
  collapseWhitespace,
  detectMeetingType,
  extractExternalIdKey,
  fetchBinary,
  toHalfWidth,
} from "./shared";

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
  "政策監",
  "会計管理者",
  "事務局長",
  "課長補佐",
  "副課長",
  "課長",
  "所長",
  "参事",
  "主幹",
  "主査",
  "補佐",
  "議員",
  "委員",
];

const ANSWER_ROLE_SUFFIXES = [
  "町長",
  "副町長",
  "副教育長",
  "教育長",
  "教育次長",
  "政策監",
  "会計管理者",
  "事務局長",
  "課長補佐",
  "副課長",
  "課長",
  "所長",
  "参事",
  "主幹",
  "主査",
  "補佐",
];

function normalizeContent(text: string): string {
  return collapseWhitespace(text.replace(/-\s*\d+\s*-/g, " "));
}

function trimMarker(text: string): string {
  return text.replace(/^[○◯〇]\s*/, "");
}

function extractTranscriptBody(text: string): string {
  const match = text.match(
    /(?:午前|午後)\s*[0-9０-９]+\s*時\s*[0-9０-９]+\s*分\s*開議/,
  );
  if (!match || match.index === undefined) return text;
  return text.slice(match.index);
}

function looksLikeSpeakerBlock(text: string): boolean {
  const normalized = normalizeContent(text);
  if (!/^[○◯〇]/.test(normalized)) return false;
  if (
    /^[○◯〇]\s*(?:出席議員|欠席議員|会議録署名議員|地方自治法|職務のため|議事日程|本日の会議|会議の経過)/.test(
      normalized,
    )
  ) {
    return false;
  }
  return /^[○◯〇]\s*.+?[（(].+?(?:君|様|議員)[）)]/.test(normalized);
}

/** PDF 冒頭から正式タイトルを抜き出す */
export function extractMeetingTitleFromText(text: string): string | null {
  const head = normalizeContent(text.slice(0, 800)).replace(/^-\s*\d+\s*-\s*/, "");
  const match = head.match(/^(.*?)\s+1\s+招集年月日/);
  return match ? match[1]!.trim() : null;
}

/** PDF 本文から開催日を抽出する */
export function parseHeldOnFromText(text: string): string | null {
  const normalized = normalizeContent(text).replace(/\s+/g, "");
  const match = normalized.match(/令和(元|\d+)年(\d{1,2})月(\d{1,2})日/);
  if (!match) return null;

  const eraYear = match[1] === "元" ? 1 : Number(match[1]);
  const year = 2018 + eraYear;
  const month = Number(match[2]);
  const day = Number(match[3]);

  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

/** 発言ブロックから話者情報を抽出する */
export function parseSpeaker(text: string): {
  speakerName: string | null;
  speakerRole: string | null;
  content: string;
} {
  const stripped = trimMarker(text);
  const match = stripped.match(/^(.+?)[（(](.+?)(?:君|様|議員)[）)]\s*([\s\S]*)/);
  if (match) {
    const rolePart = normalizeContent(match[1] ?? "");
    const rawName = (match[2] ?? "").replace(/[\s　]+/g, "").trim();
    const content = normalizeContent(match[3] ?? "");

    if (/^\d+番$/.test(toHalfWidth(rolePart))) {
      return { speakerName: rawName, speakerRole: "議員", content };
    }

    for (const suffix of ROLE_SUFFIXES) {
      if (rolePart === suffix || rolePart.endsWith(suffix)) {
        return { speakerName: rawName, speakerRole: suffix, content };
      }
    }

    return {
      speakerName: rawName || null,
      speakerRole: rolePart || null,
      content,
    };
  }

  return {
    speakerName: null,
    speakerRole: null,
    content: normalizeContent(stripped),
  };
}

/** 役職から発言種別を判定する */
export function classifyKind(
  speakerRole: string | null,
): "remark" | "question" | "answer" {
  if (!speakerRole) return "remark";
  if (
    speakerRole === "議長" ||
    speakerRole === "副議長" ||
    speakerRole.endsWith("委員長")
  ) {
    return "remark";
  }
  if (ANSWER_ROLE_SUFFIXES.some((suffix) => speakerRole === suffix || speakerRole.endsWith(suffix))) {
    return "answer";
  }
  return "question";
}

/** PDF テキストから発言一覧を抽出する */
export function parseStatements(text: string): ParsedStatement[] {
  const body = extractTranscriptBody(text);
  const blocks = body.split(/(?=[○◯〇])/);
  const statements: ParsedStatement[] = [];
  let offset = 0;

  for (const block of blocks) {
    if (!looksLikeSpeakerBlock(block)) continue;

    const normalized = normalizeContent(block);
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

async function fetchPdfText(pdfUrl: string): Promise<string | null> {
  try {
    const buffer = await fetchBinary(pdfUrl);
    if (!buffer) return null;

    const pdf = await getDocumentProxy(new Uint8Array(buffer));
    const { text } = await extractText(pdf, { mergePages: true });
    return text;
  } catch (error) {
    console.warn(
      `[363014-katsuura] PDF 取得失敗: ${pdfUrl}`,
      error instanceof Error ? error.message : error,
    );
    return null;
  }
}

/** PDF から MeetingData を構築する */
export async function fetchMeetingData(
  meeting: KatsuuraMeeting,
  municipalityCode: string,
): Promise<MeetingData | null> {
  const text = await fetchPdfText(meeting.pdfUrl);
  if (!text) return null;

  const heldOn = parseHeldOnFromText(text);
  if (!heldOn) return null;

  const statements = parseStatements(text);
  if (statements.length === 0) return null;

  const title = extractMeetingTitleFromText(text) ?? meeting.title;
  const externalIdKey = extractExternalIdKey(meeting.pdfUrl);

  return {
    municipalityCode,
    title,
    meetingType: detectMeetingType(title),
    heldOn,
    sourceUrl: meeting.pdfUrl,
    externalId: externalIdKey ? `katsuura_${externalIdKey}` : null,
    statements,
  };
}
