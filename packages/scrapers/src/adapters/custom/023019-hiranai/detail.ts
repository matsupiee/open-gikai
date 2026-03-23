/**
 * 平内町議会 — detail フェーズ
 *
 * PDF をダウンロードしてテキストを抽出し、○ マーカーで発言を分割して
 * ParsedStatement 配列を生成する。
 *
 * 平内町の PDF は SMART CMS 経由で公開されており、PDF テキスト内の発言フォーマットは
 * 一般的な議事録形式:
 *   ○議長（工藤 雄次君）　ただいまから会議を開きます。
 *   ○町長（蛯名 正樹君）　お答えいたします。
 *   ○５番（山田 太郎君）　質問いたします。
 */

import { createHash } from "node:crypto";
import { extractText, getDocumentProxy } from "unpdf";
import type { MeetingData, ParsedStatement } from "../../../utils/types";
import type { HiranaiMeeting } from "./list";
import { detectMeetingType, eraToWestern, fetchBinary } from "./shared";

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
  "参事",
  "主幹",
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
  "参事",
  "主幹",
]);

/**
 * ○ マーカー付きの発言ヘッダーから発言者情報を抽出する。
 *
 * 対応パターン:
 *   ○議長（工藤 雄次君）　→ role=議長, name=工藤雄次
 *   ○町長（蛯名 正樹君）　→ role=町長, name=蛯名正樹
 *   ○５番（山田 太郎君）　→ role=議員, name=山田太郎
 *   ○議員（５番 山田 太郎君）→ role=議員, name=山田太郎
 *   ○総務課長（田中 一郎君）→ role=課長, name=田中一郎
 */
export function parseSpeaker(text: string): {
  speakerName: string | null;
  speakerRole: string | null;
  content: string;
} {
  const stripped = text.replace(/^[○◯◎●]\s*/, "");

  // パターン: role（name + 君|様）content
  const match = stripped.match(/^(.+?)[（(](.+?)(?:君|様)[）)]\s*([\s\S]*)/);
  if (match) {
    const rolePart = match[1]!.trim();
    const nameRaw = match[2]!.trim();
    const content = match[3]!.trim();

    // 議員パターン: ○議員（８番 山田 太郎君）→ 番号を除去、名前のスペースを除去
    if (rolePart === "議員") {
      const memberMatch = nameRaw.match(/^[\d０-９]+番[\s　]+(.+)/);
      const name = memberMatch
        ? memberMatch[1]!.replace(/[\s　]+/g, "")
        : nameRaw.replace(/[\s　]+/g, "");
      return { speakerName: name, speakerRole: "議員", content };
    }

    // 番号付きパターン: ○５番（山田 太郎君）→ 議員として扱う
    if (/^[\d０-９]+番$/.test(rolePart)) {
      const name = nameRaw.replace(/[\s　]+/g, "");
      return { speakerName: name, speakerRole: "議員", content };
    }

    // 役職マッチ
    const name = nameRaw.replace(/[\s　]+/g, "");
    for (const suffix of ROLE_SUFFIXES) {
      if (rolePart === suffix || rolePart.endsWith(suffix)) {
        return { speakerName: name, speakerRole: suffix, content };
      }
    }

    return { speakerName: name, speakerRole: rolePart || null, content };
  }

  // ○ マーカーはあるがカッコパターンに合致しない場合
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
  // endsWith で複合役職名もチェック
  for (const role of ANSWER_ROLES) {
    if (speakerRole.endsWith(role)) return "answer";
  }
  return "question";
}

/**
 * PDF テキストを前処理する。
 * - ページ番号（－1－ 等）を除去
 * - 罫線（───）を除去
 */
function preprocessText(text: string): string {
  return text
    .replace(/－\d+－/g, "")
    .replace(/─+/g, "")
    .replace(/\r\n/g, "\n");
}

/**
 * PDF から抽出したテキストを ParsedStatement 配列に変換する。
 */
export function parseStatements(text: string): ParsedStatement[] {
  const cleaned = preprocessText(text);
  const blocks = cleaned.split(/(?=[○◯◎●])/);
  const statements: ParsedStatement[] = [];
  let offset = 0;

  for (const block of blocks) {
    const trimmed = block.trim();
    if (!trimmed || !/^[○◯◎●]/.test(trimmed)) continue;

    // ト書き（登壇等）をスキップ
    if (/^[○◯◎●]\s*[（(].+?(?:登壇|退席|退場|着席)[）)]$/.test(trimmed))
      continue;

    // 改行をスペースに正規化（PDF の改行位置が不規則なため）
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
 * パターン: "令和X年X月X日（X曜日）" or "令和X年XX月XX日"
 *
 * 全角数字にも対応する。
 */
export function parseDateFromPdfText(text: string): string | null {
  // 全角数字を半角に変換
  const normalized = text.replace(/[０-９]/g, (ch) =>
    String.fromCharCode(ch.charCodeAt(0) - 0xfee0),
  );

  const match = normalized.match(/(令和|平成)(元|\d+)年(\d+)月(\d+)日/);
  if (!match) return null;

  const westernYear = eraToWestern(match[1]!, match[2]!);
  if (!westernYear) return null;

  const month = Number(match[3]);
  const day = Number(match[4]);

  return `${westernYear}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
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
      `[023019-hiranai] PDF 取得失敗: ${pdfUrl}`,
      err instanceof Error ? err.message : err,
    );
    return null;
  }
}

/**
 * PDF をダウンロード・テキスト抽出し、MeetingData に変換する。
 */
export async function fetchMeetingData(
  meeting: HiranaiMeeting,
  municipalityId: string,
): Promise<MeetingData | null> {
  const text = await fetchPdfText(meeting.pdfUrl);
  if (!text) return null;

  const statements = parseStatements(text);
  if (statements.length === 0) return null;

  // PDF テキストから開催日を抽出
  const heldOn = parseDateFromPdfText(text);
  if (!heldOn) return null;

  // externalId: PDF URL のパスから一意キーを生成
  const urlPath = new URL(meeting.pdfUrl).pathname;
  const fileName = urlPath.split("/").pop()?.replace(/\.pdf$/i, "") ?? "";
  const externalId = fileName
    ? `hiranai_${fileName}`
    : `hiranai_${createHash("md5").update(meeting.pdfUrl).digest("hex").slice(0, 12)}`;

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
