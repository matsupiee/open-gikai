/**
 * 江差町議会 -- detail フェーズ
 *
 * PDF をダウンロードしてテキストを抽出し、発言者マーカーで発言を分割して
 * ParsedStatement 配列を生成する。
 *
 * 江差町の発言フォーマット:
 *   （議長）　ただいまから会議を開きます。
 *   「町長」　お答えいたします。
 *   「増永議員」　質問いたします。
 *   「財政課長」（補足説明）　ご説明いたします。
 *
 * マーカーの種類:
 *   （議長） — 議長の発言（丸カッコ）
 *   「役職名」 — 各種発言者（カギカッコ）
 *     「町長」「副町長」「教育長」 — 行政トップ
 *     「○○課長」「○○参事」 — 行政職員
 *     「○○議員」 — 議員の質問
 *     「○○委員長」 — 委員長報告等
 */

import { createHash } from "node:crypto";
import { extractText, getDocumentProxy } from "unpdf";
import type { MeetingData, ParsedStatement } from "../../../utils/types";
import type { EsashiMeeting } from "./list";
import {
  detectMeetingType,
  extractExternalIdKey,
  fetchBinary,
} from "./shared";

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
]);

/**
 * 発言者マーカーから役職と名前を抽出する。
 *
 * 対応パターン:
 *   （議長） -> role=議長, name=null
 *   「町長」 -> role=町長, name=null
 *   「増永議員」 -> role=議員, name=増永
 *   「財政課長」 -> role=課長, name=財政
 *   「まちづくり推進課長」 -> role=課長, name=まちづくり推進
 *   「室井委員長」 -> role=委員長, name=室井
 */
export function parseSpeaker(marker: string): {
  speakerName: string | null;
  speakerRole: string | null;
} {
  // 丸カッコパターン: （議長）
  const parenMatch = marker.match(/^[（(]([^）)]+)[）)]$/);
  if (parenMatch) {
    const inner = parenMatch[1]!.trim();
    return { speakerName: null, speakerRole: inner };
  }

  // カギカッコパターン: 「町長」「増永議員」「財政課長」
  const bracketMatch = marker.match(/^「([^」]+)」$/);
  if (bracketMatch) {
    const inner = bracketMatch[1]!.trim();

    // 役職サフィックスでマッチ
    for (const suffix of ROLE_SUFFIXES) {
      if (inner === suffix) {
        return { speakerName: null, speakerRole: suffix };
      }
      if (inner.endsWith(suffix) && inner.length > suffix.length) {
        const name = inner.slice(0, -suffix.length);
        return { speakerName: name, speakerRole: suffix };
      }
    }

    // マッチしない場合はそのまま返す
    return { speakerName: null, speakerRole: inner };
  }

  return { speakerName: null, speakerRole: null };
}

/** 役職から発言種別を分類 */
export function classifyKind(speakerRole: string | null): string {
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
 *
 * 発言者マーカーの正規表現:
 *   （議長） — 丸カッコで議長のみ
 *   「○○」  — カギカッコで各種発言者
 *
 * テキストを上記マーカーで分割し、マーカーに続くテキストを発言内容とする。
 * 「○○」 議長。（議長） ○○。 のように、発言権取得→議長許可→発言 の
 * パターンが連続する場合があるが、各マーカーを独立した発言として扱う。
 */
export function parseStatements(text: string): ParsedStatement[] {
  // 発言者マーカーで分割: （議長） or 「○○」
  // マーカーの後に（補足説明）等の注釈が続く場合がある
  const markerPattern =
    /([（(]議長[）)]|「[^」]{1,20}」)(?:[（(][^）)]{1,10}[）)])?/g;

  const markers: { index: number; marker: string; fullMatch: string }[] = [];
  for (const m of text.matchAll(markerPattern)) {
    const marker = m[1]!;
    // 「なし」「おはようございます」等の非発言者パターンを除外
    if (marker.startsWith("「")) {
      const inner = marker.slice(1, -1);
      if (
        inner === "なし" ||
        inner === "おはようございます" ||
        inner === "異議なし" ||
        inner === "賛成" ||
        inner === "反対"
      ) {
        continue;
      }
      // 役職サフィックスが含まれない短いテキストは除外
      const hasRole = ROLE_SUFFIXES.some(
        (suffix) => inner === suffix || inner.endsWith(suffix),
      );
      if (!hasRole) continue;
    }
    markers.push({
      index: m.index!,
      marker,
      fullMatch: m[0]!,
    });
  }

  const statements: ParsedStatement[] = [];
  let offset = 0;

  for (let i = 0; i < markers.length; i++) {
    const current = markers[i]!;
    const nextIndex =
      i + 1 < markers.length ? markers[i + 1]!.index : text.length;

    // マーカーの後のテキストを発言内容とする
    const contentStart = current.index + current.fullMatch.length;
    const rawContent = text.substring(contentStart, nextIndex).trim();

    // 空の発言やページ番号のみの発言はスキップ
    if (!rawContent || /^\d+$/.test(rawContent)) continue;

    // 「○○」 議長。 のような発言権取得パターン（短い呼びかけ）はスキップ
    const { speakerName, speakerRole } = parseSpeaker(current.marker);

    // 議長への呼びかけのみの短い発言はスキップ
    // 例: 「町長」 議長。 → 次の（議長） 町長。 が許可
    if (rawContent === "議長。" || rawContent === "委員長。") continue;

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
      `[013617-esashi] PDF 取得失敗: ${pdfUrl}`,
      err instanceof Error ? err.message : err,
    );
    return null;
  }
}

/**
 * PDF をダウンロード・テキスト抽出し、MeetingData に変換する。
 */
export async function fetchMeetingData(
  meeting: EsashiMeeting,
  municipalityId: string,
): Promise<MeetingData | null> {
  const text = await fetchPdfText(meeting.pdfUrl);
  if (!text) return null;

  const statements = parseStatements(text);

  const idKey = extractExternalIdKey(new URL(meeting.pdfUrl).pathname);
  const externalId = idKey ? `esashi_${idKey}` : null;

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
