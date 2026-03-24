/**
 * 曽爾村議会 -- detail フェーズ
 *
 * PDF をダウンロードしてテキストを抽出し、○ マーカーで発言を分割して
 * ParsedStatement 配列を生成する。
 *
 * 発言パターン:
 *   ○議長（田中○○）　...
 *   ○村長（山本○○）　...
 *   ○○番（氏名）　...
 */

import { createHash } from "node:crypto";
import { extractText, getDocumentProxy } from "unpdf";
import type { MeetingData, ParsedStatement } from "../../../utils/types";
import type { SoniMeeting } from "./list";
import {
  detectMeetingType,
  fetchBinary,
  normalizeDigits,
  parseDateText,
} from "./shared";

// 役職サフィックス（長い方を先に置いて誤マッチを防ぐ）
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

// 行政側の役職（答弁者として分類する）
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

/**
 * ○ マーカー付きの発言ヘッダーから発言者情報を抽出する。
 *
 * 対応パターン:
 *   ○議長（田中一郎君）　ただいまから開会します。
 *   ○村長（山本花子君）　お答えいたします。
 *   ○３番（佐藤次郎君）　質問いたします。
 *   ○総務課長（鈴木三郎君）　ご説明いたします。
 */
export function parseSpeaker(text: string): {
  speakerName: string | null;
  speakerRole: string | null;
  content: string;
} {
  const stripped = text.replace(/^[○◯◎●]\s*/, "");

  // パターン: role（name + 君|様|議員）content
  const match = stripped.match(
    /^(.+?)[（(](.+?)(?:君|様|議員)[）)]\s*([\s\S]*)/
  );
  if (match) {
    const rolePart = match[1]!.trim();
    const rawName = match[2]!.replace(/[\s　]+/g, "").trim();
    const content = match[3]!.trim();

    // 番号付き議員: ○３番（山田太郎君）
    if (/^[\d０-９]+番$/.test(rolePart)) {
      return { speakerName: rawName, speakerRole: "議員", content };
    }

    // 役職マッチ
    for (const suffix of ROLE_SUFFIXES) {
      if (rolePart === suffix || rolePart.endsWith(suffix)) {
        return { speakerName: rawName, speakerRole: suffix, content };
      }
    }

    return { speakerName: rawName, speakerRole: rolePart || null, content };
  }

  // ○ マーカーはあるがカッコパターンに合致しない場合
  const headerMatch = stripped.match(/^([^\s　]{1,30})[\s　]+([\s\S]*)/);
  if (headerMatch) {
    const header = headerMatch[1]!;
    const content = headerMatch[2]!.trim();

    for (const suffix of ROLE_SUFFIXES) {
      if (header.endsWith(suffix)) {
        const name =
          header.length > suffix.length
            ? header.slice(0, -suffix.length)
            : null;
        return { speakerName: name, speakerRole: suffix, content };
      }
    }
  }

  return { speakerName: null, speakerRole: null, content: stripped.trim() };
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
  )
    return "remark";
  for (const role of ANSWER_ROLES) {
    if (speakerRole.endsWith(role)) return "answer";
  }
  return "question";
}

/**
 * PDF から抽出したテキストを ParsedStatement 配列に変換する。
 */
export function parseStatements(text: string): ParsedStatement[] {
  const blocks = text.split(/(?=[○◯◎●])/);
  const statements: ParsedStatement[] = [];
  let offset = 0;

  for (const block of blocks) {
    const trimmed = block.trim();
    if (!trimmed || !/^[○◯◎●]/.test(trimmed)) continue;

    // ト書き（登壇等）をスキップ
    if (/^[○◯◎●]\s*[（(].+?(?:登壇|退席|退場|着席)[）)]$/.test(trimmed))
      continue;

    const normalized = trimmed.replace(/\s+/g, " ");
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

/**
 * PDF テキストから開催日を抽出する。
 *
 * 曽爾村の PDF は「議会だより」（村広報誌）掲載形式のため、
 * 標準的な「令和X年Y月Z日」形式の日付が見つからない場合がある。
 *
 * 以下の形式を順に試みる:
 * 1. 標準形式: 「令和X年Y月Z日」
 * 2. 会期開始日形式: 「令和X年第N回...Y月Z日から」
 *
 * パース失敗時は null を返す。
 */
export function extractHeldOn(text: string): string | null {
  const head = normalizeDigits(text.slice(0, 1000));

  // 1. 標準形式: 「令和X年Y月Z日」
  const standard = parseDateText(head);
  if (standard) return standard;

  // 2. 「令和X年第N回...Y月 Z日から」形式（議会だより形式）
  //    例: "令和7年第3回曽爾村議会定例会は、9月 10 日から"
  const sessionMatch = head.match(
    /(令和|平成|昭和)\s*(元|\d+)年[^\n]{0,80}?(\d+)月\s*(\d+)\s*日(?:から|に開会)/
  );
  if (sessionMatch) {
    const era = sessionMatch[1]!;
    const eraYear = sessionMatch[2] === "元" ? 1 : Number(sessionMatch[2]);
    const month = Number(sessionMatch[3]);
    const day = Number(sessionMatch[4]);

    let westernYear: number;
    if (era === "令和") westernYear = eraYear + 2018;
    else if (era === "平成") westernYear = eraYear + 1988;
    else if (era === "昭和") westernYear = eraYear + 1925;
    else return null;

    return `${westernYear}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
  }

  return null;
}

/**
 * PDF テキストから会議タイトルを抽出する。
 * ファイル名が不規則なため、PDF 本文から取得する。
 *
 * 以下の形式を試みる:
 * 1. 「令和X年...会議録」形式
 * 2. 「令和X年第N回曽爾村議会...会」形式（議会だより形式）
 */
export function extractTitle(text: string, fallbackTitle: string): string {
  const head = normalizeDigits(text.slice(0, 500));

  // 1. 標準形式: 「会議録」を含むタイトル
  const kaigirokuMatch = head.match(
    /((?:令和|平成|昭和)(?:元|\d+)年[^\n\r]{0,60}会議録)/
  );
  if (kaigirokuMatch) return kaigirokuMatch[1]!.replace(/[\s　]+/g, " ").trim();

  // 2. 議会だより形式: 「令和X年第N回曽爾村議会...定例会|臨時会」
  // スペースや改行が混在する場合があるため \s* を許容する
  const gikaiMatch = head.match(
    /((?:令和|平成|昭和)(?:元|\d+)年第\d+回[^\n\r]{0,60}?(?:定\s*例会|臨\s*時会))/
  );
  if (gikaiMatch) return gikaiMatch[1]!.replace(/[\s　]+/g, " ").trim();

  return fallbackTitle;
}

/** PDF URL からテキストを取得する。 */
async function fetchPdfText(pdfUrl: string): Promise<string | null> {
  try {
    const buffer = await fetchBinary(pdfUrl);
    if (!buffer) return null;

    const pdf = await getDocumentProxy(new Uint8Array(buffer));
    const { text } = await extractText(pdf, { mergePages: true });
    return text;
  } catch (err) {
    console.warn(
      `[293857-soni] PDF 取得失敗: ${pdfUrl}`,
      err instanceof Error ? err.message : err
    );
    return null;
  }
}

/**
 * PDF をダウンロード・テキスト抽出し、MeetingData に変換する。
 */
export async function fetchMeetingData(
  meeting: SoniMeeting,
  municipalityId: string
): Promise<MeetingData | null> {
  const text = await fetchPdfText(meeting.pdfUrl);
  if (!text) return null;

  const statements = parseStatements(text);
  if (statements.length === 0) return null;

  // 開催日は PDF 本文から抽出
  const heldOn = extractHeldOn(text);
  if (!heldOn) {
    console.warn(`[293857-soni] 開催日の抽出失敗: ${meeting.pdfUrl}`);
    return null;
  }

  // タイトルは PDF 本文から取得。フォールバックは会議名 + リンクテキスト
  const fallbackTitle = meeting.sessionName
    ? `${meeting.sessionName} ${meeting.linkText}`
    : meeting.linkText;
  const title = extractTitle(text, fallbackTitle);

  // ファイル名をベースにした外部 ID
  const fileMatch = meeting.pdfUrl.match(/\/([^/]+)\.pdf$/);
  const externalId = fileMatch ? `soni_${fileMatch[1]}` : null;

  return {
    municipalityId,
    title,
    meetingType: detectMeetingType(meeting.sessionName || title),
    heldOn,
    sourceUrl: meeting.pdfUrl,
    externalId,
    statements,
  };
}
