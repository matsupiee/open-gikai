/**
 * 佐用町議会（兵庫県） -- detail フェーズ
 *
 * PDF をダウンロードしてテキストを抽出し、発言者パターンで分割して
 * ParsedStatement 配列を生成する。
 *
 * 発言フォーマット（佐用町の形式）:
 *   議長（小林裕和君） ただいまの出席議員数は…
 *   町長（庵逧典章君） 皆様、おはようございます。
 *   総務課長（幸田和彦君） ご説明いたします。
 *   〔町長 庵逧典章君 登壇〕  ← ト書き（スキップ）
 */

import { createHash } from "node:crypto";
import { extractText, getDocumentProxy } from "unpdf";
import type { MeetingData, ParsedStatement } from "../../../utils/types";
import { fetchBinary } from "./shared";

export interface SayoDetailParams {
  title: string;
  heldOn: string;
  pdfUrl: string;
  meetingType: string;
  sessionName: string;
}

// 役職サフィックス（長い方を先に配置して誤マッチを防ぐ）
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
  "次長",
  "参事",
  "主幹",
  "主査",
  "補佐",
  "理事",
  "政策監",
  "管理者",
  "支所長",
  "議員",
  "委員",
  "書記",
];

// 行政側の役職（答弁者として分類する）
const ANSWER_ROLES = new Set([
  "町長",
  "副町長",
  "教育長",
  "副教育長",
  "部長",
  "副部長",
  "課長",
  "副課長",
  "室長",
  "局長",
  "事務局長",
  "係長",
  "次長",
  "参事",
  "主幹",
  "主査",
  "補佐",
  "理事",
  "政策監",
  "管理者",
  "支所長",
  "書記",
]);

/**
 * 発言者ヘッダーから発言者情報を抽出する。
 *
 * 対応パターン（佐用町の形式）:
 *   議長（小林裕和君）        → role=議長, name=小林裕和
 *   町長（庵逧典章君）        → role=町長, name=庵逧典章
 *   総務課長（幸田和彦君）    → role=課長, name=幸田和彦
 *   議会事務局長（東口和弘君）→ role=事務局長, name=東口和弘
 *   ３番（大村隼君）          → role=議員, name=大村隼
 */
export function parseSpeaker(text: string): {
  speakerName: string | null;
  speakerRole: string | null;
  content: string;
} {
  // パターン: role（name君） content
  const matchWithParen = text.match(/^(.+?)[（(](.+?)[）)]\s*([\s\S]*)/);
  if (matchWithParen) {
    const rolePart = matchWithParen[1]!.trim();
    // 「君」を除去して名前を取得
    const rawName = matchWithParen[2]!
      .replace(/君$/, "")
      .replace(/[\s　]+/g, "")
      .trim();
    const content = matchWithParen[3]!.trim();

    // 番号付き議員: ○N番（名前君） パターン
    if (/^[\d０-９]+番$/.test(rolePart)) {
      return { speakerName: rawName, speakerRole: "議員", content };
    }

    // 役職マッチ（長い方を先に評価）
    for (const suffix of ROLE_SUFFIXES) {
      if (rolePart === suffix || rolePart.endsWith(suffix)) {
        return { speakerName: rawName, speakerRole: suffix, content };
      }
    }

    return { speakerName: rawName, speakerRole: rolePart || null, content };
  }

  return { speakerName: null, speakerRole: null, content: text.trim() };
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
 * 発言ヘッダーパターンを生成する。
 * 例: "議長（小林裕和君）"、"町長（庵逧典章君）"、"議会事務局長（東口和弘君）"、"３番（大村隼君）"
 */
function buildHeaderPattern(): RegExp {
  const roleSuffixesPattern = ROLE_SUFFIXES.map((s) =>
    s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
  ).join("|");

  // [^（(\\s]* → 役職サフィックスの前に任意の日本語文字（スペース・括弧なし）
  return new RegExp(
    `[^（(\\s]*(?:${roleSuffixesPattern})[（(][^）)]+[）)]|[\\d０-９]+番[（(][^）)]+[）)]`,
    "g"
  );
}

/**
 * PDF から抽出したテキストを ParsedStatement 配列に変換する。
 *
 * 佐用町の発言は `役職（名前君）` の形式で始まる。
 * 〔...〕 はト書きとしてスキップする。
 */
export function parseStatements(text: string): ParsedStatement[] {
  const headerPattern = buildHeaderPattern();

  // 発言ヘッダーの位置を検出してブロックに分割
  const positions: number[] = [];
  let m: RegExpExecArray | null;
  while ((m = headerPattern.exec(text)) !== null) {
    positions.push(m.index);
  }

  if (positions.length === 0) return [];

  // ブロックを抽出
  const blocks: string[] = positions.map((pos, i) => {
    const end =
      i + 1 < positions.length ? positions[i + 1]! : text.length;
    return text.slice(pos, end).trim();
  });

  const statements: ParsedStatement[] = [];
  let offset = 0;

  for (const block of blocks) {
    if (!block) continue;

    // ト書き（〔...〕 のみのブロック）をスキップ
    if (/^〔[^〕]*(?:登壇|退席|退場|着席|一同)[^〕]*〕$/.test(block))
      continue;

    const normalized = block.replace(/\s+/g, " ");
    const { speakerName, speakerRole, content } = parseSpeaker(normalized);
    if (!content) continue;

    // 発言者が特定できない場合はスキップ
    if (!speakerName && !speakerRole) continue;

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
      `[285013-sayo] PDF 取得失敗: ${pdfUrl}`,
      err instanceof Error ? err.message : err
    );
    return null;
  }
}

/**
 * PDF をダウンロード・テキスト抽出し、MeetingData に変換する。
 */
export async function buildMeetingData(
  params: SayoDetailParams,
  municipalityId: string
): Promise<MeetingData | null> {
  const text = await fetchPdfText(params.pdfUrl);
  if (!text) return null;

  const statements = parseStatements(text);
  if (statements.length === 0) return null;

  return {
    municipalityId,
    title: params.title,
    meetingType: params.meetingType,
    heldOn: params.heldOn,
    sourceUrl: params.pdfUrl,
    externalId: `sayo_${params.heldOn}_${params.pdfUrl.split("/").pop()?.replace(".pdf", "") ?? ""}`,
    statements,
  };
}
