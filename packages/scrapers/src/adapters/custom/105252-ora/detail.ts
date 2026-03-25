/**
 * 邑楽町議会（群馬県） — detail フェーズ
 *
 * PDF をダウンロードしてテキストを抽出し、〇 マーカーで発言を分割して
 * ParsedStatement 配列を生成する。
 *
 * 発言フォーマット:
 *   〇松島茂喜議長  ただいまから会議を開きます。
 *   〇14番　松村　潤議員  一般質問いたします。
 *   〇橋本光規町長  お答えいたします。
 */

import { createHash } from "node:crypto";
import { extractText, getDocumentProxy } from "unpdf";
import type { MeetingData, ParsedStatement } from "../../../utils/types";
import type { OraMeeting } from "./list";
import { detectMeetingType, fetchBinary } from "./shared";

// 役職サフィックス（長い方を先に置いて誤マッチを防ぐ）
const ROLE_SUFFIXES = [
  "副委員長",
  "委員長",
  "副議長",
  "副町長",
  "教育長",
  "議長",
  "町長",
  "委員",
  "議員",
  "副部長",
  "副課長",
  "会計管理者",
  "部長",
  "課長",
  "室長",
  "局長",
  "係長",
  "参事",
  "主幹",
  "次長",
  "主査",
];

// 行政側の役職（答弁者として分類する）
const ANSWER_ROLES = new Set([
  "町長",
  "副町長",
  "教育長",
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
  "主査",
  "会計管理者",
]);

/**
 * 〇 マーカー付きの発言ヘッダーから発言者情報を抽出する。
 *
 * 対応パターン:
 *   〇松島茂喜議長  → role=議長, name=松島茂喜
 *   〇14番　松村　潤議員  → role=議員, name=松村潤（全角スペース除去）
 *   〇川島隆史学校教育課長  → role=課長, name=川島隆史
 *   〇橋本光規町長  → role=町長, name=橋本光規
 */
export function parseSpeaker(text: string): {
  speakerName: string | null;
  speakerRole: string | null;
  content: string;
} {
  // 〇 マーカーを除去
  const stripped = text.replace(/^[〇○◯◎●]\s*/, "");

  // 全角数字を含む議員番号パターン: "14番　松村　潤議員" / "１４番　松村　潤議員"
  const memberMatch = stripped.match(
    /^([\d０-９]+)番[\s\u3000]+(.+?)議員[\s\u3000]*([\s\S]*)/,
  );
  if (memberMatch) {
    const rawName = memberMatch[2]!.replace(/[\s\u3000]+/g, "").trim();
    const content = memberMatch[3]!.trim();
    return { speakerName: rawName, speakerRole: "議員", content };
  }

  // 役職サフィックスパターン: "氏名 + 役職" 形式（最長マッチ優先のため ROLE_SUFFIXES 順で処理）
  // 例: "松島茂喜議長", "橋本光規町長", "川島隆史学校教育課長"
  for (const suffix of ROLE_SUFFIXES) {
    const suffixIdx = stripped.indexOf(suffix);
    if (suffixIdx === -1) continue;

    // suffix の後に続く文字が別の日本語文字（名前等）でないかチェック
    const afterSuffix = stripped.slice(suffixIdx + suffix.length);
    // suffix の後は空白か文末でないといけない（例: "議長" の後に "補" が続く「議長補」はスキップ）
    if (afterSuffix.length > 0 && /^[^\s\u3000]/.test(afterSuffix)) {
      // 続く文字が別のサフィックスでないか確認
      const hasLongerSuffix = ROLE_SUFFIXES.some(
        (s) => s.length > suffix.length && stripped.indexOf(s) !== -1,
      );
      if (!hasLongerSuffix) continue;
      continue;
    }

    const namePart = stripped.slice(0, suffixIdx).trim();
    const content = afterSuffix.trim();

    // 名前部分の全角スペースを除去（例: "松村　潤" → "松村潤"）
    const speakerName = namePart
      ? namePart.replace(/[\s\u3000]+/g, "").trim() || null
      : null;

    return { speakerName, speakerRole: suffix, content };
  }

  // マッチしない場合はそのまま返す
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
  // endsWith マッチ（例: "学校教育課長" → 課長 → answer）
  for (const role of ANSWER_ROLES) {
    if (speakerRole.endsWith(role)) return "answer";
  }
  return "question";
}

/**
 * PDF から抽出したテキストを ParsedStatement 配列に変換する。
 *
 * 邑楽町の発言パターン:
 *   〇 で始まる行が発言者行
 *   登壇行（〔...登壇〕）や◎セクション見出しはスキップ
 *   ページ番号行（"- 15 -" 等）は除去
 */
export function parseStatements(text: string): ParsedStatement[] {
  // ページ番号行を除去
  const cleaned = text
    .replace(/^[\s　]*[-－]\s*\d+\s*[-－][\s　]*$/gm, "")
    .replace(/^[\s　]*\d+[\s　]*$/gm, "");

  const blocks = cleaned.split(/(?=[〇○◯◎●])/);
  const statements: ParsedStatement[] = [];
  let offset = 0;

  for (const block of blocks) {
    const trimmed = block.trim();
    if (!trimmed || !/^[〇○◯◎●]/.test(trimmed)) continue;

    // ◎ セクション見出しをスキップ（例: "◎開議の宣告"）
    if (/^[◎]/.test(trimmed)) continue;

    // 登壇・退場などのト書き行をスキップ（例: 〔14番 松村 潤議員登壇〕）
    if (/^[〇○◯●]?[\s　]*〔.+登壇〕/.test(trimmed)) continue;
    if (/^[〇○◯●].+〔登壇〕\s*$/.test(trimmed)) continue;

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
      `[105252-ora] PDF 取得失敗: ${pdfUrl}`,
      err instanceof Error ? err.message : err,
    );
    return null;
  }
}

/**
 * PDF をダウンロード・テキスト抽出し、MeetingData に変換する。
 */
export async function fetchMeetingData(
  meeting: OraMeeting,
  municipalityId: string,
): Promise<MeetingData | null> {
  if (!meeting.heldOn) return null;

  const text = await fetchPdfText(meeting.pdfUrl);
  if (!text) return null;

  const statements = parseStatements(text);
  if (statements.length === 0) return null;

  // PDF URL からファイル名部分を externalId として利用
  const urlPath = new URL(meeting.pdfUrl).pathname;
  const fileName = urlPath.split("/").pop()?.replace(/\.pdf$/i, "") ?? null;
  const externalId = fileName ? `ora_${fileName}` : null;

  return {
    municipalityId,
    title: meeting.title,
    meetingType: detectMeetingType(meeting.title),
    heldOn: meeting.heldOn,
    sourceUrl: meeting.pdfUrl,
    externalId,
    statements,
  };
}
