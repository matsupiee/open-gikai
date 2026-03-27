/**
 * 厚沢部町議会（北海道） — detail フェーズ
 *
 * PDF をページごとにテキスト抽出し、先頭の役職ラベルで発言を区切って
 * ParsedStatement 配列を生成する。
 */

import { createHash } from "node:crypto";
import { extractText, getDocumentProxy } from "../../../utils/pdf";
import type { MeetingData, ParsedStatement } from "../../../utils/types";
import { fetchBinary, toHalfWidth } from "./shared";

export interface AssabuDetailParams {
  title: string;
  heldOn: string | null;
  pdfUrl: string;
  sourceUrl: string;
  meetingType: "plenary" | "extraordinary" | "committee";
  pageId: string;
}

const ANSWER_ROLES = new Set([
  "町長",
  "副町長",
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
]);

const EXACT_ROLE_PREFIXES = [
  "議会運営副委員長",
  "議会運営委員長",
  "総務文教常任委員長",
  "産業厚生常任委員長",
  "予算審議特別委員長",
  "決算審査特別委員長",
  "副委員長",
  "委員長",
  "副議長",
  "副町長",
  "教育長",
  "事務局長",
  "議長",
  "町長",
  "局長",
] as const;

function normalizeLine(rawLine: string): string {
  return toHalfWidth(rawLine).replace(/[\s　]+/g, "");
}

function isSkippableLine(line: string): boolean {
  return (
    line.length === 0 ||
    /^－\d+－$/.test(line) ||
    /^発言者議事$/.test(line) ||
    /^〔\d+月\d+日〕$/.test(line)
  );
}

export function classifyKind(
  speakerRole: string | null,
): "remark" | "question" | "answer" {
  if (!speakerRole) return "remark";
  if (
    speakerRole === "議長" ||
    speakerRole === "副議長" ||
    speakerRole.endsWith("委員長") ||
    speakerRole.endsWith("副委員長")
  ) {
    return "remark";
  }
  if (ANSWER_ROLES.has(speakerRole)) return "answer";
  for (const role of ANSWER_ROLES) {
    if (speakerRole.endsWith(role)) return "answer";
  }
  return "question";
}

/**
 * 行頭の発言者ラベルを抽出する。
 *
 * 例:
 * - "議長皆さん、おはようございます。" → role=議長
 * - "浜塚議員それでは..." → name=浜塚, role=議員
 * - "農林課長まず、..." → role=農林課長
 * - "議会運営副委員長去る12月5日..." → role=議会運営副委員長
 */
export function parseSpeakerLine(line: string): {
  speakerName: string | null;
  speakerRole: string | null;
  content: string;
} | null {
  const normalized = normalizeLine(line);
  if (isSkippableLine(normalized)) return null;

  const memberMatch = normalized.match(/^([一-龠々ヶヵ]{1,6})議員([\s\S]+)$/u);
  if (memberMatch?.[1] && memberMatch[2]) {
    return {
      speakerName: memberMatch[1],
      speakerRole: "議員",
      content: memberMatch[2],
    };
  }

  for (const role of EXACT_ROLE_PREFIXES) {
    if (!normalized.startsWith(role)) continue;
    const content = normalized.slice(role.length);
    if (!content) continue;
    return {
      speakerName: null,
      speakerRole: role,
      content,
    };
  }

  const committeeRoleMatch = normalized.match(
    /^([一-龠々ヶヵ]{1,12}(?:副委員長|委員長))([\s\S]+)$/u,
  );
  if (committeeRoleMatch?.[1] && committeeRoleMatch[2]) {
    return {
      speakerName: null,
      speakerRole: committeeRoleMatch[1],
      content: committeeRoleMatch[2],
    };
  }

  const departmentRoleMatch = normalized.match(
    /^([一-龠々ヶヵ]{1,10}(?:副部長|部長|副課長|課長|室長|局長|係長|参事|主幹|主査|補佐))([\s\S]+)$/u,
  );
  if (departmentRoleMatch?.[1] && departmentRoleMatch[2]) {
    return {
      speakerName: null,
      speakerRole: departmentRoleMatch[1],
      content: departmentRoleMatch[2],
    };
  }

  return null;
}

export function parseStatements(pages: string[]): ParsedStatement[] {
  const statements: ParsedStatement[] = [];
  let currentSpeakerName: string | null = null;
  let currentSpeakerRole: string | null = null;
  let currentContentParts: string[] = [];
  let hasSpeaker = false;
  let offset = 0;

  const flushStatement = () => {
    if (!hasSpeaker) return;
    const content = currentContentParts.join("").trim();
    if (!content) return;

    const contentHash = createHash("sha256").update(content).digest("hex");
    const startOffset = offset;
    const endOffset = offset + content.length;

    statements.push({
      kind: classifyKind(currentSpeakerRole),
      speakerName: currentSpeakerName,
      speakerRole: currentSpeakerRole,
      content,
      contentHash,
      startOffset,
      endOffset,
    });

    offset = endOffset + 1;
    currentContentParts = [];
  };

  for (const page of pages) {
    for (const rawLine of page.split("\n")) {
      const normalized = normalizeLine(rawLine);
      if (isSkippableLine(normalized)) continue;

      const speaker = parseSpeakerLine(rawLine);
      if (speaker) {
        flushStatement();
        hasSpeaker = true;
        currentSpeakerName = speaker.speakerName;
        currentSpeakerRole = speaker.speakerRole;
        currentContentParts = [speaker.content];
        continue;
      }

      if (hasSpeaker) {
        currentContentParts.push(normalized);
      }
    }
  }

  flushStatement();
  return statements;
}

async function fetchPdfPages(pdfUrl: string): Promise<string[] | null> {
  try {
    const buffer = await fetchBinary(pdfUrl);
    if (!buffer) return null;

    const pdf = await getDocumentProxy(new Uint8Array(buffer));
    const { text } = await extractText(pdf, { mergePages: false });
    return text as unknown as string[];
  } catch (err) {
    console.warn(
      `[013633-assabu] PDF 取得失敗: ${pdfUrl}`,
      err instanceof Error ? err.message : err,
    );
    return null;
  }
}

export async function buildMeetingData(
  params: AssabuDetailParams,
  municipalityCode: string,
): Promise<MeetingData | null> {
  if (!params.heldOn) return null;

  const pages = await fetchPdfPages(params.pdfUrl);
  if (!pages) return null;

  const statements = parseStatements(pages);
  if (statements.length === 0) return null;

  const pdfId = params.pdfUrl.match(/\/([^/]+)\.pdf$/i)?.[1] ?? params.pageId;

  return {
    municipalityCode,
    title: params.title,
    meetingType: params.meetingType,
    heldOn: params.heldOn,
    sourceUrl: params.pdfUrl,
    externalId: `assabu_${pdfId}`,
    statements,
  };
}
