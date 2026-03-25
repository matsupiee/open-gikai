/**
 * 能登町議会 — detail フェーズ
 *
 * PDF をダウンロードしてテキストを抽出し、「役職（氏名）」マーカーで
 * 発言を分割して ParsedStatement 配列を生成する。
 *
 * 能登町の PDF は ○ マーカーなしで「議長（金七祐太郎）」形式を使用。
 */

import { createHash } from "node:crypto";
import { extractText, getDocumentProxy } from "unpdf";
import type { MeetingData, ParsedStatement } from "../../../utils/types";
import type { NotoMeeting } from "./list";
import { detectMeetingType, extractExternalIdKey, fetchBinary } from "./shared";

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

/**
 * 発言ヘッダーから発言者情報を抽出する。
 *
 * 能登町 PDF の形式:
 *   「議長（金七祐太郎）」    -> role=議長, name=金七祐太郎
 *   「町長（大森凡世）」      -> role=町長, name=大森凡世
 *   「６番（金七祐太郎）」    -> role=議員, name=金七祐太郎
 *   「総務課長（蔭田大介）」  -> role=課長, name=蔭田大介
 *
 * ○ マーカー形式にも対応:
 *   「○議長（山田太郎君）」  -> role=議長, name=山田太郎
 */
export function parseSpeaker(text: string): {
  speakerName: string | null;
  speakerRole: string | null;
  content: string;
} {
  // ○ マーカーがある場合は除去
  const stripped = text.replace(/^[○◯◎●]\s*/, "");

  // パターン: role（name + 君|様|議員）content または role（name）content
  const match = stripped.match(
    /^(.+?)[（(](.+?)(?:君|様|議員)?[）)]\s*([\s\S]*)/
  );
  if (match) {
    const rolePart = match[1]!.trim();
    const rawName = match[2]!.replace(/[\s　]+/g, "").trim();
    const content = match[3]!.trim();

    // 番号付き議員: ６番（金七祐太郎）
    if (/^[\d０-９]+番$/.test(rolePart)) {
      return { speakerName: rawName, speakerRole: "議員", content };
    }

    // 役職マッチ（長いもの優先）
    for (const suffix of ROLE_SUFFIXES) {
      if (rolePart === suffix || rolePart.endsWith(suffix)) {
        return { speakerName: rawName, speakerRole: suffix, content };
      }
    }

    // 役職が特定できない場合もそのまま返す
    return { speakerName: rawName, speakerRole: rolePart || null, content };
  }

  // ヘッダーパターンに合致しない
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
 *
 * 能登町の形式:「議長（氏名）　発言内容」で発言が続く。
 * ○ マーカー形式と「役職（氏名）」形式の両方に対応する。
 */
export function parseStatements(text: string): ParsedStatement[] {
  // ○ マーカー形式の場合
  const hasMarkers = /[○◯◎●]/.test(text);

  if (hasMarkers) {
    return parseStatementsWithMarkers(text);
  }

  return parseStatementsNoMarkers(text);
}

/**
 * ○ マーカー付き形式のパース（旧形式 PDF 対応）
 */
function parseStatementsWithMarkers(text: string): ParsedStatement[] {
  const blocks = text.split(/(?=[○◯◎●])/);
  const statements: ParsedStatement[] = [];
  let offset = 0;

  for (const block of blocks) {
    const trimmed = block.trim();
    if (!trimmed || !/^[○◯◎●]/.test(trimmed)) continue;

    // ト書き（登壇等）をスキップ
    if (/^[○◯◎●]\s*[（(].+?(?:登壇|退席|退場|着席)[）)]$/.test(trimmed))
      continue;

    // 議事録ヘッダーをスキップ
    if (
      /^[○◯◎●]\s*(?:出席|欠席|説明|事務局|職務|議事日程|本日の会議|会議|地方自治法|開議|散会|閉会|休憩|再開|日程|開会)/.test(
        trimmed
      )
    )
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
 * ○ マーカーなし形式のパース（能登町 PDF 形式）。
 *
 * 「役職（氏名）　発言内容」の繰り返しで構成されている。
 * テキストは mergePages: true でフラットな文字列として渡される。
 */
function parseStatementsNoMarkers(text: string): ParsedStatement[] {
  // CJK 文字（漢字・仮名）のみで構成された役職名 or 番号議員にマッチ
  const rolePattern = ROLE_SUFFIXES.join("|");
  const speakerRegex = new RegExp(
    `([\\u4e00-\\u9fff\\u3041-\\u30ff]{0,15}?(?:${rolePattern})|[\\d０-９]+番)[（(]([^）)]{1,20})[）)]`,
    "g"
  );

  const segments: Array<{
    role: string;
    name: string;
    start: number;
    end: number;
  }> = [];

  for (const m of text.matchAll(speakerRegex)) {
    const rolePart = m[1]!.trim();
    const namePart = m[2]!.replace(/[\s　]+/g, "").trim();
    // 名前に数字・英字のみは除外（議事番号等）
    if (!namePart || /^[\d\w]+$/.test(namePart)) continue;
    // 名前が長すぎる場合は除外
    if (namePart.length > 20) continue;
    segments.push({
      role: rolePart,
      name: namePart,
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

    // 発言内容は今のセグメント終わりから次のセグメント開始まで
    const contentEnd = nextSeg ? nextSeg.start : text.length;
    const rawContent = text.substring(seg.end, contentEnd).trim();

    // 空またはごく短いコンテンツはスキップ
    if (!rawContent || rawContent.length < 2) continue;

    // スペース・改行を正規化
    const content = rawContent.replace(/\s+/g, " ").trim();
    if (!content) continue;

    // 役職を分類
    let speakerRole: string | null = null;
    let speakerName: string | null = seg.name;

    const rolePart = seg.role;
    if (/^[\d０-９]+番$/.test(rolePart)) {
      speakerRole = "議員";
    } else {
      for (const suffix of ROLE_SUFFIXES) {
        if (rolePart === suffix || rolePart.endsWith(suffix)) {
          speakerRole = suffix;
          break;
        }
      }
      if (!speakerRole) speakerRole = rolePart || null;
    }

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
      `[174637-noto] PDF 取得失敗: ${pdfUrl}`,
      err instanceof Error ? err.message : err
    );
    return null;
  }
}

/**
 * PDF をダウンロード・テキスト抽出し、MeetingData に変換する。
 */
export async function fetchMeetingData(
  meeting: NotoMeeting,
  municipalityId: string
): Promise<MeetingData | null> {
  const text = await fetchPdfText(meeting.pdfUrl);
  if (!text) return null;

  const statements = parseStatements(text);
  if (statements.length === 0) return null;

  const idKey = extractExternalIdKey(new URL(meeting.pdfUrl).pathname);
  const externalId = idKey ? `noto_${idKey}` : null;

  // heldOn が null の場合は null を返す（"1970-01-01" 禁止）
  if (!meeting.heldOn) return null;

  return {
    municipalityId,
    title: meeting.title,
    meetingType: detectMeetingType(meeting.session),
    heldOn: meeting.heldOn,
    sourceUrl: meeting.pdfUrl,
    externalId,
    statements,
  };
}
