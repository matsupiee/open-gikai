/**
 * 美浜町議会（和歌山県） — detail フェーズ
 *
 * PDF をダウンロードし、unpdf でテキストを抽出して発言を構造化データに変換する。
 *
 * PDF のテキストは文字間にスペースが挟まれているため、除去して処理する。
 * 発言は「○発言者名役職発言内容」の形式で始まる。
 */

import { createHash } from "node:crypto";
import { extractText } from "unpdf";
import type { MeetingData, ParsedStatement } from "../../../utils/types";
import { detectMeetingType, fetchBinary } from "./shared";

// 役職サフィックス（長い方を先に置いて誤マッチを防ぐ）
const ROLE_SUFFIXES = [
  "副委員長",
  "委員長",
  "副議長",
  "副町長",
  "副部長",
  "副課長",
  "事務局長",
  "議長",
  "町長",
  "委員",
  "議員",
  "部長",
  "課長",
  "室長",
  "局長",
  "係長",
  "参事",
  "主幹",
  "次長",
  "所長",
] as const;

// 行政側の役職（答弁者として分類する）
const ANSWER_ROLES = new Set([
  "町長",
  "副町長",
  "部長",
  "副部長",
  "課長",
  "副課長",
  "室長",
  "局長",
  "係長",
  "参事",
  "主幹",
  "次長",
  "所長",
  "事務局長",
]);

/**
 * 全角数字を半角数字に変換する。
 */
function normalizeNumbers(s: string): string {
  return s.replace(/[０-９]/g, (c) =>
    String.fromCharCode(c.charCodeAt(0) - 0xff10 + 0x30),
  );
}

/**
 * PDF の生テキスト（文字間スペースあり）からスペースを除去してクリーンなテキストを返す。
 *
 * unpdf で抽出したテキストは各文字の間に空白が入るため、行ごとに除去する。
 * また、全角数字を半角に正規化する（日付解析のため）。
 */
export function cleanPdfText(raw: string): string {
  return raw
    .split("\n")
    .map((line) => normalizeNumbers(line.replace(/ /g, "")))
    .join("\n");
}

/**
 * 発言テキストから話者名・役職・本文を抽出する。
 *
 * フォーマット（スペース除去後）: "○山田議長ただいまから本日の会議を開きます。"
 *
 * 役職が名前の末尾に付く形式: 「山田議長ただいまから...」→ name=山田, role=議長, content=ただいまから...
 */
export function parseSpeaker(text: string): {
  speakerName: string | null;
  speakerRole: string | null;
  content: string;
} {
  // ○ マーカーを除去
  const stripped = text.replace(/^[○◯◎●]\s*/, "");

  // 役職サフィックスを先頭から検索（長い方が先にあるため誤マッチを防ぐ）
  const MAX_HEADER_LEN = 20;
  const searchWindow = stripped.slice(0, MAX_HEADER_LEN + 5);
  const MAX_NAME_LEN = 12;

  for (const suffix of ROLE_SUFFIXES) {
    const idx = searchWindow.indexOf(suffix);
    if (idx === -1) continue;

    if (idx > MAX_NAME_LEN) continue;

    const nameEnd = idx + suffix.length;
    // 役職名の直後が組織名の一部になりえる文字の場合はスキップ
    const nextChar = stripped[nameEnd];
    if (nextChar && /[会団長部]/.test(nextChar)) continue;

    const name = stripped.slice(0, idx);
    const content = stripped.slice(nameEnd).trim();

    return {
      speakerName: name.length > 0 ? name : null,
      speakerRole: suffix,
      content,
    };
  }

  // 役職が見つからない場合: ○マーカーがあれば先頭の漢字連続部分を名前として扱う
  if (/^[○◯◎●]/.test(text)) {
    const nameMatch = stripped.match(/^([\u4e00-\u9fff\u3400-\u4dbf]{1,12})/);
    if (nameMatch?.[1]) {
      return {
        speakerName: nameMatch[1],
        speakerRole: null,
        content: stripped.slice(nameMatch[1].length).trim(),
      };
    }
  }

  return { speakerName: null, speakerRole: null, content: stripped.trim() };
}

/** 役職から発言種別を分類 */
export function classifyKind(
  speakerRole: string | null,
): "question" | "answer" | "remark" {
  if (!speakerRole) return "remark";
  if (speakerRole === "議長" || speakerRole === "副議長") return "remark";
  if (
    speakerRole === "委員長" ||
    speakerRole === "副委員長"
  )
    return "remark";
  if (ANSWER_ROLES.has(speakerRole)) return "answer";
  // 複合役職（例: 「産業振興課長」「教育委員会事務局長」）
  for (const role of ANSWER_ROLES) {
    if (speakerRole.endsWith(role)) return "answer";
  }
  return "question";
}

/**
 * クリーン済みテキストから発言を抽出する。
 *
 * 発言は「○」で始まる行で区切られる。
 * 連続する非発言行は直前の発言の本文として扱う。
 */
export function parseStatements(cleanedText: string): ParsedStatement[] {
  const statements: ParsedStatement[] = [];
  const lines = cleanedText.split("\n");

  let offset = 0;
  let currentSpeakerName: string | null = null;
  let currentSpeakerRole: string | null = null;
  let currentKind: "question" | "answer" | "remark" = "remark";
  let currentContentLines: string[] = [];
  let hasSpeaker = false;

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

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;

    // ページ番号行をスキップ
    if (/^－\d+－$/.test(trimmed)) continue;
    if (/^-\d+-$/.test(trimmed)) continue;
    if (/^～+○～+$/.test(trimmed)) continue;

    if (trimmed.startsWith("○") && !trimmed.startsWith("○～")) {
      // 直前の発言をフラッシュ
      flushStatement();
      hasSpeaker = true;

      const { speakerName, speakerRole, content } = parseSpeaker(trimmed);
      currentSpeakerName = speakerName;
      currentSpeakerRole = speakerRole;
      currentKind = classifyKind(speakerRole);

      if (content) {
        currentContentLines.push(content);
      }
    } else if (hasSpeaker) {
      // 現在の発言の続き（行連結）— 発言者が登場した後のみ
      currentContentLines.push(trimmed);
    }
  }

  // 最後の発言をフラッシュ
  flushStatement();

  return statements;
}

/**
 * 元号表記の日付文字列を YYYY-MM-DD に変換する。
 */
export function parseJapaneseDate(text: string): string | null {
  const reiwaMatch = text.match(/令和(\d+|元)年(\d+)月(\d+)日/);
  if (reiwaMatch) {
    const n = reiwaMatch[1] === "元" ? 1 : parseInt(reiwaMatch[1] ?? "0", 10);
    const year = 2018 + n;
    const month = parseInt(reiwaMatch[2] ?? "0", 10);
    const day = parseInt(reiwaMatch[3] ?? "0", 10);
    if (month > 0 && month <= 12 && day > 0 && day <= 31) {
      return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    }
  }

  const heiseiMatch = text.match(/平成(\d+|元)年(\d+)月(\d+)日/);
  if (heiseiMatch) {
    const n = heiseiMatch[1] === "元" ? 1 : parseInt(heiseiMatch[1] ?? "0", 10);
    const year = 1988 + n;
    const month = parseInt(heiseiMatch[2] ?? "0", 10);
    const day = parseInt(heiseiMatch[3] ?? "0", 10);
    if (month > 0 && month <= 12 && day > 0 && day <= 31) {
      return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    }
  }

  return null;
}

/**
 * PDF のテキストから開催日を抽出する。
 *
 * 通常、PDF の冒頭（1〜2ページ目）に「令和XX年X月X日」の形式で記載される。
 */
export function extractHeldOnFromText(cleanedText: string): string | null {
  const lines = cleanedText.split("\n").slice(0, 80);
  for (const line of lines) {
    const date = parseJapaneseDate(line);
    if (date) return date;
  }
  return null;
}

/**
 * PDF バイナリをダウンロードしてテキストを抽出・発言を構造化する。
 */
export async function fetchPdfStatements(
  pdfUrl: string,
): Promise<{ statements: ParsedStatement[]; heldOn: string | null } | null> {
  const buf = await fetchBinary(pdfUrl);
  if (!buf) return null;

  let pages: string[];
  try {
    const result = await extractText(buf, { mergePages: false });
    pages = result.text;
  } catch (e) {
    console.warn("[303810-mihama-wakayama] PDF text extraction failed:", pdfUrl, e);
    return null;
  }

  const cleanedPages = pages.map(cleanPdfText);
  const fullText = cleanedPages.join("\n");

  const heldOn = extractHeldOnFromText(fullText);
  const statements = parseStatements(fullText);

  return { statements, heldOn };
}

/**
 * セッション情報から MeetingData を組み立てる。
 */
export async function fetchMeetingData(
  params: {
    title: string;
    heldOn: string | null;
    pdfUrl: string;
    yearPageUrl: string;
    meetingType: "plenary" | "extraordinary" | "committee";
  },
  municipalityCode: string,
): Promise<MeetingData | null> {
  const result = await fetchPdfStatements(params.pdfUrl);
  if (!result) return null;

  const { statements, heldOn: pdfHeldOn } = result;
  if (statements.length === 0) return null;

  // PDF から取得した日付を優先し、なければ params.heldOn を使用
  const heldOn = pdfHeldOn ?? params.heldOn;
  if (!heldOn) return null;

  const externalId = `mihama_wakayama_${encodeURIComponent(params.pdfUrl.split("/").pop() ?? params.pdfUrl)}`;

  return {
    municipalityCode,
    title: params.title,
    meetingType: detectMeetingType(params.title) || params.meetingType,
    heldOn,
    sourceUrl: params.yearPageUrl,
    externalId,
    statements,
  };
}
