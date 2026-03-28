import { createHash } from "node:crypto";
import { extractPdfText } from "../../../utils/pdf";
import type { MeetingData, ParsedStatement } from "../../../utils/types";
import {
  detectMeetingType,
  fetchBinary,
  fetchPage,
  normalizeDigits,
  toAbsoluteUrl,
} from "./shared";

export interface ChikuzenDetailParams {
  title: string;
  detailUrl: string;
  year: number;
  meetingType: "plenary" | "extraordinary" | "committee";
}

export interface ChikuzenPdfLink {
  label: string;
  pdfUrl: string;
}

const INTER_PDF_DELAY_MS = 1_000;
const PDFTEXT_MAX_BUFFER = 25_000_000;

const ROLE_SUFFIXES = [
  "副委員長",
  "委員長",
  "副議長",
  "議長",
  "副町長",
  "町長",
  "副教育長",
  "教育長",
  "議会事務局長",
  "事務局長",
  "課長補佐",
  "課長",
  "館長",
  "局長",
  "室長",
  "部長",
  "次長",
  "係長",
  "参事",
  "主幹",
  "主査",
  "補佐",
  "議員",
  "委員",
] as const;

const REMARK_ROLES = new Set(["議長", "副議長", "委員長", "副委員長"]);

const ANSWER_ROLES = new Set([
  "町長",
  "副町長",
  "教育長",
  "副教育長",
  "議会事務局長",
  "事務局長",
  "課長補佐",
  "課長",
  "館長",
  "局長",
  "室長",
  "部長",
  "次長",
  "係長",
  "参事",
  "主幹",
  "主査",
  "補佐",
]);

const PERSON_NAME_ROLE_SUFFIXES = new Set([
  "議員",
  "議長",
  "副議長",
  "委員長",
  "副委員長",
]);

function cleanText(text: string): string {
  return text
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/\s+/g, " ")
    .trim();
}

function collapseWhitespace(text: string): string {
  return normalizeDigits(text).replace(/　/g, " ").replace(/[ \t]+/g, " ").trim();
}

function compactToken(text: string): string {
  return collapseWhitespace(text).replace(/ /g, "");
}

function looksLikePersonName(text: string): boolean {
  return /^[一-龯々ぁ-んァ-ヶー]{1,8}$/u.test(text);
}

function isNoiseLine(line: string): boolean {
  const normalized = compactToken(line);
  return (
    normalized.length === 0 ||
    /^\d+$/.test(normalized) ||
    /^[(（]\d{1,2}:\d{2}[)）]$/.test(normalized) ||
    /^第?\d+頁$/.test(normalized) ||
    normalized === "会議録" ||
    normalized === "開会" ||
    normalized === "開議" ||
    normalized === "再開" ||
    normalized.startsWith("令和") && normalized.includes("会議録") ||
    normalized.startsWith("平成") && normalized.includes("会議録") ||
    normalized.startsWith("招集年月日") ||
    normalized.startsWith("招集の場所") ||
    normalized.startsWith("出席議員") ||
    normalized.startsWith("出席議員数") ||
    normalized.startsWith("欠席議員") ||
    normalized.startsWith("欠席者") ||
    normalized.startsWith("地方自治法") ||
    normalized.startsWith("本会議に職務のために出席した者") ||
    normalized.startsWith("の職氏名") ||
    normalized.startsWith("［") ||
    normalized.startsWith("日程第") && !/[。、「」]/.test(normalized)
  );
}

function isProceedingsStart(line: string): boolean {
  const normalized = compactToken(line);
  return (
    normalized === "開会" ||
    normalized === "開議" ||
    normalized === "再開" ||
    normalized.startsWith("開会令和") ||
    normalized.startsWith("開議令和") ||
    normalized.startsWith("再開令和") ||
    normalized.startsWith("開会平成") ||
    normalized.startsWith("開議平成") ||
    normalized.startsWith("再開平成")
  );
}

function parseSpeakerHeader(header: string): {
  speakerName: string | null;
  speakerRole: string | null;
} | null {
  const compact = compactToken(header);
  if (!compact) return null;

  const numberedMember = compact.match(/^\d+番(.+?)議員$/);
  if (numberedMember?.[1] && looksLikePersonName(numberedMember[1])) {
    return {
      speakerName: numberedMember[1],
      speakerRole: "議員",
    };
  }

  for (const suffix of ROLE_SUFFIXES) {
    if (compact === suffix) {
      return {
        speakerName: null,
        speakerRole: suffix,
      };
    }

    if (!compact.endsWith(suffix)) continue;
    const prefix = compact.slice(0, -suffix.length);

    if (
      prefix &&
      PERSON_NAME_ROLE_SUFFIXES.has(suffix) &&
      looksLikePersonName(prefix)
    ) {
      return {
        speakerName: prefix,
        speakerRole: suffix,
      };
    }

    return {
      speakerName: null,
      speakerRole: compact,
    };
  }

  return null;
}

function normalizeContentLine(line: string): string {
  return collapseWhitespace(line);
}

export function parsePdfLinks(
  html: string,
  detailUrl: string,
): ChikuzenPdfLink[] {
  const sectionMatch = html.match(
    /<div class="section file_section">([\s\S]*?)<\/div>\s*(?:<div class="section|<\/div>)/i,
  );
  const section = sectionMatch?.[1] ?? html;
  const links: ChikuzenPdfLink[] = [];
  const seen = new Set<string>();
  const pattern = /<a\s[^>]*href="([^"]+\.pdf)"[^>]*>([\s\S]*?)<\/a>/gi;

  for (const match of section.matchAll(pattern)) {
    const pdfUrl = toAbsoluteUrl(match[1]!, detailUrl);
    if (seen.has(pdfUrl)) continue;
    seen.add(pdfUrl);

    const label = cleanText(match[2]!).replace(/[（(]PDF[:：][^)）]+[)）]$/i, "").trim();
    links.push({ label, pdfUrl });
  }

  return links;
}

export function extractHeldOn(text: string): string | null {
  const lines = normalizePdfText(text).split("\n").slice(0, 80);

  const toIsoDate = (match: RegExpMatchArray): string => {
    const era = match[1]!;
    const eraYear = match[2] === "元" ? 1 : Number(match[2]);
    const month = Number(match[3]);
    const day = Number(match[4]);

    let year: number;
    if (era === "令和") year = 2018 + eraYear;
    else year = 1988 + eraYear;

    return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
  };

  const headerDates = lines
    .filter((line) =>
      /^(招集年月日|開\s*会|開\s*議|再\s*開|閉\s*会|散\s*会)/.test(
        compactToken(line),
      ),
    )
    .map((line) =>
      line.match(
        /(令和|平成)\s*(元|\d+)\s*年\s*(\d{1,2})\s*月\s*(\d{1,2})\s*日/,
      ),
    )
    .filter((match): match is RegExpMatchArray => match !== null)
    .map((match) => toIsoDate(match));

  if (headerDates.length > 0) {
    return headerDates.sort()[0] ?? null;
  }

  const fallbackMatches = [
    ...lines
      .join("\n")
      .matchAll(
        /(令和|平成)\s*(元|\d+)\s*年\s*(\d{1,2})\s*月\s*(\d{1,2})\s*日/g,
      ),
  ];

  let earliest: string | null = null;

  for (const match of fallbackMatches) {
    const iso = toIsoDate(match);
    if (!earliest || iso < earliest) {
      earliest = iso;
    }
  }

  return earliest;
}

export function parseSpeaker(text: string): {
  speakerName: string | null;
  speakerRole: string | null;
  content: string;
} {
  const normalized = collapseWhitespace(text);
  const words = normalized.split(" ").filter((word) => word.length > 0);

  for (let wordCount = Math.min(6, words.length - 1); wordCount >= 1; wordCount--) {
    const header = words.slice(0, wordCount).join(" ");
    const content = words.slice(wordCount).join(" ").trim();
    if (!content) continue;

    const parsedHeader = parseSpeakerHeader(header);
    if (!parsedHeader) continue;

    return {
      speakerName: parsedHeader.speakerName,
      speakerRole: parsedHeader.speakerRole,
      content,
    };
  }

  return {
    speakerName: null,
    speakerRole: null,
    content: normalized,
  };
}

export function classifyKind(
  speakerRole: string | null,
): "remark" | "question" | "answer" {
  if (!speakerRole) return "remark";
  if (REMARK_ROLES.has(speakerRole)) return "remark";
  if (ANSWER_ROLES.has(speakerRole)) return "answer";

  for (const role of ANSWER_ROLES) {
    if (speakerRole.endsWith(role)) return "answer";
  }
  for (const role of REMARK_ROLES) {
    if (speakerRole.endsWith(role)) return "remark";
  }
  if (speakerRole.endsWith("議員")) return "question";

  return "question";
}

export function normalizePdfText(rawText: string): string {
  return normalizeDigits(rawText)
    .replace(/\f/g, "\n")
    .replace(/\r\n?/g, "\n")
    .split("\n")
    .map((line) => line.replace(/　/g, " ").replace(/[ \t]+/g, " ").trim())
    .join("\n")
    .replace(/\n{3,}/g, "\n\n");
}

export function parseStatements(rawText: string): ParsedStatement[] {
  if (!rawText.trim()) return [];

  const lines = normalizePdfText(rawText)
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.length > 0);

  const recordIndex = lines.findIndex((line) => compactToken(line) === "会議録");
  const startSearchIndex = recordIndex >= 0 ? recordIndex + 1 : 0;
  const startIndex = lines.findIndex(
    (line, index) => index >= startSearchIndex && isProceedingsStart(line),
  );
  const targetLines = startIndex >= 0 ? lines.slice(startIndex) : lines;

  const statements: ParsedStatement[] = [];
  let currentSpeakerName: string | null = null;
  let currentSpeakerRole: string | null = null;
  let currentKind: "remark" | "question" | "answer" = "remark";
  let currentContentLines: string[] = [];
  let offset = 0;

  const flushStatement = () => {
    if (currentContentLines.length === 0) return;

    const content = currentContentLines.join("\n").trim();
    if (!content) return;

    const contentHash = createHash("sha256").update(content).digest("hex");
    const startOffset = offset;
    const endOffset = startOffset + content.length;

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
  };

  for (const line of targetLines) {
    if (isNoiseLine(line)) continue;

    const parsed = parseSpeaker(line);
    const hasSpeaker = parsed.speakerName !== null || parsed.speakerRole !== null;

    if (hasSpeaker) {
      flushStatement();
      currentSpeakerName = parsed.speakerName;
      currentSpeakerRole = parsed.speakerRole;
      currentKind = classifyKind(parsed.speakerRole);
      currentContentLines = parsed.content ? [parsed.content] : [];
      continue;
    }

    if (currentContentLines.length === 0) continue;

    const normalizedLine = normalizeContentLine(line);
    if (!normalizedLine || isNoiseLine(normalizedLine)) continue;
    currentContentLines.push(normalizedLine);
  }

  flushStatement();

  return statements;
}

function isUsableExtractedText(text: string): boolean {
  return (
    extractHeldOn(text) !== null &&
    parseStatements(text).length > 0 &&
    normalizePdfText(text).split("\n").filter(Boolean).length > 20
  );
}

async function fetchPdfText(pdfUrl: string): Promise<string | null> {
  const buffer = await fetchBinary(pdfUrl);
  if (!buffer) return null;

  return extractPdfText(buffer, {
    isUsable: isUsableExtractedText,
    maxBuffer: PDFTEXT_MAX_BUFFER,
    pdfUrl,
    strategy: ["unpdf", "pdftotext"],
    tempPrefix: "chikuzen",
  });
}

function extractExternalId(detailUrl: string): string | null {
  const basename = new URL(detailUrl).pathname.split("/").pop();
  if (!basename) return null;
  return `chikuzen_${basename.replace(/\.html?$/i, "")}`;
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function fetchMeetingData(
  params: ChikuzenDetailParams,
  municipalityCode: string,
): Promise<MeetingData | null> {
  const detailHtml = await fetchPage(params.detailUrl);
  if (!detailHtml) return null;

  const pdfLinks = parsePdfLinks(detailHtml, params.detailUrl);
  if (pdfLinks.length === 0) return null;

  const allStatements: ParsedStatement[] = [];
  let heldOn: string | null = null;

  for (let i = 0; i < pdfLinks.length; i++) {
    const pdfUrl = pdfLinks[i]!.pdfUrl;
    const text = await fetchPdfText(pdfUrl);
    if (text) {
      const extractedHeldOn = extractHeldOn(text);
      if (extractedHeldOn && (!heldOn || extractedHeldOn < heldOn)) {
        heldOn = extractedHeldOn;
      }

      const statements = parseStatements(text);
      const baseOffset =
        allStatements.length > 0
          ? allStatements[allStatements.length - 1]!.endOffset + 1
          : 0;

      for (const statement of statements) {
        allStatements.push({
          ...statement,
          startOffset: statement.startOffset + baseOffset,
          endOffset: statement.endOffset + baseOffset,
        });
      }
    }

    if (i < pdfLinks.length - 1) {
      await delay(INTER_PDF_DELAY_MS);
    }
  }

  if (!heldOn) return null;
  if (allStatements.length === 0) return null;

  return {
    municipalityCode,
    title: params.title,
    meetingType: detectMeetingType(params.title),
    heldOn,
    sourceUrl: params.detailUrl,
    externalId: extractExternalId(params.detailUrl),
    statements: allStatements,
  };
}
