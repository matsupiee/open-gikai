import { createHash } from "node:crypto";
import { extractPdfText } from "../../../utils/pdf";
import type { MeetingData, ParsedStatement } from "../../../utils/types";
import type { HigashikushiraMeeting } from "./list";
import { fetchBinary, toHalfWidth } from "./shared";

const ROLE_SUFFIXES = [
  "議会運営委員長",
  "議会事務局長",
  "副委員長",
  "委員長",
  "副議長",
  "議長",
  "副町長",
  "町長",
  "副教育長",
  "教育長",
  "会計管理者",
  "事務局長",
  "課長補佐",
  "副課長",
  "課長",
  "副部長",
  "部長",
  "室長",
  "局長",
  "次長",
  "参事",
  "主幹",
  "主査",
  "補佐",
  "書記",
  "議員",
  "委員",
];

const ANSWER_ROLES = new Set([
  "町長",
  "副町長",
  "教育長",
  "副教育長",
  "会計管理者",
  "部長",
  "副部長",
  "課長",
  "副課長",
  "課長補佐",
  "室長",
  "局長",
  "次長",
  "参事",
  "主幹",
  "主査",
  "補佐",
]);

const REMARK_ROLES = new Set([
  "議長",
  "副議長",
  "委員長",
  "副委員長",
  "議会運営委員長",
  "議会事務局長",
  "事務局長",
  "書記",
]);

function normalizeSpeakerToken(text: string): string {
  return toHalfWidth(text).replace(/[ \t\u3000]+/g, "");
}

function normalizeContentLine(text: string): string {
  return toHalfWidth(text).replace(/[ \t\u3000]+/g, " ").trim();
}

function isLikelySpeakerRole(rolePart: string): boolean {
  if (rolePart.startsWith("会議録署名議員")) return false;
  if (/^\d+番$/.test(rolePart)) return true;

  return (
    ROLE_SUFFIXES.some((suffix) => rolePart === suffix || rolePart.endsWith(suffix)) ||
    /(?:議長|町長|教育長|会計管理者|事務局長|課長|部長|局長|次長|参事|主幹|主査|補佐|書記|議員)$/.test(
      rolePart,
    )
  );
}

/**
 * 話者ヘッダーをパースする。
 *
 * 例:
 *   議 長（田之畑）
 *   ２ 番（小 川） 質問します。
 *   議会事務局長（浜 屋） 御起立ください。
 */
export function parseSpeaker(text: string): {
  speakerName: string | null;
  speakerRole: string | null;
  content: string;
} {
  const normalized = text.replace(/^[○◯〇◎●]\s*/, "").trim();
  const compact = normalizeSpeakerToken(normalized);
  const match = compact.match(/^(.+?)[（(]([^()（）]+)[）)]\s*([\s\S]*)$/);
  if (!match) {
    return {
      speakerName: null,
      speakerRole: null,
      content: normalizeContentLine(normalized),
    };
  }

  const rolePart = match[1]!;
  const speakerName = match[2]!;
  const content = normalizeContentLine(match[3]!);

  if (!isLikelySpeakerRole(rolePart)) {
    return {
      speakerName: null,
      speakerRole: null,
      content: normalizeContentLine(normalized),
    };
  }

  if (/^\d+番$/.test(rolePart)) {
    return { speakerName, speakerRole: "議員", content };
  }

  for (const suffix of ROLE_SUFFIXES) {
    if (rolePart === suffix || rolePart.endsWith(suffix)) {
      return { speakerName, speakerRole: suffix, content };
    }
  }

  return { speakerName, speakerRole: rolePart, content };
}

/** 役職から発言種別を分類する */
export function classifyKind(
  speakerRole: string | null,
): "remark" | "question" | "answer" {
  if (!speakerRole) return "remark";
  if (REMARK_ROLES.has(speakerRole)) return "remark";
  if (ANSWER_ROLES.has(speakerRole)) return "answer";

  for (const role of ANSWER_ROLES) {
    if (speakerRole.endsWith(role)) return "answer";
  }

  if (
    speakerRole.endsWith("議長") ||
    speakerRole.endsWith("委員長") ||
    speakerRole.endsWith("事務局長") ||
    speakerRole.endsWith("書記")
  ) {
    return "remark";
  }

  return "question";
}

function shouldSkipLine(line: string): boolean {
  const compact = normalizeSpeakerToken(line);
  if (!compact) return true;

  return (
    /^-?\d+-?$/.test(compact) ||
    /^[〜~]+$/.test(compact) ||
    /^◆日程第/.test(compact) ||
    /^議事日程$/.test(compact) ||
    /^会議に付した事件/.test(compact) ||
    /^会議の経過$/.test(compact) ||
    /^出席議員/.test(compact) ||
    /^欠席議員/.test(compact) ||
    /^会議録署名議員/.test(compact) ||
    /^地方自治法第121条の規定による出席者は次のとおりである。?$/.test(
      compact,
    ) ||
    /^職務のため出席した者の職・氏名$/.test(compact) ||
    /^開会午前/.test(compact) ||
    /^閉会午前/.test(compact) ||
    /^散会午前/.test(compact) ||
    /^開会令和/.test(compact) ||
    /^閉会令和/.test(compact) ||
    /^散会令和/.test(compact) ||
    /^（.*）$/.test(line.trim())
  );
}

function detectSpeakerLine(text: string): {
  speakerName: string | null;
  speakerRole: string | null;
  content: string;
} | null {
  const compact = normalizeSpeakerToken(text.replace(/^[○◯〇◎●]\s*/, "").trim());
  if (!/^.+[（(][^()（）]+[）)]/.test(compact)) return null;

  const parsed = parseSpeaker(text);
  if (!parsed.speakerRole) return null;
  return parsed;
}

/**
 * PDF テキストから発言配列を抽出する。
 *
 * 話者ヘッダー行を起点に、次の話者ヘッダーまでを 1 発言としてまとめる。
 */
export function parseStatements(text: string): ParsedStatement[] {
  const lines = text.replace(/\r/g, "\n").replace(/\f/g, "\n").split("\n");
  const statements: ParsedStatement[] = [];
  let offset = 0;
  let current:
    | {
        speakerName: string | null;
        speakerRole: string | null;
        contentLines: string[];
      }
    | null = null;

  const flush = () => {
    if (!current) return;

    const content = current.contentLines.join(" ").replace(/\s+/g, " ").trim();
    const statement = current;
    current = null;
    if (!content) return;

    const contentHash = createHash("sha256").update(content).digest("hex");
    const startOffset = offset;
    const endOffset = offset + content.length;

    statements.push({
      kind: classifyKind(statement.speakerRole),
      speakerName: statement.speakerName,
      speakerRole: statement.speakerRole,
      content,
      contentHash,
      startOffset,
      endOffset,
    });

    offset = endOffset + 1;
  };

  for (const rawLine of lines) {
    const trimmed = rawLine.trim();
    if (!trimmed) continue;
    if (shouldSkipLine(trimmed)) continue;

    const speaker = detectSpeakerLine(trimmed);
    if (speaker) {
      flush();
      current = {
        speakerName: speaker.speakerName,
        speakerRole: speaker.speakerRole,
        contentLines: speaker.content ? [speaker.content] : [],
      };
      continue;
    }

    if (!current) continue;

    const contentLine = normalizeContentLine(trimmed);
    if (!contentLine) continue;
    current.contentLines.push(contentLine);
  }

  flush();
  return statements;
}

async function fetchPdfText(pdfUrl: string): Promise<string | null> {
  const buffer = await fetchBinary(pdfUrl);
  if (!buffer) return null;

  return extractPdfText(buffer, {
    pdfUrl,
    strategy: ["pdftotext", "unpdf"],
    tempPrefix: "higashikushira",
  });
}

/** PDF をダウンロード・解析して MeetingData に変換する */
export async function fetchMeetingData(
  meeting: HigashikushiraMeeting,
  municipalityCode: string,
): Promise<MeetingData | null> {
  if (!meeting.heldOn) return null;

  const text = await fetchPdfText(meeting.pdfUrl);
  if (!text) return null;

  const statements = parseStatements(text);
  if (statements.length === 0) return null;

  const fileName =
    new URL(meeting.pdfUrl).pathname.split("/").pop()?.replace(/\.pdf$/i, "") ?? null;

  return {
    municipalityCode,
    title: meeting.title,
    meetingType: meeting.meetingType,
    heldOn: meeting.heldOn,
    sourceUrl: meeting.pdfUrl,
    externalId: fileName ? `higashikushira_${fileName}` : null,
    statements,
  };
}
