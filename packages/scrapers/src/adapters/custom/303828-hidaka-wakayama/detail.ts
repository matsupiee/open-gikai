/**
 * 日高町議会（和歌山県） — detail フェーズ
 *
 * 議会だより PDF から会期情報と一般質問の発言を抽出する。
 * 日高町の一般質問は「議員姓 / 町長 / 課長等」の話者見出しで掲載される。
 */

import { execFile } from "node:child_process";
import { createHash } from "node:crypto";
import { unlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";
import { extractPdfText } from "../../../utils/pdf";
import type { MeetingData, ParsedStatement } from "../../../utils/types";
import { detectMeetingType, fetchBinary, normalizeFullWidthDigits } from "./shared";

const execFileAsync = promisify(execFile);

const ROLE_SUFFIXES = [
  "企画まちづくり課長",
  "いきいき長寿課長",
  "産業建設課長",
  "上下水道課長",
  "総務課長",
  "教育課長",
  "副委員長",
  "委員長",
  "副議長",
  "議長",
  "副町長",
  "町長",
  "副教育長",
  "教育長",
  "事務局長",
  "副部長",
  "部長",
  "副課長",
  "課長",
  "次長",
  "局長",
  "室長",
  "係長",
  "参事",
  "主幹",
  "主査",
  "補佐",
  "議員",
] as const;

const ANSWER_ROLE_SUFFIXES = [
  "町長",
  "副町長",
  "教育長",
  "副教育長",
  "事務局長",
  "部長",
  "副部長",
  "課長",
  "副課長",
  "次長",
  "局長",
  "室長",
  "係長",
  "参事",
  "主幹",
  "主査",
  "補佐",
] as const;

const END_MARKERS = ["総務福祉常任委員会", "委員会レポート"];
const SECTION_MARKER = "【一般質問】";

function escapeRegExp(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function normalizeText(text: string): string {
  return normalizeFullWidthDigits(text)
    .replace(/\f/g, " ")
    .replace(/\r\n?/g, " ")
    .replace(/[ \t]+/g, " ")
    .trim();
}

function extractExternalIdKey(pdfUrl: string): string | null {
  const match = pdfUrl.match(/\/([^/]+)\.pdf$/i);
  return match?.[1] ?? null;
}

function toHeldOn(year: number, month: number, day: number): string {
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function convertJapaneseEraInText(era: string, eraYear: string): number | null {
  const year = eraYear === "元" ? 1 : Number(normalizeFullWidthDigits(eraYear));
  if (Number.isNaN(year)) return null;
  if (era === "令和") return year + 2018;
  if (era === "平成") return year + 1988;
  return null;
}

function extractLastSentence(text: string): string {
  const lastPunctuation = Math.max(text.lastIndexOf("。"), text.lastIndexOf("！"), text.lastIndexOf("？"));
  if (lastPunctuation >= 0) {
    return text.slice(0, lastPunctuation + 1).trim();
  }
  return text.trim();
}

function cleanBlockContent(text: string): string {
  let cleaned = normalizeText(text);

  for (const marker of [SECTION_MARKER, ...END_MARKERS]) {
    const markerIndex = cleaned.indexOf(marker);
    if (markerIndex >= 0) {
      cleaned = cleaned.slice(0, markerIndex).trim();
    }
  }

  cleaned = extractLastSentence(cleaned);
  return cleaned.replace(/[ \t]+/g, " ").trim();
}

function buildSpeakerTokens(questioners: string[]): string[] {
  const tokens = new Set<string>([...ROLE_SUFFIXES, ...questioners]);
  return [...tokens].sort((left, right) => right.length - left.length);
}

function splitGeneralQuestionSection(text: string): string {
  const startIndex = text.indexOf(SECTION_MARKER);
  const section = startIndex >= 0 ? text.slice(startIndex) : text;

  let endIndex = section.length;
  for (const marker of END_MARKERS) {
    const markerIndex = section.indexOf(marker);
    if (markerIndex >= 0) {
      endIndex = Math.min(endIndex, markerIndex);
    }
  }

  return section.slice(0, endIndex);
}

function isHeaderLikeQuestionBlock(content: string): boolean {
  return content.includes("議員") && !/[。！？]/.test(content.slice(0, 80));
}

function getSpeakerInfo(token: string, questioners: Set<string>): {
  speakerName: string | null;
  speakerRole: string | null;
} {
  if (questioners.has(token)) {
    return { speakerName: token, speakerRole: "議員" };
  }
  return { speakerName: null, speakerRole: token };
}

export function classifyKind(speakerRole: string | null): "remark" | "question" | "answer" {
  if (!speakerRole) return "remark";
  if (
    speakerRole === "議長" ||
    speakerRole === "副議長" ||
    speakerRole === "委員長" ||
    speakerRole === "副委員長"
  ) {
    return "remark";
  }

  for (const suffix of ANSWER_ROLE_SUFFIXES) {
    if (speakerRole === suffix || speakerRole.endsWith(suffix)) {
      return "answer";
    }
  }

  return "question";
}

export function extractQuestionerSurnames(rawText: string): string[] {
  const lines = rawText
    .replace(/\f/g, "\n")
    .split(/\r?\n/)
    .map((line) => normalizeFullWidthDigits(line).trim())
    .filter(Boolean);

  const results: string[] = [];
  const excluded = new Set(["議員", "町長", "副町長", "教育長", "議長", "副議長"]);

  for (let index = 0; index < lines.length; index++) {
    if (lines[index] !== "議員") continue;

    const previousLines = lines.slice(Math.max(0, index - 5), index);
    const candidates = previousLines.filter(
      (line) => /^[一-龯々]{1,6}$/u.test(line) && !excluded.has(line),
    );
    if (candidates.length === 0) continue;

    const surname = candidates[0]!;
    if (!results.includes(surname)) {
      results.push(surname);
    }
  }

  return results;
}

export function extractMeetingInfo(
  text: string,
  fallback: { title: string; publishYear: number; publishMonth: number },
): { title: string; heldOn: string } {
  const normalized = normalizeText(text);

  const titleMatch = normalized.match(/(令和|平成)(元|\d+)年第(\d+)回(定例会|臨時会)/);
  const sessionDateMatch = normalized.match(
    /(令和|平成)(元|\d+)年第\d+回(?:定例会|臨時会)は(\d+)月(\d+)日から/,
  );

  if (titleMatch && sessionDateMatch) {
    const westernYear = convertJapaneseEraInText(titleMatch[1]!, titleMatch[2]!);
    if (westernYear) {
      const month = Number(sessionDateMatch[3]);
      const day = Number(sessionDateMatch[4]);
      return {
        title: titleMatch[0],
        heldOn: toHeldOn(westernYear, month, day),
      };
    }
  }

  const publishDateMatch = normalized.match(/(令和|平成)(元|\d+)年(\d+)月(\d+)日/);
  if (publishDateMatch) {
    const westernYear = convertJapaneseEraInText(publishDateMatch[1]!, publishDateMatch[2]!);
    if (westernYear) {
      return {
        title: fallback.title,
        heldOn: toHeldOn(westernYear, Number(publishDateMatch[3]), Number(publishDateMatch[4])),
      };
    }
  }

  return {
    title: fallback.title,
    heldOn: toHeldOn(fallback.publishYear, fallback.publishMonth, 1),
  };
}

export function parseStatements(text: string, questioners: string[]): ParsedStatement[] {
  const normalized = normalizeText(splitGeneralQuestionSection(text));
  const questionerSet = new Set(questioners);
  const speakerTokens = buildSpeakerTokens(questioners);
  if (speakerTokens.length === 0) return [];

  const speakerPattern = speakerTokens.map(escapeRegExp).join("|");
  const regex = new RegExp(`(${speakerPattern})(?=\\s)`, "gu");
  const matches = [...normalized.matchAll(regex)];
  const statements: ParsedStatement[] = [];
  let offset = 0;

  for (let index = 0; index < matches.length; index++) {
    const match = matches[index]!;
    const speakerToken = match[1]!;
    const contentStart = (match.index ?? 0) + speakerToken.length;
    const contentEnd = index + 1 < matches.length ? (matches[index + 1]!.index ?? normalized.length) : normalized.length;
    const rawContent = normalized.slice(contentStart, contentEnd).trim();

    if (!rawContent) continue;
    if (questionerSet.has(speakerToken) && isHeaderLikeQuestionBlock(rawContent)) continue;

    const content = cleanBlockContent(rawContent);
    if (!content || content.length < 5) continue;
    if (!/[。！？]/.test(content) && content.length <= 30) continue;

    const { speakerName, speakerRole } = getSpeakerInfo(speakerToken, questionerSet);
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

async function extractPdfTextWithoutLayout(
  buffer: ArrayBuffer,
  pdfUrl: string,
): Promise<string | null> {
  const tmpPath = join(tmpdir(), `hidaka_wakayama_${Date.now()}.pdf`);

  try {
    await writeFile(tmpPath, Buffer.from(buffer));
    const { stdout } = await execFileAsync("pdftotext", [tmpPath, "-"], {
      maxBuffer: 25_000_000,
    });
    return stdout.trim().length > 0 ? stdout : null;
  } catch (err) {
    console.warn(
      `[303828-hidaka-wakayama] pdftotext failed: ${pdfUrl}`,
      err instanceof Error ? err.message : err,
    );
    return null;
  } finally {
    await unlink(tmpPath).catch(() => {});
  }
}

async function fetchPdfTexts(
  pdfUrl: string,
): Promise<{ text: string | null; rawText: string | null }> {
  const buffer = await fetchBinary(pdfUrl);
  if (!buffer) {
    return { text: null, rawText: null };
  }

  const [text, rawText] = await Promise.all([
    extractPdfText(buffer, {
      pdfUrl,
      strategy: ["unpdf", "pdftotext"],
      tempPrefix: "hidaka_wakayama",
    }),
    extractPdfTextWithoutLayout(buffer, pdfUrl),
  ]);

  return { text, rawText };
}

export async function fetchMeetingData(
  meeting: {
    pdfUrl: string;
    title: string;
    issueNumber: number;
    meetingYear: number;
    publishYear: number;
    publishMonth: number;
  },
  municipalityCode: string,
): Promise<MeetingData | null> {
  const { text, rawText } = await fetchPdfTexts(meeting.pdfUrl);
  const sourceText = text ?? rawText;
  if (!sourceText) return null;

  const questioners = rawText ? extractQuestionerSurnames(rawText) : [];
  const statements = parseStatements(sourceText, questioners);
  if (statements.length === 0) return null;

  const meetingInfo = extractMeetingInfo(sourceText, {
    title: meeting.title,
    publishYear: meeting.publishYear,
    publishMonth: meeting.publishMonth,
  });

  const externalIdKey = extractExternalIdKey(meeting.pdfUrl);
  const externalId = externalIdKey ? `hidaka_wakayama_${externalIdKey}` : null;

  return {
    municipalityCode,
    title: meetingInfo.title,
    meetingType: detectMeetingType(meetingInfo.title),
    heldOn: meetingInfo.heldOn,
    sourceUrl: meeting.pdfUrl,
    externalId,
    statements,
  };
}
