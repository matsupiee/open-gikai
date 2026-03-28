/**
 * 日高村議会 議会だより — detail フェーズ
 *
 * PDF をダウンロードしてテキストを抽出し、
 * 「質問」「答弁」ブロックを ParsedStatement に変換する。
 */

import { execFile } from "node:child_process";
import { createHash } from "node:crypto";
import { writeFile, unlink } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";
import type { MeetingData, ParsedStatement } from "../../../utils/types";
import type { HidakaKochiIssue } from "./list";
import {
  detectMeetingType,
  eraToWesternYear,
  fetchBinary,
  normalizeDigits,
} from "./shared";

const execFileAsync = promisify(execFile);
const PDFTEXT_MAX_BUFFER = 25_000_000;

const ANSWER_ROLE_KEYWORDS = [
  "副村長",
  "村長",
  "副教育長",
  "教育長",
  "総務課長兼産業環境課参事",
  "総務課参事",
  "総務課長",
  "健康福祉課長",
  "建設課長",
  "企画課長",
  "教育次長",
  "課長",
  "参事",
  "次長",
];

const SORTED_ANSWER_ROLE_KEYWORDS = [...ANSWER_ROLE_KEYWORDS].sort(
  (a, b) => b.length - a.length
);

function normalizePdfText(text: string): string {
  return normalizeDigits(text)
    .replace(/\r/g, "")
    .replace(/[︵﹁﹂]/g, " ")
    .replace(/[﹃﹄]/g, " ")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n");
}

function isNoiseLine(line: string): boolean {
  const trimmed = line.trim();
  if (!trimmed) return true;

  return (
    /^第\s*\d+号$/.test(trimmed) ||
    /^日高村議会だより$/.test(trimmed) ||
    /^令和\d+年\d+月\d+日/.test(trimmed) ||
    /^一般質問に\d+氏が立つ$/.test(trimmed) ||
    /^一\s*般\s*質\s*問$/.test(trimmed) ||
    /^（\d+）/.test(trimmed) ||
    /^\(\d+\)$/.test(trimmed) ||
    /^[●○◯]+[:：]/.test(trimmed) ||
    /^[0-9]+$/.test(trimmed)
  );
}

function normalizeRole(roleText: string): string | null {
  const compact = roleText.replace(/\s+/g, "");
  for (const keyword of SORTED_ANSWER_ROLE_KEYWORDS) {
    if (compact.includes(keyword)) return keyword;
  }
  return compact || null;
}

function extractMeetingTitle(text: string, fallbackTitle: string): string {
  const normalized = normalizePdfText(text).replace(/\n/g, " ");
  const match = normalized.match(
    /((?:令和|平成)(?:元|\d+)年第\s*\d+回(?:定例会|臨時会))/
  );
  if (match) return match[1]!.replace(/\s+/g, "");
  return fallbackTitle;
}

function extractHeldOn(text: string, fallbackHeldOn: string): string {
  const normalized = normalizePdfText(text).slice(0, 8_000);

  const fullDate = normalized.match(/(令和|平成)(元|\d+)年(\d+)月(\d+)日/);
  if (fullDate) {
    const year = eraToWesternYear(fullDate[1]!, fullDate[2]!);
    if (year) {
      return `${year}-${String(Number(fullDate[3])).padStart(2, "0")}-${String(
        Number(fullDate[4])
      ).padStart(2, "0")}`;
    }
  }

  const rangeDate = normalized.match(/[RＲ](\d{1,2})[.．](\d{1,2})[.．](\d{1,2})\s*[〜～-]/);
  if (rangeDate) {
    const year = Number(rangeDate[1]) + 2018;
    return `${year}-${String(Number(rangeDate[2])).padStart(2, "0")}-${String(
      Number(rangeDate[3])
    ).padStart(2, "0")}`;
  }

  return fallbackHeldOn;
}

function buildStatement(
  kind: "question" | "answer",
  speakerName: string | null,
  speakerRole: string | null,
  content: string,
  offset: number
): ParsedStatement | null {
  const normalizedContent = content.replace(/\s+/g, " ").trim();
  if (!normalizedContent) return null;

  const contentHash = createHash("sha256")
    .update(normalizedContent)
    .digest("hex");

  return {
    kind,
    speakerName,
    speakerRole,
    content: normalizedContent,
    contentHash,
    startOffset: offset,
    endOffset: offset + normalizedContent.length,
  };
}

export function parseStatements(text: string): ParsedStatement[] {
  const normalized = normalizePdfText(text);
  const lines = normalized.split("\n");
  const statements: ParsedStatement[] = [];

  let currentKind: "question" | "answer" | null = null;
  let currentSpeakerName: string | null = null;
  let currentSpeakerRole: string | null = null;
  let currentLines: string[] = [];
  let questionSpeakerName: string | null = null;
  let offset = 0;

  const flush = () => {
    if (!currentKind) return;
    const statement = buildStatement(
      currentKind,
      currentSpeakerName,
      currentSpeakerRole,
      currentLines.join(" "),
      offset
    );
    currentKind = null;
    currentSpeakerName = null;
    currentSpeakerRole = null;
    currentLines = [];

    if (!statement) return;
    statements.push(statement);
    offset = statement.endOffset + 1;
  };

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (isNoiseLine(line)) continue;

    const speakerMatch = line.match(/^([^\s　]{1,20})議員$/);
    if (speakerMatch) {
      questionSpeakerName = speakerMatch[1]!;
      continue;
    }

    const questionMatch = line.match(/^質\s*問\s*(.*)$/);
    if (questionMatch) {
      flush();
      currentKind = "question";
      currentSpeakerName = questionSpeakerName;
      currentSpeakerRole = "議員";
      if (questionMatch[1]) currentLines.push(questionMatch[1]!);
      continue;
    }

    const answerMatch = line.match(/^答\s*弁\s*(.*)$/);
    if (answerMatch) {
      flush();
      currentKind = "answer";
      currentSpeakerName = null;
      currentSpeakerRole = normalizeRole(answerMatch[1]!);
      continue;
    }

    if (currentKind) {
      currentLines.push(line);
    }
  }

  flush();
  return statements;
}

async function fetchPdfText(pdfUrl: string): Promise<string | null> {
  const buffer = await fetchBinary(pdfUrl);
  if (!buffer) return null;

  const tmpPath = join(tmpdir(), `hidaka_kochi_${Date.now()}.pdf`);

  try {
    await writeFile(tmpPath, Buffer.from(buffer));
    const { stdout } = await execFileAsync("pdftotext", [tmpPath, "-"], {
      maxBuffer: PDFTEXT_MAX_BUFFER,
    });
    return stdout.trim().length > 0 ? stdout : null;
  } catch (error) {
    console.warn(
      `[394106-hidaka-kochi] pdftotext failed: ${pdfUrl}`,
      error instanceof Error ? error.message : error
    );
    return null;
  } finally {
    await unlink(tmpPath).catch(() => {});
  }
}

function extractExternalIdKey(pdfUrl: string): string | null {
  const match = pdfUrl.match(/\/([^/]+)\.pdf$/i);
  return match?.[1] ?? null;
}

export async function fetchMeetingData(
  meeting: HidakaKochiIssue,
  municipalityCode: string
): Promise<MeetingData | null> {
  const text = await fetchPdfText(meeting.pdfUrl);
  if (!text) return null;

  const statements = parseStatements(text);
  if (statements.length === 0) return null;

  const title = extractMeetingTitle(text, meeting.title);
  const heldOn = extractHeldOn(text, meeting.heldOn);
  const idKey = extractExternalIdKey(meeting.pdfUrl);

  return {
    municipalityCode,
    title,
    meetingType: detectMeetingType(title),
    heldOn,
    sourceUrl: meeting.pdfUrl,
    externalId: idKey ? `hidaka-kochi_${idKey}` : null,
    statements,
  };
}
