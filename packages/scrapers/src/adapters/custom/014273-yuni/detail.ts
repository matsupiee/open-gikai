/**
 * 由仁町議会 — detail フェーズ
 *
 * PDF 会議録からテキストを抽出し、発言データを取得する。
 *
 * 発言パターン:
 *   ○議長（後藤篤人君）
 *   ○町長（松村　論君）
 *   ○２番（加藤重夫君）
 *   ○教育長（石井　洋君）
 *   ○総務課長（河合髙弘君）
 */

import { createHash } from "node:crypto";
import { extractText, getDocumentProxy } from "unpdf";
import type { MeetingData, ParsedStatement } from "../../../utils/types";
import { detectMeetingType, fetchBinary, parseDateString, toHalfWidth } from "./shared";

// 役職サフィックス（長いものを先に配置して誤マッチを防ぐ）
const ROLE_SUFFIXES = [
  "副委員長",
  "委員長",
  "副議長",
  "副町長",
  "副部長",
  "副課長",
  "教育長",
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
  "書記",
  "係員",
];

// 行政側の役職（答弁者として分類する）
const ANSWER_ROLES = new Set([
  "町長",
  "副町長",
  "教育長",
  "部長",
  "課長",
  "室長",
  "局長",
  "係長",
  "参事",
  "主幹",
  "副部長",
  "副課長",
  "書記",
  "係員",
]);

/**
 * 役職から発言種別を分類する。
 */
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
 * 「役職（氏名君）」形式のテキストから役職と氏名を抽出する。
 */
export function parseSpeakerLabel(label: string): {
  speakerName: string | null;
  speakerRole: string | null;
} {
  // 全角スペース・半角スペースを除去して正規化
  const normalized = label.replace(/[\s　]+/g, "").trim();

  // パターン1: 役職（氏名君）
  const roleNameMatch = normalized.match(/^(.+?)（(.+?)）$/);
  if (roleNameMatch) {
    const roleOrName = roleNameMatch[1]!;
    const nameWithSuffix = roleNameMatch[2]!;
    // 「君」「氏」「さん」等の敬称を除去
    const name = nameWithSuffix.replace(/[君氏さん]$/, "");

    // 役職サフィックスにマッチする場合
    for (const suffix of ROLE_SUFFIXES) {
      if (roleOrName.endsWith(suffix)) {
        return {
          speakerName: name || null,
          speakerRole: suffix,
        };
      }
    }

    // 数字番号（○番）議員のケース: roleOrName が数字＋「番」
    const numberMatch = roleOrName.match(/^[０-９\d]+番$/);
    if (numberMatch) {
      return {
        speakerName: name || null,
        speakerRole: roleOrName,
      };
    }

    // 役職が不明な場合: roleOrName を役職、name を氏名
    return {
      speakerName: name || null,
      speakerRole: roleOrName || null,
    };
  }

  // パターン2: 役職のみ（氏名なし）
  for (const suffix of ROLE_SUFFIXES) {
    if (normalized.endsWith(suffix)) {
      const name =
        normalized.length > suffix.length
          ? normalized.slice(0, -suffix.length)
          : null;
      return { speakerName: name, speakerRole: suffix };
    }
  }

  return { speakerName: normalized || null, speakerRole: null };
}

/**
 * 氏名の文字間スペースを除去して正規化する。
 * 例: "松村　論" → "松村論"
 */
function normalizeSpacedName(name: string): string {
  if (/　/.test(name)) {
    return name.replace(/　/g, "");
  }
  return name;
}

/**
 * PDF テキストから発言を抽出する。
 *
 * 発言パターン:
 *   ○議長（後藤篤人君）
 *   ○町長（松村　論君）
 *   ○２番（加藤重夫君）
 */
export function parsePdfText(text: string): ParsedStatement[] {
  const statements: ParsedStatement[] = [];
  let offset = 0;

  const lines = text.split("\n");

  let currentSpeakerName: string | null = null;
  let currentSpeakerRole: string | null = null;
  let currentLines: string[] = [];

  function flushStatement(): void {
    const content = currentLines.join(" ").replace(/\s+/g, " ").trim();
    if (!content) {
      currentLines = [];
      return;
    }

    const contentHash = createHash("sha256").update(content).digest("hex");
    const startOffset = offset;
    const endOffset = offset + content.length;

    statements.push({
      kind: classifyKind(currentSpeakerRole),
      speakerName: currentSpeakerName,
      speakerRole: currentSpeakerRole,
      content,
      contentHash,
      startOffset,
      endOffset,
    });
    offset = endOffset + 1;
    currentLines = [];
  }

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line) continue;

    // ○ で始まる発言者行（全角・半角）
    if (/^[○◯〇]/.test(line)) {
      // 前の発言をフラッシュ
      if (currentLines.length > 0 && currentSpeakerRole !== null) {
        flushStatement();
      }

      // 発言者ラベルを抽出: ○役職（氏名君）残りのテキスト
      const speakerMatch = line.match(
        /^[○◯〇]\s*(.+?（.+?）)\s*([\s\S]*)/,
      );
      if (speakerMatch) {
        const labelRaw = speakerMatch[1]!.trim();
        const restText = speakerMatch[2]!.replace(/\s+/g, " ").trim();

        const { speakerName, speakerRole } = parseSpeakerLabel(labelRaw);
        currentSpeakerName = speakerName
          ? normalizeSpacedName(speakerName)
          : null;
        currentSpeakerRole = speakerRole;

        if (restText) {
          currentLines.push(restText);
        }
      } else {
        // 発言内容がある場合（パターンに一致しない行）
        currentLines.push(line.replace(/^[○◯〇]\s*/, ""));
      }
      continue;
    }

    // ◎ で始まる議事進行行（発言として登録しない）
    if (/^◎/.test(line)) {
      // 前の発言をフラッシュ
      if (currentLines.length > 0 && currentSpeakerRole !== null) {
        flushStatement();
      }
      currentSpeakerName = null;
      currentSpeakerRole = null;
      continue;
    }

    // 発言継続行
    if (currentSpeakerRole !== null) {
      currentLines.push(line);
    }
  }

  // 最後の発言をフラッシュ
  if (currentLines.length > 0 && currentSpeakerRole !== null) {
    flushStatement();
  }

  return statements;
}

/**
 * PDF テキストから開催日を抽出する。
 */
export function extractHeldOnFromText(text: string): string | null {
  const normalized = toHalfWidth(text);
  // 冒頭の数百文字から日付を探す
  const excerpt = normalized.slice(0, 500);
  return parseDateString(excerpt) ?? parseDateString(normalized);
}

/**
 * PDF テキストから会議タイトルを抽出する。
 * 例: "令和７年由仁町議会第１回定例会　第１号"
 */
export function extractTitleFromText(text: string): string | null {
  const normalized = toHalfWidth(text);
  const titleMatch = normalized.match(
    /令和\d+年由仁町議会第.+?回(?:定例会|臨時会).+?号/,
  );
  if (titleMatch) return titleMatch[0];
  return null;
}

/**
 * PDF 会議録から MeetingData を取得する。
 */
export async function fetchMeetingData(
  params: {
    pdfUrl: string;
    meetingType: string;
  },
  municipalityId: string,
): Promise<MeetingData | null> {
  const buffer = await fetchBinary(params.pdfUrl);
  if (!buffer) return null;

  let pdfText: string;
  try {
    const pdf = await getDocumentProxy(new Uint8Array(buffer));
    const { text } = await extractText(pdf, { mergePages: true });
    pdfText = text;
  } catch (e) {
    console.warn(
      `fetchMeetingData: PDF parse failed for ${params.pdfUrl}`,
      e instanceof Error ? e.message : e,
    );
    return null;
  }

  if (!pdfText || pdfText.trim().length === 0) return null;

  const heldOn = extractHeldOnFromText(pdfText);
  if (!heldOn) return null;

  const statements = parsePdfText(pdfText);
  if (statements.length === 0) return null;

  const title = extractTitleFromText(pdfText) ?? params.pdfUrl.split("/").pop() ?? "会議録";
  const pdfId = params.pdfUrl.split("/").pop()?.replace(/\.pdf$/i, "") ?? "unknown";

  return {
    municipalityId,
    title,
    meetingType: detectMeetingType(title) || params.meetingType,
    heldOn,
    sourceUrl: params.pdfUrl,
    externalId: `yuni_${pdfId}`,
    statements,
  };
}
