/**
 * 草津町議会（群馬県） — detail フェーズ
 *
 * list フェーズで収集済みの detailParams から MeetingData を組み立てる。
 * PDF テキスト抽出は将来対応のため、現時点では statements は空配列とする。
 */

import { createHash } from "node:crypto";
import type { MeetingData, ParsedStatement } from "../../../utils/types";

export interface KusatsuDetailParams {
  title: string;
  year: number | null;
  pdfUrl: string;
  meetingType: "plenary" | "extraordinary" | "committee";
}

/**
 * detailParams から MeetingData を組み立てる。
 * heldOn は年度のみわかるため、year から YYYY-01-01 を使う（近似値）。
 * year が null の場合は null を返す。
 */
export function buildMeetingData(
  params: KusatsuDetailParams,
  municipalityCode: string
): MeetingData | null {
  if (!params.year) return null;

  // アンカーテキストから開催日を解析（年のみ利用可能）
  const heldOn = parseHeldOnFromTitle(params.title, params.year);
  if (!heldOn) return null;

  return {
    municipalityCode,
    title: params.title,
    meetingType: params.meetingType,
    heldOn,
    sourceUrl: params.pdfUrl,
    externalId: `kusatsu_${encodeURIComponent(params.pdfUrl)}`,
    statements: [],
  };
}

/**
 * タイトルと年から開催日（YYYY-MM-DD）を推定する。
 * 草津町の場合、アンカーテキストに日付情報がないため、
 * 年のみを使って YYYY-01-01 を返す（近似値）。
 * 将来 PDF 本文からの抽出に切り替えることを想定。
 */
export function parseHeldOnFromTitle(
  _title: string,
  year: number
): string | null {
  if (!year || year <= 0) return null;
  return `${year}-01-01`;
}

/**
 * 役職サフィックスリスト（長い方を先に）
 */
const ROLE_SUFFIXES = [
  "副委員長",
  "委員長",
  "副議長",
  "副町長",
  "副部長",
  "副課長",
  "議長",
  "町長",
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
  "町長",
  "副町長",
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
 * 草津町のフォーマット: "○議長（宮﨑謹一君） ..."
 * または: "○７番（金丸勝利君） ..."
 */
export function parseSpeaker(text: string): {
  speakerName: string | null;
  speakerRole: string | null;
  content: string;
} {
  // 草津町パターン: ○{役職}（{氏名}君）
  const kusatsuPattern = /^[○◯●]\s*(.+?)（(.+?)君）[\s　]*([\s\S]*)$/;
  const kusatsuMatch = text.match(kusatsuPattern);
  if (kusatsuMatch) {
    const roleOrNumber = kusatsuMatch[1]!.trim();
    const name = kusatsuMatch[2]!.trim();
    const content = kusatsuMatch[3]!.trim();

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
 * 草津町の発言パターン: "○{役職}（{氏名}君）" で始まる行
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
