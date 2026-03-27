/**
 * 奄美市議会 会議録 — detail フェーズ
 *
 * PDF をダウンロードしてテキストを抽出し、
 * 発言者行を検出して ParsedStatement 配列を構築する。
 *
 * 奄美市の PDF は新旧で抽出品質が異なるため、
 * `pdftotext -layout` を優先し、失敗時は unpdf をフォールバックに使う。
 */

import { execFile } from "node:child_process";
import { createHash } from "node:crypto";
import { unlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";
import { extractText, getDocumentProxy } from "../../../utils/pdf";
import type { MeetingData, ParsedStatement } from "../../../utils/types";
import type { AmamiMeeting } from "./list";
import {
  deSpacePdfText,
  delay,
  detectMeetingType,
  extractWesternYear,
  fetchBinary,
  normalizeFullWidth,
} from "./shared";

const execFileAsync = promisify(execFile);
const PDFTEXT_MAX_BUFFER = 25_000_000;

// 役職サフィックス（長い方を先に置いて誤マッチを防ぐ）
const ROLE_SUFFIXES = [
  "議会事務局次長兼調査係長事務取扱",
  "議会事務局長",
  "副委員長",
  "委員長",
  "副議長",
  "副市長",
  "事務局長",
  "副部長",
  "副課長",
  "教育長",
  "部次長",
  "議長",
  "市長",
  "議員",
  "委員",
  "部長",
  "課長",
  "室長",
  "局長",
  "次長",
  "係長",
  "参事",
  "主幹",
  "主査",
  "補佐",
  "所長",
] as const;

// 行政側の役職（答弁者として分類する）
const ANSWER_ROLES = new Set([
  "市長",
  "副市長",
  "教育長",
  "議会事務局長",
  "事務局長",
  "部次長",
  "部長",
  "副部長",
  "課長",
  "副課長",
  "室長",
  "局長",
  "次長",
  "係長",
  "参事",
  "主幹",
  "主査",
  "補佐",
  "所長",
]);

const NOISE_PREFIXES = [
  "出席議員",
  "欠席議員",
  "地方自治法第",
  "職務のため出席した事務局職員",
  "会議録目次",
  "一般質問",
  "付議事件",
  "会期・議事日程",
  "議事日程",
];

function matchRole(roleText: string): string | null {
  for (const suffix of ROLE_SUFFIXES) {
    if (roleText === suffix || roleText.endsWith(suffix)) {
      return suffix;
    }
  }
  return null;
}

function looksLikeNoiseName(name: string): boolean {
  return /^(?:出席|欠席|地方自治法|職務|会議録|一般質問|議事|議案|報告|日程|会期|付議|別紙)/.test(
    name,
  );
}

function looksLikePersonName(name: string): boolean {
  return /^[一-龯々〆ヵヶぁ-んァ-ヶー]+$/u.test(name);
}

function normalizeDigits(text: string): string {
  return normalizeFullWidth(text);
}

/**
 * pdftotext / unpdf 抽出テキストを行単位で正規化する。
 */
export function normalizePdfText(rawText: string): string {
  return rawText
    .replace(/\f/g, "\n")
    .replace(/\r\n?/g, "\n")
    .split("\n")
    .map((line) =>
      deSpacePdfText(normalizeFullWidth(line))
        .replace(/[ \t]+/g, " ")
        .trim(),
    )
    .join("\n")
    .replace(/\n{3,}/g, "\n\n");
}

function isPageNumberLine(line: string): boolean {
  return /^[―─－−\-\s]*\d+[\s―─－−\-]*$/.test(line);
}

function isSeparatorLine(line: string): boolean {
  return /^[―─－−\- ]*[○◯◎●][―─－−\- ]*$/.test(line) || /^[○◯◎●]$/.test(line);
}

function isRunningHeaderLine(line: string): boolean {
  return (
    line.includes("奄美市議会定例会議事日程") ||
    line.includes("第1回定例会会議録目次") ||
    line.includes("会期・議事日程") ||
    line === "付議事件"
  );
}

function isNoiseLine(line: string): boolean {
  if (!line) return true;
  if (isPageNumberLine(line) || isSeparatorLine(line) || isRunningHeaderLine(line)) {
    return true;
  }
  if (NOISE_PREFIXES.some((prefix) => line.startsWith(prefix))) return true;
  if (/^[（(].*?(?:呼ぶ者あり|起立者あり|拍手|休憩|登壇|退席|着席).*?[）)]$/.test(line)) {
    return true;
  }
  return false;
}

/**
 * 発言者行をパースする。
 *
 * 対応パターン:
 * - 議長（世門光君） おはようございます。
 * - 奥輝人議長 おはようございます。
 * - 川口幸義議員（22番） おはようございます。
 */
export function parseSpeakerLine(line: string): {
  speakerName: string | null;
  speakerRole: string;
  content: string;
} | null {
  const trimmed = normalizeDigits(line)
    .replace(/^[○◯◎●]\s*/, "")
    .trim();
  if (!trimmed || isNoiseLine(trimmed)) return null;

  const bracketMatch = trimmed.match(/^(.+?)[（(]([^）)]+?)(?:君|様|議員)?[）)]\s*([\s\S]*)$/);
  if (bracketMatch) {
    const rolePart = bracketMatch[1]!.replace(/\s+/g, "").trim();
    const rawName = bracketMatch[2]!.replace(/\s+/g, "").trim();
    const content = bracketMatch[3]!.trim();
    if (!content || !/[。！？]/.test(content)) return null;

    if (/^[\d０-９]+番$/.test(rolePart)) {
      return {
        speakerName: rawName || null,
        speakerRole: "議員",
        content,
      };
    }

    if (/^[\d０-９]+番$/.test(rawName) && rolePart.endsWith("議員")) {
      const speakerName = rolePart.slice(0, -"議員".length) || null;
      if (!speakerName || looksLikeNoiseName(speakerName) || !looksLikePersonName(speakerName)) {
        return null;
      }
      return {
        speakerName,
        speakerRole: "議員",
        content,
      };
    }

    const matchedRole = matchRole(rolePart);
    if (!matchedRole || !looksLikePersonName(rawName)) return null;

    return {
      speakerName: rawName || null,
      speakerRole: matchedRole,
      content,
    };
  }

  const compact = trimmed.replace(/\s+/g, "");

  for (const suffix of ROLE_SUFFIXES) {
    const idx = compact.indexOf(suffix);
    if (idx < 0 || idx > 12) continue;

    const namePart = idx > 0 ? compact.slice(0, idx) : "";
    if (namePart && (looksLikeNoiseName(namePart) || !looksLikePersonName(namePart))) {
      continue;
    }

    let content = compact.slice(idx + suffix.length);
    content = content.replace(/^[（(][^）)]{0,20}[）)]/, "").trim();
    if (!content || !/[。！？]/.test(content)) continue;

    if (
      !/[。！？]/.test(content.slice(0, 80)) &&
      /^[一-龯ぁ-んァ-ヶー]{1,8}(?:議長|議員|市長|副市長|教育長|部長|課長|局長|係長|主査|主幹|所長)/u.test(
        content,
      )
    ) {
      continue;
    }

    return {
      speakerName: namePart || null,
      speakerRole: suffix,
      content,
    };
  }

  return null;
}

/** 役職から発言種別を分類 */
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
  if (ANSWER_ROLES.has(speakerRole)) return "answer";
  for (const role of ANSWER_ROLES) {
    if (speakerRole.endsWith(role)) return "answer";
  }
  return "question";
}

/**
 * 正規化済みテキストから発言を抽出する。
 */
export function parseStatements(rawText: string): ParsedStatement[] {
  const text = normalizePdfText(rawText);
  const lines = text.split("\n");
  const statements: ParsedStatement[] = [];

  let currentSpeakerName: string | null = null;
  let currentSpeakerRole: string | null = null;
  let currentKind: "remark" | "question" | "answer" = "remark";
  let currentContentLines: string[] = [];
  let hasSpeaker = false;
  let started = false;
  let offset = 0;

  function flushStatement() {
    if (!hasSpeaker || currentContentLines.length === 0) return;
    const content = currentContentLines.join("\n").trim();
    if (!content) return;

    const contentHash = createHash("sha256").update(content).digest("hex");
    const startOffset = offset;
    const endOffset = offset + content.length;

    statements.push({
      kind: currentKind,
      speakerName: currentSpeakerName,
      speakerRole: currentSpeakerRole,
      content,
      contentHash,
      startOffset,
      endOffset,
    });

    offset = endOffset + 1;
    currentContentLines = [];
  }

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line) continue;

    if (isSeparatorLine(line)) {
      flushStatement();
      hasSpeaker = false;
      currentSpeakerName = null;
      currentSpeakerRole = null;
      currentContentLines = [];
      continue;
    }

    const parsedSpeaker = parseSpeakerLine(line);
    if (parsedSpeaker) {
      if (!started) {
        if (parsedSpeaker.speakerRole !== "議長" && parsedSpeaker.speakerRole !== "副議長") {
          continue;
        }
        started = true;
      }

      flushStatement();
      hasSpeaker = true;
      currentSpeakerName = parsedSpeaker.speakerName;
      currentSpeakerRole = parsedSpeaker.speakerRole;
      currentKind = classifyKind(parsedSpeaker.speakerRole);
      currentContentLines = [parsedSpeaker.content];
      continue;
    }

    if (!started || !hasSpeaker) continue;
    if (isNoiseLine(line)) continue;
    if (/^[（(].*?[）)]$/.test(line)) continue;

    currentContentLines.push(line);
  }

  flushStatement();
  return statements;
}

function toIsoDate(year: number, month: number, day: number): string {
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function extractYearFromTitle(title: string): number | null {
  return extractWesternYear(title);
}

/**
 * PDF テキストから開催日を抽出する。
 */
export function extractHeldOn(rawText: string, title: string): string | null {
  const text = normalizePdfText(rawText).slice(0, 20_000);

  const fullDateMatch = text.match(/(令和|平成)(元|\d+)年\s*(\d{1,2})月\s*(\d{1,2})日/);
  if (fullDateMatch) {
    const year = extractWesternYear(`${fullDateMatch[1]}${fullDateMatch[2]}年`);
    if (year) {
      return toIsoDate(year, parseInt(fullDateMatch[3]!, 10), parseInt(fullDateMatch[4]!, 10));
    }
  }

  const titleYear = extractYearFromTitle(title);
  if (!titleYear) return null;

  const monthDayMatch = text.match(/(\d{1,2})月\s*(\d{1,2})日/);
  if (!monthDayMatch) return null;

  return toIsoDate(titleYear, parseInt(monthDayMatch[1]!, 10), parseInt(monthDayMatch[2]!, 10));
}

async function extractWithPdftotext(buffer: ArrayBuffer, pdfUrl: string): Promise<string | null> {
  const tmpPath = join(tmpdir(), `amami_${Date.now()}.pdf`);

  try {
    await writeFile(tmpPath, Buffer.from(buffer));
    const { stdout } = await execFileAsync("pdftotext", ["-layout", tmpPath, "-"], {
      maxBuffer: PDFTEXT_MAX_BUFFER,
    });
    return stdout.trim().length > 0 ? stdout : null;
  } catch (err) {
    console.warn(
      `[462225-amami] pdftotext failed: ${pdfUrl}`,
      err instanceof Error ? err.message : err,
    );
    return null;
  } finally {
    await unlink(tmpPath).catch(() => {});
  }
}

async function extractWithUnpdf(buffer: ArrayBuffer, pdfUrl: string): Promise<string | null> {
  try {
    const pdf = await getDocumentProxy(new Uint8Array(buffer));
    const { text } = await extractText(pdf, { mergePages: true });
    return text.trim().length > 0 ? text : null;
  } catch (err) {
    console.warn(
      `[462225-amami] unpdf extract failed: ${pdfUrl}`,
      err instanceof Error ? err.message : err,
    );
    return null;
  }
}

/**
 * PDF URL からテキストを取得する。
 */
async function fetchPdfText(pdfUrl: string): Promise<string | null> {
  const buffer = await fetchBinary(pdfUrl);
  if (!buffer) return null;

  const pdftotextText = await extractWithPdftotext(buffer, pdfUrl);
  if (pdftotextText) return pdftotextText;

  return extractWithUnpdf(buffer, pdfUrl);
}

function extractExternalIdKey(pdfUrl: string): string | null {
  const match = pdfUrl.match(/\/([^/]+)\.pdf$/i);
  return match ? match[1]!.toLowerCase() : null;
}

/**
 * 会議の全 PDF をダウンロード・テキスト抽出し、MeetingData に変換する。
 */
export async function fetchMeetingData(
  meeting: AmamiMeeting,
  municipalityCode: string,
): Promise<MeetingData | null> {
  const rawTexts: string[] = [];
  let heldOn: string | null = null;

  for (let i = 0; i < meeting.pdfUrls.length; i++) {
    const pdfUrl = meeting.pdfUrls[i]!;
    const rawText = await fetchPdfText(pdfUrl);
    if (!rawText) {
      if (i < meeting.pdfUrls.length - 1) {
        await delay(1_000);
      }
      continue;
    }

    rawTexts.push(rawText);
    if (!heldOn) {
      heldOn = extractHeldOn(rawText, meeting.title);
    }

    if (i < meeting.pdfUrls.length - 1) {
      await delay(1_000);
    }
  }

  if (!heldOn && rawTexts.length > 0) {
    heldOn = extractHeldOn(rawTexts.join("\n"), meeting.title);
  }

  const statements = parseStatements(rawTexts.join("\n"));
  if (statements.length === 0 || !heldOn) return null;

  const idKey = extractExternalIdKey(meeting.pdfUrls[0]!);
  const externalId = idKey ? `amami_${idKey}` : null;

  return {
    municipalityCode,
    title: meeting.title,
    meetingType: detectMeetingType(meeting.title),
    heldOn,
    sourceUrl: meeting.pageUrl,
    externalId,
    statements,
  };
}
