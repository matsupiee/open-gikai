/**
 * 津幡町議会 — detail フェーズ
 *
 * PDF をダウンロードしてテキストを抽出し、発言者マーカーで
 * 発言を分割して ParsedStatement 配列を生成する。
 *
 * 津幡町 PDF の発言形式:
 *   「福田一郎議長 ただ今の出席議員は...」  -> name=福田一郎, role=議長
 *   「山田太郎町長 お答えします。」          -> name=山田太郎, role=町長
 *   「鈴木花子議員 質問があります。」        -> name=鈴木花子, role=議員
 */

import { createHash } from "node:crypto";
import { extractText, getDocumentProxy } from "unpdf";
import type { MeetingData, ParsedStatement } from "../../../utils/types";
import type { TsubataMeeting } from "./list";
import { detectMeetingType, fetchBinary } from "./shared";

// 役職サフィックス（長いものを先に置いて誤マッチを防ぐ）
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
  "室長",
  "係長",
  "参事",
  "主幹",
  "主査",
  "補佐",
]);

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
 * 役職サフィックスを抽出して名前と役職に分割する。
 *
 * 入力例: "福田一郎議長" -> { name: "福田一郎", role: "議長" }
 * 入力例: "山田太郎副町長" -> { name: "山田太郎", role: "副町長" }
 */
export function splitNameAndRole(
  token: string
): { name: string; role: string } | null {
  for (const suffix of ROLE_SUFFIXES) {
    const idx = token.lastIndexOf(suffix);
    if (idx !== -1 && idx + suffix.length === token.length) {
      const name = token.substring(0, idx).trim();
      if (name.length >= 2 && name.length <= 10) {
        return { name, role: suffix };
      }
    }
  }
  return null;
}

/**
 * PDF から抽出したテキストを ParsedStatement 配列に変換する。
 *
 * 津幡町の形式: 「{名前}{役職} 発言内容」の繰り返し。
 * スペース（半角/全角）で区切られたトークンが発言者マーカーとなる。
 */
export function parseStatements(text: string): ParsedStatement[] {
  // 発言者マーカーのパターン: CJK文字{2,10}に役職サフィックスが付くもの
  const rolePattern = ROLE_SUFFIXES.join("|");
  const speakerRegex = new RegExp(
    `([\\u4e00-\\u9fff\\u3041-\\u30ff]{2,15}(?:${rolePattern}))[ 　]`,
    "g"
  );

  const segments: Array<{
    name: string;
    role: string;
    start: number;
    end: number;
  }> = [];

  for (const m of text.matchAll(speakerRegex)) {
    const token = m[1]!.trim();
    const parsed = splitNameAndRole(token);
    if (!parsed) continue;
    if (parsed.name.length < 2 || parsed.name.length > 10) continue;
    segments.push({
      name: parsed.name,
      role: parsed.role,
      start: m.index!,
      end: m.index! + m[0]!.length,
    });
  }

  if (segments.length === 0) return [];

  const statements: ParsedStatement[] = [];
  let offset = 0;

  for (let i = 0; i < segments.length; i++) {
    const seg = segments[i]!;
    const nextSeg = segments[i + 1];

    const contentEnd = nextSeg ? nextSeg.start : text.length;
    const rawContent = text.substring(seg.end, contentEnd).trim();

    if (!rawContent || rawContent.length < 2) continue;

    const content = rawContent.replace(/\s+/g, " ").trim();
    if (!content) continue;

    const contentHash = createHash("sha256").update(content).digest("hex");
    const startOffset = offset;
    const endOffset = offset + content.length;
    statements.push({
      kind: classifyKind(seg.role),
      speakerName: seg.name,
      speakerRole: seg.role,
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
      `[173614-tsubata] PDF 取得失敗: ${pdfUrl}`,
      err instanceof Error ? err.message : err
    );
    return null;
  }
}

/**
 * PDF をダウンロード・テキスト抽出し、MeetingData に変換する。
 */
export async function fetchMeetingData(
  meeting: TsubataMeeting,
  municipalityCode: string
): Promise<MeetingData | null> {
  // heldOn が null の場合は null を返す（"1970-01-01" 禁止）
  if (!meeting.heldOn) return null;

  const text = await fetchPdfText(meeting.pdfUrl);
  if (!text) return null;

  const statements = parseStatements(text);
  if (statements.length === 0) return null;

  // PDF URL から externalId を抽出: /uploaded/attachment/{id}.pdf -> tsubata_{id}
  const idMatch = meeting.pdfUrl.match(/\/uploaded\/attachment\/(\d+)\.pdf$/i);
  const externalId = idMatch ? `tsubata_${idMatch[1]}` : null;

  return {
    municipalityCode,
    title: meeting.title,
    meetingType: detectMeetingType(meeting.title),
    heldOn: meeting.heldOn,
    sourceUrl: meeting.pdfUrl,
    externalId,
    statements,
  };
}
