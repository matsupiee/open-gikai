/**
 * 昭和村議会（群馬県） — detail フェーズ
 *
 * list フェーズで収集済みの detailParams から MeetingData を組み立てる。
 * PDF テキスト抽出は将来対応のため、現時点では statements は空配列とする。
 */

import { createHash } from "node:crypto";
import type { MeetingData, ParsedStatement } from "../../../utils/types";

export interface ShowaGunmaDetailParams {
  title: string;
  year: number;
  pdfUrl: string;
  goNumber: string;
  meetingType: "plenary" | "extraordinary" | "committee";
}

/**
 * detailParams から MeetingData を組み立てる。
 * heldOn は年度のみわかるため、year から YYYY-01-01 を使う（近似値）。
 */
export function buildMeetingData(
  params: ShowaGunmaDetailParams,
  municipalityCode: string
): MeetingData | null {
  if (!params.year || params.year <= 0) return null;

  // ファイル名から日付を推定（例: 20251203_honbun.pdf → 2025-12-03）
  const heldOn = parseDateFromPdfUrl(params.pdfUrl) ?? `${params.year}-01-01`;

  return {
    municipalityCode,
    title: params.title,
    meetingType: params.meetingType,
    heldOn,
    sourceUrl: params.pdfUrl,
    externalId: `showa_gunma_${encodeURIComponent(params.pdfUrl)}`,
    statements: [],
  };
}

/**
 * PDF の URL（ファイル名）から開催日（YYYY-MM-DD）を推定する。
 *
 * 命名パターン:
 * - 新形式: 20251203_honbun.pdf → 2025-12-03
 * - 中間形式: 6-3-1-2.pdf（令和6年第3回第1号本文）→ 日付不明
 * - 旧形式: dai1gouhonbun.pdf → 日付不明
 */
export function parseDateFromPdfUrl(pdfUrl: string): string | null {
  try {
    const fileName = new URL(pdfUrl).pathname.split("/").pop() ?? "";

    // 新形式: YYYYMMDD_honbun.pdf
    const dateMatch = fileName.match(/^(\d{4})(\d{2})(\d{2})_/);
    if (dateMatch) {
      const year = parseInt(dateMatch[1]!, 10);
      const month = parseInt(dateMatch[2]!, 10);
      const day = parseInt(dateMatch[3]!, 10);
      if (year >= 2000 && month >= 1 && month <= 12 && day >= 1 && day <= 31) {
        return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
      }
    }

    return null;
  } catch {
    return null;
  }
}

/**
 * 役職サフィックスリスト（長い方を先に）
 */
const ROLE_SUFFIXES = [
  "副委員長",
  "委員長",
  "副議長",
  "副村長",
  "副部長",
  "副課長",
  "議長",
  "村長",
  "委員",
  "議員",
  "部長",
  "課長",
  "室長",
  "局長",
  "係長",
  "参事",
  "主幹",
] as const;

// 行政側の役職（答弁者として分類する）
const ANSWER_ROLES = new Set([
  "村長",
  "副村長",
  "部長",
  "課長",
  "室長",
  "局長",
  "係長",
  "参事",
  "主幹",
  "副部長",
  "副課長",
]);

/**
 * 発言テキストから話者名・役職・本文を抽出する。
 *
 * 昭和村のフォーマット: "○議長（永井一行君） ..."
 * または: "○村長（髙橋幸一郎君） ..."
 */
export function parseSpeaker(text: string): {
  speakerName: string | null;
  speakerRole: string | null;
  content: string;
} {
  // 昭和村パターン: ○{役職}（{氏名}君）
  const speakerPattern = /^[○◯●]\s*(.+?)（(.+?)君）[\s　]*([\s\S]*)$/;
  const speakerMatch = text.match(speakerPattern);
  if (speakerMatch) {
    const roleOrNumber = speakerMatch[1]!.trim();
    const name = speakerMatch[2]!.trim();
    const content = speakerMatch[3]!.trim();

    // 役職サフィックスにマッチするか確認
    for (const suffix of ROLE_SUFFIXES) {
      if (roleOrNumber.endsWith(suffix)) {
        return { speakerName: name, speakerRole: suffix, content };
      }
    }

    // 議員番号パターン（例: "７番", "１０番"）
    if (/^\d+番$/.test(toHalfWidth(roleOrNumber))) {
      return { speakerName: name, speakerRole: "議員", content };
    }

    // マッチしない場合は役職をそのまま使う
    return { speakerName: name, speakerRole: roleOrNumber, content };
  }

  // フォールバック: 一般的な ○ マーカーパターン
  const stripped = text.replace(/^[○◯◎●]\s*/, "");

  const headerMatch = stripped.match(/^([^\s　]{1,30})[\s　]+/);
  if (!headerMatch?.[1]) {
    return { speakerName: null, speakerRole: null, content: stripped.trim() };
  }

  const header = headerMatch[1];
  const content = stripped.slice(headerMatch[0].length).trim();

  for (const suffix of ROLE_SUFFIXES) {
    if (header.endsWith(suffix)) {
      const name =
        header.length > suffix.length ? header.slice(0, -suffix.length) : null;
      return { speakerName: name, speakerRole: suffix, content };
    }
  }

  if (/^[○◯◎●]/.test(text)) {
    return { speakerName: header, speakerRole: null, content };
  }

  return { speakerName: null, speakerRole: null, content: stripped.trim() };
}

/** 全角数字を半角に変換 */
function toHalfWidth(str: string): string {
  return str.replace(/[０-９]/g, (c) =>
    String.fromCharCode(c.charCodeAt(0) - 0xfee0)
  );
}

/** 役職から発言種別を分類 */
export function classifyKind(
  speakerRole: string | null
): "question" | "answer" | "remark" {
  if (!speakerRole) return "remark";
  if (ANSWER_ROLES.has(speakerRole)) return "answer";
  if (
    speakerRole === "議長" ||
    speakerRole === "副議長" ||
    speakerRole === "委員長" ||
    speakerRole === "副委員長"
  )
    return "remark";
  return "question";
}

/**
 * PDF から抽出されたテキストを発言単位に分割する。
 *
 * 昭和村の発言パターン: "○{役職}（{氏名}君）" で始まる行
 */
export function parseStatements(text: string): ParsedStatement[] {
  const statements: ParsedStatement[] = [];
  const lines = text.split("\n");

  let currentSpeaker: {
    speakerName: string | null;
    speakerRole: string | null;
  } | null = null;
  let currentLines: string[] = [];
  let offset = 0;

  const flushCurrent = () => {
    if (!currentSpeaker || currentLines.length === 0) return;
    const content = currentLines.join("\n").trim();
    if (!content) return;

    const contentHash = createHash("sha256").update(content).digest("hex");
    const startOffset = offset;
    const endOffset = offset + content.length;

    statements.push({
      kind: classifyKind(currentSpeaker.speakerRole),
      speakerName: currentSpeaker.speakerName,
      speakerRole: currentSpeaker.speakerRole,
      content,
      contentHash,
      startOffset,
      endOffset,
    });
    offset = endOffset + 1;
    currentLines = [];
    currentSpeaker = null;
  };

  for (const rawLine of lines) {
    // ページ番号行を除去: "－{数字}－" パターン
    if (/^－\d+－$/.test(rawLine.trim())) continue;

    // 空行は無視
    const line = rawLine.trim();
    if (!line) continue;

    // 発言者行の検出: "○" で始まり "（{氏名}君）" パターン
    const isSpeakerLine = /^[○◯●]\s*.+?（.+?君）/.test(line);

    if (isSpeakerLine) {
      // 前の発言をフラッシュ
      flushCurrent();

      const parsed = parseSpeaker(line);
      currentSpeaker = {
        speakerName: parsed.speakerName,
        speakerRole: parsed.speakerRole,
      };
      if (parsed.content) {
        currentLines.push(parsed.content);
      }
    } else if (currentSpeaker) {
      currentLines.push(line);
    }
  }

  // 最後の発言をフラッシュ
  flushCurrent();

  return statements;
}
