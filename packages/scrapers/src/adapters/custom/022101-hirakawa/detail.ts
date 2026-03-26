/**
 * 平川市議会 — detail フェーズ
 *
 * PDF をダウンロードしてテキストを抽出し、〇/○ マーカーで発言を分割して
 * ParsedStatement 配列を生成する。
 *
 * 発言フォーマット:
 *   〇議長（石田隆芳議員）　皆さん、おはようございます。
 *   〇２番（葛西厚平議員）　質問いたします。
 *   〇教育長（須々田孝聖）　お答えいたします。
 *   〇教育委員会事務局長（工藤伸吾）　説明いたします。
 *   〇健康福祉部長（佐藤 崇）　お答えいたします。
 *   〇市長職務代理者副市長（古川洋文）　お答えいたします。
 *
 * マーカー: 〇 (U+3007) と ○ (U+25CB) が混在
 * 敬称: 「議員」（議員の場合）/ なし（行政職の場合）
 */

import { createHash } from "node:crypto";
import { extractText, getDocumentProxy } from "../../../utils/pdf";
import type { MeetingData, ParsedStatement } from "../../../utils/types";
import type { HirakawaMeeting } from "./list";
import { detectMeetingType, fetchBinary } from "./shared";

// 役職サフィックス（長い方を先に置いて誤マッチを防ぐ）
const ROLE_SUFFIXES = [
  "副委員長",
  "委員長",
  "副議長",
  "議長",
  "副市長",
  "市長",
  "副教育長",
  "教育長",
  "事務局長",
  "局長",
  "副部長",
  "部長",
  "副課長",
  "課長",
  "事務長",
  "係長",
  "室長",
  "参事",
  "主幹",
  "主査",
  "会長",
  "管理者",
  "議員",
  "委員",
];

// 行政側の役職（答弁者として分類する）
const ANSWER_ROLES = new Set([
  "市長",
  "副市長",
  "教育長",
  "副教育長",
  "部長",
  "副部長",
  "課長",
  "副課長",
  "事務局長",
  "局長",
  "事務長",
  "係長",
  "室長",
  "参事",
  "主幹",
  "主査",
  "会長",
  "管理者",
]);

/**
 * 〇/○ マーカー付きの発言ヘッダーから発言者情報を抽出する。
 *
 * 対応パターン:
 *   〇議長（石田隆芳議員）→ role=議長, name=石田隆芳
 *   〇２番（葛西厚平議員）→ role=議員, name=葛西厚平
 *   〇教育長（須々田孝聖）→ role=教育長, name=須々田孝聖
 *   〇教育委員会事務局長（工藤伸吾）→ role=事務局長, name=工藤伸吾
 *   〇健康福祉部長（佐藤 崇）→ role=部長, name=佐藤崇
 *   〇市長職務代理者副市長（古川洋文）→ role=副市長, name=古川洋文
 */
export function parseSpeaker(text: string): {
  speakerName: string | null;
  speakerRole: string | null;
  content: string;
} {
  const stripped = text.replace(/^[○〇◯◎●]\s*/, "");

  // パターン1: role（name + 議員）content — 議員の場合
  const matchGiin = stripped.match(
    /^(.+?)[（(](.+?)議員[）)]\s*([\s\S]*)/
  );
  if (matchGiin) {
    const rolePart = matchGiin[1]!.trim();
    const rawName = matchGiin[2]!.replace(/[\s　]+/g, "").trim();
    const content = matchGiin[3]!.trim();

    // 番号付き議員: 〇２番（葛西厚平議員）
    if (/^[\d０-９]+番$/.test(rolePart)) {
      return { speakerName: rawName, speakerRole: "議員", content };
    }

    // 議長・副議長（名前議員）パターン
    for (const suffix of ROLE_SUFFIXES) {
      if (rolePart === suffix || rolePart.endsWith(suffix)) {
        return { speakerName: rawName, speakerRole: suffix, content };
      }
    }

    return { speakerName: rawName, speakerRole: rolePart || null, content };
  }

  // パターン2: role（name）content — 行政職の場合（敬称なし）
  const matchAdmin = stripped.match(
    /^(.+?)[（(](.+?)[）)]\s*([\s\S]*)/
  );
  if (matchAdmin) {
    const rolePart = matchAdmin[1]!.trim();
    const rawName = matchAdmin[2]!.replace(/[\s　]+/g, "").trim();
    const content = matchAdmin[3]!.trim();

    for (const suffix of ROLE_SUFFIXES) {
      if (rolePart === suffix || rolePart.endsWith(suffix)) {
        return { speakerName: rawName, speakerRole: suffix, content };
      }
    }

    return { speakerName: rawName, speakerRole: rolePart || null, content };
  }

  // マーカーはあるがカッコパターンに合致しない場合
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
 * 発言マーカーが議事日程等の構造行か判定する。
 * ○議事日程, ○本日の会議に付した事件, ○出席議員, ○欠席議員 等はスキップ。
 */
function isStructuralLine(text: string): boolean {
  const stripped = text.replace(/^[○〇◯◎●]\s*/, "");
  return /^(議事日程|本日の会議|出席議員|欠席議員|出席事務局|地方自治法)/.test(
    stripped
  );
}

/**
 * PDF から抽出したテキストを ParsedStatement 配列に変換する。
 */
export function parseStatements(text: string): ParsedStatement[] {
  // 〇 (U+3007) と ○ (U+25CB) の両方で分割
  const blocks = text.split(/(?=[○〇◯◎●])/);
  const statements: ParsedStatement[] = [];
  let offset = 0;

  for (const block of blocks) {
    const trimmed = block.trim();
    if (!trimmed || !/^[○〇◯◎●]/.test(trimmed)) continue;

    // 議事日程等の構造行はスキップ
    if (isStructuralLine(trimmed)) continue;

    // ト書き（登壇・移動等）をスキップ
    if (
      /^[○〇◯◎●]\s*[（(].+?(?:登壇|退席|退場|着席|移動)[）)]/.test(trimmed)
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
      `[022101-hirakawa] PDF 取得失敗: ${pdfUrl}`,
      err instanceof Error ? err.message : err
    );
    return null;
  }
}

/**
 * PDF ファイル名から externalId 用のキーを抽出する。
 * e.g., "files/0704_teirei_kaigiroku_1204.pdf" → "0704_teirei_kaigiroku_1204"
 */
function extractExternalIdKey(pdfPath: string): string | null {
  const match = pdfPath.match(/\/([^/]+)\.pdf$/i);
  if (!match) return null;
  return match[1]!;
}

/**
 * PDF をダウンロード・テキスト抽出し、MeetingData に変換する。
 */
export async function fetchMeetingData(
  meeting: HirakawaMeeting,
  municipalityCode: string
): Promise<MeetingData | null> {
  const text = await fetchPdfText(meeting.pdfUrl);
  if (!text) return null;

  const statements = parseStatements(text);
  if (statements.length === 0) return null;

  const idKey = extractExternalIdKey(new URL(meeting.pdfUrl).pathname);
  const externalId = idKey ? `hirakawa_${idKey}` : null;

  return {
    municipalityCode,
    title: meeting.title,
    meetingType: detectMeetingType(meeting.section),
    heldOn: meeting.heldOn,
    sourceUrl: meeting.pdfUrl,
    externalId,
    statements,
  };
}
