/**
 * 東通村議会 — detail フェーズ
 *
 * 「議会だより」PDF から対象会議に対応する要約記事と一般質問記事を抽出し、
 * ParsedStatement 配列へ変換する。
 */

import { createHash } from "node:crypto";
import { extractPdfText } from "../../../utils/pdf";
import type { MeetingData, ParsedStatement } from "../../../utils/types";
import type { HigashidooriMeeting } from "./list";
import {
  NEWSLETTER_LIST_URL,
  BASE_ORIGIN,
  buildExternalId,
  detectMeetingType,
  fetchBinary,
  fetchPage,
  normalizeDigits,
  normalizeText,
} from "./shared";

const ROLE_SUFFIXES = [
  "副委員長",
  "委員長",
  "副議長",
  "議長",
  "副村長",
  "村長",
  "副教育長",
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
  "議員",
  "委員",
];

const ANSWER_ROLES = new Set([
  "村長",
  "副村長",
  "教育長",
  "副教育長",
  "事務局長",
  "局長",
  "部長",
  "副部長",
  "課長",
  "副課長",
  "室長",
  "係長",
  "参事",
  "主幹",
  "主査",
  "補佐",
]);

interface NewsletterIssue {
  pdfUrl: string;
  publishedOn: string;
  issueNumber: number | null;
}

let newsletterIssuesPromise: Promise<NewsletterIssue[]> | null = null;

function createStatement(
  kind: "remark" | "question" | "answer",
  speakerName: string | null,
  speakerRole: string | null,
  content: string,
  offset: number,
): ParsedStatement {
  const contentHash = createHash("sha256").update(content).digest("hex");
  return {
    kind,
    speakerName,
    speakerRole,
    content,
    contentHash,
    startOffset: offset,
    endOffset: offset + content.length,
  };
}

function pushStatement(
  statements: ParsedStatement[],
  kind: "remark" | "question" | "answer",
  speakerName: string | null,
  speakerRole: string | null,
  content: string,
  offsetRef: { value: number },
): void {
  const normalized = normalizeText(content);
  if (!normalized) return;

  statements.push(
    createStatement(kind, speakerName, speakerRole, normalized, offsetRef.value),
  );
  offsetRef.value += normalized.length + 1;
}

export function classifyKind(
  speakerRole: string | null,
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

  for (const answerRole of ANSWER_ROLES) {
    if (speakerRole.endsWith(answerRole)) return "answer";
  }

  return "question";
}

export function parseSpeaker(label: string): {
  speakerName: string | null;
  speakerRole: string | null;
} {
  const normalized = normalizeText(
    label.replace(/の(?:質問|再質問|答弁|発言)$/, ""),
  );

  for (const suffix of ROLE_SUFFIXES) {
    if (normalized === suffix || normalized.endsWith(suffix)) {
      const name =
        normalized.length > suffix.length
          ? normalized.slice(0, -suffix.length).trim() || null
          : null;
      return {
        speakerName: name,
        speakerRole: suffix,
      };
    }
  }

  return {
    speakerName: normalized || null,
    speakerRole: null,
  };
}

function parsePublishedOn(text: string): string | null {
  const normalized = normalizeDigits(text);
  const match = normalized.match(/(\d{4})（(?:令和|平成|昭和).+?）年(\d{1,2})月(\d{1,2})日号/);
  if (!match) return null;

  const year = Number(match[1]!);
  const month = Number(match[2]!);
  const day = Number(match[3]!);
  if (month < 1 || month > 12 || day < 1 || day > 31) return null;

  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

export function parseNewsletterListPage(html: string): NewsletterIssue[] {
  const issues: NewsletterIssue[] = [];

  const linkRegex =
    /<a[^>]+href="([^"]*\/files\/\d+\.pdf)"[^>]*>([\s\S]*?)<\/a>/gi;

  for (const match of html.matchAll(linkRegex)) {
    const href = match[1]!;
    const text = normalizeText(match[2]!.replace(/<[^>]+>/g, ""));
    const publishedOn = parsePublishedOn(text);
    if (!publishedOn) continue;

    const issueMatch = normalizeDigits(text).match(/No\.?\s*(\d+)/i);
    const issueNumber = issueMatch?.[1] ? Number(issueMatch[1]) : null;
    const pdfUrl = href.startsWith("http") ? href : `${BASE_ORIGIN}${href}`;

    issues.push({ pdfUrl, publishedOn, issueNumber });
  }

  return issues;
}

function resolveNewsletterPublicationDate(heldOn: string): string {
  const [yearText, monthText] = heldOn.split("-");
  const year = Number(yearText);
  const month = Number(monthText);

  if (month >= 10) return `${year + 1}-01-31`;
  if (month >= 7) return `${year}-10-31`;
  if (month >= 4) return `${year}-07-31`;
  return `${year}-04-30`;
}

export function findMatchingNewsletterIssue(
  issues: NewsletterIssue[],
  heldOn: string,
): NewsletterIssue | null {
  const target = resolveNewsletterPublicationDate(heldOn);
  return issues.find((issue) => issue.publishedOn === target) ?? null;
}

function extractSessionKey(title: string): string | null {
  const normalized = normalizeDigits(title);
  const match = normalized.match(/(第\d+回(?:定例会|臨時会))/);
  return match?.[1] ?? null;
}

function extractMeetingSection(text: string, title: string): string | null {
  const normalized = normalizeDigits(text);
  const sessionKey = extractSessionKey(title);
  if (!sessionKey) return null;

  const headings = [...normalized.matchAll(/≪第\d+回(?:定例会|臨時会)[^≫]*≫/g)];
  const currentIndex = headings.findIndex((heading) =>
    heading[0].includes(sessionKey),
  );
  if (currentIndex === -1) return null;

  const start = headings[currentIndex]!.index!;
  const candidateEnds: number[] = [];

  if (currentIndex < headings.length - 1) {
    candidateEnds.push(headings[currentIndex + 1]!.index!);
  }

  if (title.includes("定例会")) {
    const questionIndex = normalized.indexOf(`${sessionKey}（一般質問）`, start);
    if (questionIndex !== -1) candidateEnds.push(questionIndex);
  }

  for (const marker of ["東通原子力発電所に関する要望活動", "議員県外視察研修", "編 集 後 記", "編集後記"]) {
    const markerIndex = normalized.indexOf(marker, start);
    if (markerIndex !== -1) candidateEnds.push(markerIndex);
  }

  const end =
    candidateEnds.length > 0 ? Math.min(...candidateEnds) : normalized.length;

  return normalized.slice(start, end).trim();
}

function extractGeneralQuestionSection(text: string, title: string): string | null {
  if (!title.includes("定例会")) return null;

  const normalized = normalizeDigits(text);
  const sessionKey = extractSessionKey(title);
  if (!sessionKey) return null;

  const marker = `${sessionKey}（一般質問）`;
  const start = normalized.indexOf(marker);
  if (start === -1) return null;

  const tail = normalized.slice(start);
  const endMarkers = ["東通原子力発電所に関する要望活動", "編 集 後 記", "編集後記"];
  let end = tail.length;

  for (const endMarker of endMarkers) {
    const index = tail.indexOf(endMarker);
    if (index !== -1 && index < end) end = index;
  }

  return tail.slice(0, end).trim();
}

function cleanRemarkChunk(chunk: string): string {
  return normalizeText(
    chunk
      .replace(/≪第\d+回(?:定例会|臨時会)[^≫]*≫/g, "")
      .replace(/東通村議会だより第\d+号/g, "")
      .replace(/（次のページへ続く）/g, "")
      .replace(/議案番号\s*件\s*名\s*内\s*容/g, "")
      .replace(/\b\d+\b/g, " ")
      .replace(/\s+/g, " "),
  );
}

function parseSummaryStatements(section: string): ParsedStatement[] {
  const statements: ParsedStatement[] = [];
  const offsetRef = { value: 0 };

  const chunks = section
    .replace(/（次ページへ続く）/g, "\n")
    .replace(/（次のページへ続く）/g, "\n")
    .split(/\n{2,}/)
    .map((chunk) => cleanRemarkChunk(chunk))
    .filter((chunk) => chunk.length >= 20);

  for (const chunk of chunks) {
    pushStatement(statements, "remark", null, null, chunk, offsetRef);
  }

  return statements;
}

export function parseStatements(text: string): ParsedStatement[] {
  const normalized = normalizeDigits(text)
    .replace(/(【[^】]+】)\1+/g, "$1")
    .replace(/東通村議会だより第\d+号/g, "\n")
    .replace(/第\d+回定例会（一般質問）/g, "\n")
    .replace(/令和\d+年\d+月\d+日第\d+回定例会（一般質問）/g, "\n")
    .replace(/令和\d+年\d+月\d+日\s*第\d+回定例会（一般質問）/g, "\n");

  const statements: ParsedStatement[] = [];
  const offsetRef = { value: 0 };

  const markers = [...normalized.matchAll(/【([^】]+)】/g)].filter((match) =>
    /の(?:質問|再質問|答弁|発言)$/.test(match[1]!),
  );

  for (let index = 0; index < markers.length; index++) {
    const current = markers[index]!;
    const next = markers[index + 1];
    const contentStart = current.index! + current[0].length;
    const contentEnd = next?.index ?? normalized.length;

    const content = normalizeText(
      normalized
        .slice(contentStart, contentEnd)
        .replace(/議員県外視察研修[\s\S]*$/g, " ")
        .replace(/東通原子力発電所に関する要望活動[\s\S]*$/g, " ")
        .replace(/その他にこのような活動を実施しました[\s\S]*$/g, " ")
        .replace(/編\s*集\s*後\s*記[\s\S]*$/g, " ")
        .replace(/《詳細》[^\n]*/g, " ")
        .replace(/◆[^\n]*/g, " ")
        .replace(/（次ページへ続く）/g, " ")
        .replace(/（次のページへ続く）/g, " ")
        .replace(/\b\d+\b/g, " ")
        .replace(/\s+/g, " "),
    );

    if (!content) continue;

    const { speakerName, speakerRole } = parseSpeaker(current[1]!);
    pushStatement(
      statements,
      classifyKind(speakerRole),
      speakerName,
      speakerRole,
      content,
      offsetRef,
    );
  }
  return statements;
}

async function fetchPdfText(pdfUrl: string): Promise<string | null> {
  const buffer = await fetchBinary(pdfUrl);
  if (!buffer) return null;

  return extractPdfText(buffer, {
    pdfUrl,
    strategy: "pdftotext",
    isUsable: (text) => text.includes("議会だより"),
    tempPrefix: "024244_higashidoori",
  });
}

async function fetchNewsletterIssues(): Promise<NewsletterIssue[]> {
  newsletterIssuesPromise ??= (async () => {
    const html = await fetchPage(NEWSLETTER_LIST_URL);
    if (!html) return [];
    return parseNewsletterListPage(html);
  })();

  return newsletterIssuesPromise;
}

export async function fetchMeetingData(
  meeting: HigashidooriMeeting,
  municipalityCode: string,
): Promise<MeetingData | null> {
  const issues = await fetchNewsletterIssues();
  const issue = findMatchingNewsletterIssue(issues, meeting.heldOn);
  if (!issue) return null;

  const text = await fetchPdfText(issue.pdfUrl);
  if (!text) return null;

  const summarySection = extractMeetingSection(text, meeting.title);
  if (!summarySection) return null;

  const summaryStatements = parseSummaryStatements(summarySection);
  const qaSection = extractGeneralQuestionSection(text, meeting.title);
  const qaStatements = qaSection ? parseStatements(qaSection) : [];

  const statements = [...summaryStatements, ...qaStatements];
  if (statements.length === 0) return null;

  return {
    municipalityCode,
    title: meeting.title,
    meetingType: detectMeetingType(meeting.title),
    heldOn: meeting.heldOn,
    sourceUrl: issue.pdfUrl,
    externalId: buildExternalId(meeting.heldOn, meeting.title),
    statements,
  };
}
