/**
 * 新地町議会 会議録 — detail フェーズ
 *
 * PDF をダウンロードしてテキストを抽出し、○ マーカーで発言を分割して
 * ParsedStatement 配列を生成する。
 *
 * PDF内の発言者パターン:
 *   ○遠藤　満議長               → role=議長, name=遠藤満
 *   ○大堀　武町長               → role=町長, name=大堀武
 *   ○佐藤武志事務局長           → role=事務局長, name=佐藤武志
 *   ○１番大内広行議員           → role=議員, name=大内広行
 *
 * 登壇表記（スキップ対象）:
 *   〔大堀　武町長登壇〕
 *   〔１番　大内広行議員登壇〕（拍手）
 *
 * 議場の反応（スキップ対象）:
 *   〔「異議なし」と言う人あり〕
 */

import { createHash } from "node:crypto";
import { extractText, getDocumentProxy } from "../../../utils/pdf";
import type { MeetingData, ParsedStatement } from "../../../utils/types";
import type { ShinchiMeeting } from "./list";
import {
  detectMeetingType,
  fetchBinary,
  parseJapaneseDate,
} from "./shared";

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
  "副部長",
  "部長",
  "副課長",
  "課長",
  "室長",
  "局長",
  "係長",
  "参事",
  "主幹",
  "代表監査委員",
  "監査委員",
  "会計管理者",
  "議員",
  "委員",
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
  "係長",
  "参事",
  "主幹",
  "事務局長",
  "代表監査委員",
  "監査委員",
  "会計管理者",
]);

/**
 * ○ マーカー付きの発言ヘッダーから発言者情報を抽出する。
 *
 * 対応パターン:
 *   ○遠藤　満議長               → role=議長, name=遠藤満
 *   ○大堀　武町長               → role=町長, name=大堀武
 *   ○佐藤武志事務局長           → role=事務局長, name=佐藤武志
 *   ○１番大内広行議員           → role=議員, name=大内広行
 */
export function parseSpeaker(text: string): {
  speakerName: string | null;
  speakerRole: string | null;
  content: string;
} {
  const stripped = text.replace(/^[○◯◎●]\s*/, "");

  // パターン1: {number}番{name}議員 content (e.g., ○１番大内広行議員 ...)
  const memberPattern = stripped.match(
    /^[\d０-９]+番\s*(.+?)議員[\s　]+([\s\S]*)/,
  );
  if (memberPattern) {
    const name = memberPattern[1]!.trim().replace(/[\s　]+/g, "");
    const content = memberPattern[2]!.trim();
    return { speakerName: name, speakerRole: "議員", content };
  }

  // パターン2: {name}{role}　content (e.g., ○遠藤　満議長　... , ○大堀　武町長　...)
  // 全角スペースで区切られたヘッダー部（姓 名+役職）と本文を分離する。
  // 役職サフィックスを先に探索し、役職を含む最短のヘッダーを特定する。
  for (const suffix of ROLE_SUFFIXES) {
    // 役職サフィックスを含む位置を探す
    const suffixPos = stripped.indexOf(suffix);
    if (suffixPos === -1) continue;

    const headerCandidate = stripped.slice(0, suffixPos + suffix.length);
    const afterHeader = stripped.slice(suffixPos + suffix.length);

    // 役職の直後にスペースまたは文末でなければスキップ（別の単語の一部の可能性）
    if (afterHeader.length > 0 && !/^[\s　]/.test(afterHeader)) continue;

    // ヘッダー候補から全角スペースを除去して名前と役職を分離
    const headerNoSpace = headerCandidate.replace(/[\s　]/g, "");

    if (!headerNoSpace.endsWith(suffix)) continue;

    const nameStr =
      headerNoSpace.length > suffix.length
        ? headerNoSpace.slice(0, -suffix.length)
        : null;

    const content = afterHeader.trim();
    return { speakerName: nameStr || null, speakerRole: suffix, content };
  }

  // 役職が見つからない場合: 最初のスペースまでを名前として扱う
  const fallbackMatch = stripped.match(/^([^\s　]+)[\s　]+([\s\S]*)/);
  if (fallbackMatch && /^[○◯◎●]/.test(text)) {
    const name = fallbackMatch[1]!;
    const content = fallbackMatch[2]!.trim();
    return { speakerName: name, speakerRole: null, content };
  }

  return { speakerName: null, speakerRole: null, content: stripped.trim() };
}

/** 役職から発言種別を分類 */
export function classifyKind(speakerRole: string | null): "remark" | "question" | "answer" {
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

    // ト書き（登壇・退席等）をスキップ
    if (/^[○◯◎●]\s*[〔（(].+?(?:登壇|退席|退場|着席)[）)〕]/.test(trimmed)) continue;

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
      `[075612-shinchi] PDF 取得失敗: ${pdfUrl}`,
      err instanceof Error ? err.message : err,
    );
    return null;
  }
}

/**
 * 会議録 PDF をダウンロード・テキスト抽出し、MeetingData に変換する。
 */
export async function fetchMeetingData(
  meeting: ShinchiMeeting,
  municipalityCode: string,
): Promise<MeetingData | null> {
  const text = await fetchPdfText(meeting.pdfUrl);
  if (!text) return null;

  const statements = parseStatements(text);
  if (statements.length === 0) return null;

  // PDF テキストから開催日を抽出
  const heldOn = parseJapaneseDate(text);

  // heldOn が解析できない場合は null を返す（"1970-01-01" 禁止）
  if (!heldOn) return null;

  const externalId = `shinchi_${meeting.fileName.replace(".pdf", "")}`;

  return {
    municipalityCode,
    title: meeting.title,
    meetingType: detectMeetingType(meeting.title),
    heldOn,
    sourceUrl: meeting.pdfUrl,
    externalId,
    statements,
  };
}
