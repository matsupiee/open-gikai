/**
 * 木古内町議会 会議録 -- detail フェーズ
 *
 * PDF をダウンロードしてテキストを抽出し、発言者マーカーで発言を分割して
 * ParsedStatement 配列を生成する。
 *
 * 木古内町の発言フォーマット（PDF 抽出テキスト）:
 *   ○議長（田村一義君） ただいまの出席議員数は...
 *   ○町長（石﨑倫行君） お答えいたします。
 *   ○○番（田村一義君） 質問いたします。
 *   ○総務課長（山田太郎君） ご説明いたします。
 *
 * マーカーパターン:
 *   ○{役職}（{氏名}君） — 役職付き発言者
 *   ○{N}番（{氏名}君） — 議員番号パターン
 *   ○{役職} {発言} — スペース区切りパターン
 */

import { createHash } from "node:crypto";
import { extractText, getDocumentProxy } from "unpdf";
import type { MeetingData, ParsedStatement } from "../../../utils/types";
import type { KikonaiMeeting } from "./list";
import { detectMeetingType, fetchBinary } from "./shared";

// 役職サフィックス（長い方を先に置いて誤マッチを防ぐ）
const ROLE_SUFFIXES = [
  "副委員長",
  "委員長",
  "副議長",
  "議長",
  "副町長",
  "町長",
  "教育長",
  "委員",
  "議員",
  "副部長",
  "部長",
  "副課長",
  "課長",
  "室長",
  "局長",
  "係長",
  "参事",
  "主幹",
  "主査",
  "補佐",
  "書記",
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
  "主査",
  "補佐",
  "書記",
]);

/**
 * 発言者マーカーから役職と名前を抽出する。
 *
 * 対応パターン:
 *   ○議長（田村一義君） -> role=議長, name=null
 *   ○町長（石﨑倫行君） -> role=町長, name=null
 *   ○総務課長（山田太郎君） -> role=課長, name=総務
 *   ○3番（田村一義君） -> role=議員, name=null（番号議員）
 *   ○議長 -> role=議長, name=null
 */
export function parseSpeaker(marker: string): {
  speakerName: string | null;
  speakerRole: string | null;
} {
  // ○ マーカーを除去
  const stripped = marker.replace(/^[○◯◎●]\s*/, "");

  // "N番（氏名君）" パターン（議員番号）
  const numPattern = stripped.match(/^(\d+)番/);
  if (numPattern) {
    return { speakerName: null, speakerRole: "議員" };
  }

  // "役職（氏名君）" パターン
  const parenMatch = stripped.match(/^([^（(）)]+)[（(]/);
  const roleStr = parenMatch ? parenMatch[1]!.trim() : stripped.trim();

  // 役職サフィックスでマッチ
  for (const suffix of ROLE_SUFFIXES) {
    if (roleStr === suffix) {
      return { speakerName: null, speakerRole: suffix };
    }
    if (roleStr.endsWith(suffix) && roleStr.length > suffix.length) {
      const name = roleStr.slice(0, -suffix.length).trim();
      return {
        speakerName: name || null,
        speakerRole: suffix,
      };
    }
  }

  // マッチしない場合
  if (roleStr) {
    return { speakerName: null, speakerRole: roleStr };
  }

  return { speakerName: null, speakerRole: null };
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
  // サフィックスマッチ
  for (const role of ANSWER_ROLES) {
    if (speakerRole.endsWith(role)) return "answer";
  }
  return "question";
}

/**
 * PDF から抽出したテキストを ParsedStatement 配列に変換する。
 *
 * 発言者マーカーの正規表現:
 *   ○{役職}（{氏名}君） — 役職と氏名のセット
 *   ○{N}番（{氏名}君）  — 議員番号パターン
 *   ○{役職}             — 役職のみ（氏名なし）
 */
export function parseStatements(text: string): ParsedStatement[] {
  // 発言者マーカーパターン:
  // ○ + 役職or番号 + （氏名君） or ○ + 役職のみ
  const markerPattern =
    /[○◯◎●](?:\d+番|[^\s○◯◎●（(（]{1,20})(?:[（(][^）)]{1,20}[）)])?/g;

  const markers: { index: number; marker: string }[] = [];

  for (const m of text.matchAll(markerPattern)) {
    const marker = m[0]!;
    const stripped = marker.replace(/^[○◯◎●]\s*/, "");

    // 非発言者パターンを除外（「なし」「異議なし」等）
    if (
      stripped === "なし" ||
      stripped === "異議なし" ||
      stripped === "賛成" ||
      stripped === "反対"
    ) {
      continue;
    }

    // 番号パターン（議員番号）はそのまま通す
    if (/^\d+番/.test(stripped)) {
      markers.push({ index: m.index!, marker });
      continue;
    }

    // 役職サフィックスが含まれるものを通す
    const roleStr = stripped.replace(/[（(][^）)]*[）)]/, "").trim();
    const hasRole = ROLE_SUFFIXES.some(
      (suffix) => roleStr === suffix || roleStr.endsWith(suffix),
    );
    if (!hasRole) continue;

    markers.push({ index: m.index!, marker });
  }

  const statements: ParsedStatement[] = [];
  let offset = 0;

  for (let i = 0; i < markers.length; i++) {
    const current = markers[i]!;
    const nextIndex =
      i + 1 < markers.length ? markers[i + 1]!.index : text.length;

    // マーカーの後のテキストを発言内容とする
    const contentStart = current.index + current.marker.length;
    const rawContent = text.substring(contentStart, nextIndex).trim();

    // 空の発言やページ番号のみの発言はスキップ
    if (!rawContent || /^\d+$/.test(rawContent)) continue;

    const { speakerName, speakerRole } = parseSpeaker(current.marker);

    const normalized = rawContent.replace(/\s+/g, " ");
    const contentHash = createHash("sha256")
      .update(normalized)
      .digest("hex");
    const startOffset = offset;
    const endOffset = offset + normalized.length;

    statements.push({
      kind: classifyKind(speakerRole),
      speakerName,
      speakerRole,
      content: normalized,
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
      `[013340-kikonai] PDF 取得失敗: ${pdfUrl}`,
      err instanceof Error ? err.message : err,
    );
    return null;
  }
}

/**
 * PDF をダウンロード・テキスト抽出し、MeetingData に変換する。
 */
export async function fetchMeetingData(
  meeting: KikonaiMeeting,
  municipalityId: string,
): Promise<MeetingData | null> {
  const text = await fetchPdfText(meeting.pdfUrl);
  if (!text) return null;

  const statements = parseStatements(text);
  if (statements.length === 0) return null;

  // PDF URL からexternalId を生成
  const urlPath = new URL(meeting.pdfUrl).pathname;
  const fileMatch = urlPath.match(/\/([^/]+)\.pdf$/i);
  const fileKey = fileMatch?.[1] ? decodeURIComponent(fileMatch[1]) : null;
  const externalId = fileKey ? `kikonai_${fileKey}` : null;

  return {
    municipalityId,
    title: meeting.title,
    meetingType: detectMeetingType(meeting.category),
    heldOn: meeting.heldOn,
    sourceUrl: meeting.pdfUrl,
    externalId,
    statements,
  };
}
