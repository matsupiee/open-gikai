/**
 * 大島町議会 — detail フェーズ
 *
 * PDF をダウンロードしてテキストを抽出し、○ マーカーで発言を分割して
 * ParsedStatement 配列を生成する。
 *
 * 注意: 大島町の PDF はスキャン画像のためテキストレイヤーがなく、
 * unpdf によるテキスト抽出が失敗するか空文字列になる。
 * その場合は statements が空になり、fetchMeetingData は null を返す。
 *
 * 発言フォーマット（テキスト化できた場合）:
 *   ○議長（山田太郎君）　ただいまから会議を開きます。
 *   ○町長（佐藤花子君）　お答えいたします。
 *   ○１番（鈴木一郎君）　質問いたします。
 */

import { createHash } from "node:crypto";
import { extractText, getDocumentProxy } from "unpdf";
import type { MeetingData, ParsedStatement } from "../../../utils/types";
import type { OshimaMeeting } from "./list";
import { detectMeetingType, fetchBinary } from "./shared";

// 役職サフィックス（長い方を先に置いて誤マッチを防ぐ）
const ROLE_SUFFIXES = [
  "副委員長",
  "委員長",
  "副議長",
  "議長",
  "副町長",
  "町長",
  "副教育長",
  "教育長",
  "事務局長",
  "局長",
  "課長補佐",
  "副参事",
  "参事",
  "副部長",
  "部長",
  "副課長",
  "課長",
  "係長",
  "主幹",
  "主査",
  "議員",
  "委員",
];

// 行政側の役職（答弁者として分類する）
const ANSWER_ROLES = new Set([
  "町長",
  "副町長",
  "教育長",
  "副教育長",
  "事務局長",
  "局長",
  "部長",
  "副部長",
  "課長",
  "副課長",
  "課長補佐",
  "参事",
  "副参事",
  "係長",
  "主幹",
  "主査",
]);

/**
 * ○ マーカー付きの発言ヘッダーから発言者情報を抽出する。
 *
 * 対応パターン:
 *   ○議長（山田太郎君）　→ role=議長, name=山田太郎
 *   ○町長（佐藤花子君）　→ role=町長, name=佐藤花子
 *   ○１番（鈴木一郎君）　→ role=議員, name=鈴木一郎
 *   ○総務課長（田中次郎君）→ role=課長, name=田中次郎
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

    // 番号付き議員: ○１番（鈴木一郎君）
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

    // ◎ は議事項目見出し → スキップ
    if (/^[◎]/.test(trimmed)) continue;

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
 * PDF URL からテキストを取得する。
 * スキャン PDF の場合はテキストレイヤーがないため空文字列または null になる。
 */
async function fetchPdfText(pdfUrl: string): Promise<string | null> {
  try {
    const buffer = await fetchBinary(pdfUrl);
    if (!buffer) return null;

    const pdf = await getDocumentProxy(new Uint8Array(buffer));
    const { text } = await extractText(pdf, { mergePages: true });
    return text;
  } catch (err) {
    console.warn(
      `[133612-oshima] PDF 取得失敗: ${pdfUrl}`,
      err instanceof Error ? err.message : err
    );
    return null;
  }
}

/**
 * PDF attachment ID から externalId を生成する。
 * e.g., "/uploaded/attachment/12345.pdf" → "oshima_12345"
 */
function extractExternalId(pdfUrl: string): string | null {
  const match = pdfUrl.match(/\/uploaded\/attachment\/(\d+)\.pdf$/i);
  if (!match) return null;
  return `oshima_${match[1]}`;
}

/**
 * 開催月から開催日付を推定する（日は 1 日で固定）。
 * 月が不明の場合は null を返す。
 */
export function buildHeldOn(year: number, month: number | null): string | null {
  if (!month) return null;
  return `${year}-${String(month).padStart(2, "0")}-01`;
}

/**
 * PDF をダウンロード・テキスト抽出し、MeetingData に変換する。
 * スキャン PDF のためテキスト抽出が空の場合は null を返す。
 */
export async function fetchMeetingData(
  meeting: OshimaMeeting,
  municipalityId: string
): Promise<MeetingData | null> {
  const heldOn = buildHeldOn(meeting.year, meeting.month);
  if (!heldOn) return null;

  const text = await fetchPdfText(meeting.pdfUrl);
  if (!text) return null;

  const statements = parseStatements(text);
  if (statements.length === 0) return null;

  const externalId = extractExternalId(meeting.pdfUrl);

  return {
    municipalityId,
    title: meeting.title,
    meetingType: detectMeetingType(meeting.title),
    heldOn,
    sourceUrl: meeting.pdfUrl,
    externalId,
    statements,
  };
}
