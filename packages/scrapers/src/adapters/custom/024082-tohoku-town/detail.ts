/**
 * 東北町議会 — detail フェーズ
 *
 * PDF をダウンロードしてテキストを抽出し、○ マーカーで発言を分割して
 * ParsedStatement 配列を生成する。
 *
 * 発言フォーマット（想定）:
 *   ○議長（山田太郎君）　それでは、ただいまから会議を開きます。
 *   ○町長（佐藤次郎君）　お答えいたします。
 *   ○１番（鈴木花子君）　質問いたします。
 */

import { createHash } from "node:crypto";
import { extractText, getDocumentProxy } from "../../../utils/pdf";
import type { MeetingData, ParsedStatement } from "../../../utils/types";
import type { TohokuRecord } from "./list";
import { fetchBinary, normalizePdfText, parseJapaneseDate } from "./shared";

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
  "副部長",
  "部長",
  "副課長",
  "課長",
  "室長",
  "議員",
  "委員",
  "係長",
  "参事",
  "主幹",
  "主査",
  "補佐",
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
 * ○ マーカー付きの発言ヘッダーから発言者情報を抽出する。
 *
 * 対応パターン:
 *   ○議長（山田太郎君）　→ role=議長, name=山田太郎
 *   ○町長（佐藤次郎君）　→ role=町長, name=佐藤次郎
 *   ○１番（鈴木花子君）　→ role=議員, name=鈴木花子
 *   ○教育長（田中一郎君）→ role=教育長, name=田中一郎
 */
export function parseSpeaker(text: string): {
  speakerName: string | null;
  speakerRole: string | null;
  content: string;
} {
  const stripped = text.replace(/^[○◯◎●]\s*/, "");

  // パターン: role（name + 君|様|議員）content
  const match = stripped.match(
    /^(.+?)[（(](.+?)(?:君|様|議員)[）)]\s*([\s\S]*)/,
  );
  if (match) {
    const rolePart = match[1]!.trim();
    const rawName = match[2]!.replace(/[\s　]+/g, "").trim();
    const content = match[3]!.trim();

    // 番号付き議員: ○３番（鈴木花子君）
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
  speakerRole: string | null,
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
 * テキストから目次・前文部分を除去して本文（議事録）のみを返す。
 * 本文は「○議長」で始まる。目次内の「○議長」は直後に「……」が続くため区別できる。
 */
export function stripToc(text: string): string {
  let pos = 0;
  while (true) {
    const idx = text.indexOf("○議長", pos);
    if (idx === -1) break;

    // ○議長 から次の ○ マーカー（または 200 文字先）までのテキストを取得
    const nextMarker = text.indexOf("○", idx + 3);
    const blockEnd =
      nextMarker !== -1 ? nextMarker : Math.min(text.length, idx + 200);
    const block = text.substring(idx, blockEnd);

    // 目次エントリは「……」を含む。本文の発言には含まれない
    if (!block.includes("……")) {
      return text.substring(idx);
    }
    pos = idx + 1;
  }

  // ○議長 が見つからない場合はそのまま返す
  return text;
}

/**
 * PDF から抽出したテキストを ParsedStatement 配列に変換する。
 */
export function parseStatements(text: string): ParsedStatement[] {
  // 目次部分を除去して本文のみを対象にする
  const bodyText = stripToc(text);
  const blocks = bodyText.split(/(?=[○◯◎●])/);
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
 * PDF URL からテキストを取得し、正規化して返す。
 */
async function fetchPdfText(pdfUrl: string): Promise<string | null> {
  try {
    const buffer = await fetchBinary(pdfUrl);
    if (!buffer) return null;

    const pdf = await getDocumentProxy(new Uint8Array(buffer));
    const { text } = await extractText(pdf, { mergePages: true });
    return normalizePdfText(text);
  } catch (err) {
    console.warn(
      `[024082-tohoku-town] PDF 取得失敗: ${pdfUrl}`,
      err instanceof Error ? err.message : err,
    );
    return null;
  }
}

/**
 * PDF をダウンロード・テキスト抽出し、MeetingData に変換する。
 */
export async function fetchMeetingData(
  meeting: TohokuRecord,
  municipalityCode: string,
): Promise<MeetingData | null> {
  const text = await fetchPdfText(meeting.pdfUrl);
  if (!text) return null;

  // PDF テキストから開催日を抽出する
  const heldOn = parseJapaneseDate(text);
  // heldOn が解析できない場合は null を返す
  if (!heldOn) return null;

  const statements = parseStatements(text);
  if (statements.length === 0) return null;

  // PDF ファイル名から externalId を生成
  const filenameMatch = meeting.pdfUrl.match(/([^/]+)\.pdf$/i);
  const externalId = filenameMatch
    ? `tohoku_${filenameMatch[1]}`
    : null;

  return {
    municipalityCode,
    title: `${meeting.session}定例会(一般質問)${meeting.speakerName}議員`,
    meetingType: "plenary",
    heldOn,
    sourceUrl: meeting.pdfUrl,
    externalId,
    statements,
  };
}
