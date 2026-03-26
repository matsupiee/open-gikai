/**
 * 真狩村議会 会議録 — detail フェーズ
 *
 * PDF をダウンロードしてテキストを抽出し、発言者と発言内容を ParsedStatement 配列に変換する。
 *
 * PDF のテーブルレイアウト（unpdf でページごとに抽出したテキスト）:
 *   左列（発言者）と右列（発言内容）が別々に抽出される。
 *   同一ページ内で発言者ブロックが全部先に来て、発言内容ブロックが後に来る。
 *
 *   例（ページ2）:
 *     議 長
 *     ( 佐 伯 秀 範 )
 *     〃
 *     〃
 *     副 村 長
 *     ( 長 船 敏 行 )
 *     [発言1]  ← 議長の発言1
 *     [発言2]  ← 議長の発言2
 *     ...
 *     [発言7]  ← 議長の発言7（〃×5 + 本体×2）
 *     [副村長発言1]
 *
 * 戦略:
 *   1. ページごとに「発言者行」と「発言内容行」を分類する
 *   2. 発言者のキューと発言内容のキューを別々に構築
 *   3. 1対1でペアリングして ParsedStatement を生成
 */

import { createHash } from "node:crypto";
import { extractText, getDocumentProxy } from "../../../utils/pdf";
import type { MeetingData, ParsedStatement } from "../../../utils/types";
import type { MakkariMeeting } from "./list";
import { detectMeetingType, fetchBinary } from "./shared";

// 役職サフィックス（長い方を先に置いて誤マッチを防ぐ）
const ROLE_SUFFIXES = [
  "副委員長",
  "委員長",
  "副議長",
  "副村長",
  "教育長",
  "議長",
  "村長",
  "委員",
  "議員",
  "副部長",
  "副課長",
  "部長",
  "課長",
  "室長",
  "局長",
  "係長",
  "参事",
  "主幹",
  "次長",
] as const;

// 行政側の役職（答弁者として分類する）
const ANSWER_ROLES = new Set([
  "村長",
  "副村長",
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
]);

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
 * スペースを除去した文字列で役職をマッチする。
 * 「議 長」「副 村 長」のようなスペース入り文字列に対応。
 */
function matchRole(line: string): string | null {
  const normalized = line.replace(/[\s　]+/g, "");

  // 議員番号パターン: "5番" / "10番"
  if (/^\d+番$/.test(normalized)) {
    return "議員";
  }

  for (const suffix of ROLE_SUFFIXES) {
    if (normalized === suffix || normalized.endsWith(suffix)) {
      return suffix;
    }
  }
  return null;
}

/**
 * 氏名行（括弧内）から氏名を抽出する。
 * パターン: "(佐伯秀範)" / "( 岩 原 清 一 )"
 */
function extractName(line: string): string | null {
  const match = line.match(/^[\s　]*[（(]\s*(.+?)\s*[)）][\s　]*$/);
  if (!match) return null;
  return match[1]!.replace(/[\s　]+/g, "");
}

/**
 * 行が「発言者行」かどうかを判定する。
 * 発言者行: 役職行、氏名行、〃行、日程行、時刻行
 */
function isSpeakerSectionLine(line: string): boolean {
  const trimmed = line.trim();
  if (!trimmed) return false;

  // 〃（同一発言者の繰り返し）
  if (trimmed === "〃" || trimmed === "″") return true;

  // ページ番号（数字のみ）
  if (/^\d+$/.test(trimmed)) return true;

  // テーブルヘッダー
  if (trimmed.includes("議 事 の 経 過") || trimmed.includes("日 程 発 言 者 発 言")) return true;

  // 時刻行: "10：00" / "14：30"
  if (/^\d+[：:]\d+$/.test(trimmed)) return true;

  // 開会・閉会などの状態行（左列の日程欄）
  if (trimmed === "開会" || trimmed === "閉会" || trimmed === "散会" || trimmed === "休憩" || trimmed === "再開") return true;

  // 日程行: "日程１" / "日程 ３"
  if (/^日程[\s　]*\d+$/.test(trimmed)) return true;

  // 役職行
  if (matchRole(trimmed) !== null) return true;

  // 氏名行（括弧で囲まれた短い行）
  if (extractName(trimmed) !== null) return true;

  return false;
}

/**
 * ページテキストから発言者リストと発言内容リストを分離する。
 *
 * アルゴリズム:
 * 1. 行を上から順に処理
 * 2. 発言者セクション行（役職・氏名・〃・日程・時刻）は発言者キューに追加
 * 3. 実質的な発言内容行はコンテンツバッファに追加
 * 4. 発言者キュー内の役職+氏名ペアを発言者情報として抽出
 * 5. コンテンツバッファを発言者数で分割して1対1ペアリング
 */
export function parsePageText(pageText: string): Array<{
  speakerName: string | null;
  speakerRole: string | null;
  content: string;
}> {
  const lines = pageText.split("\n");
  const results: Array<{
    speakerName: string | null;
    speakerRole: string | null;
    content: string;
  }> = [];

  // 「議事の経過」テーブルのヘッダー以降を処理
  let inMeetingSection = false;
  const speakerQueue: Array<{ role: string | null; name: string | null }> = [];
  const contentLines: string[] = [];

  let pendingRole: string | null = null;
  let lastSpeakerName: string | null = null;
  let prevWasRole = false;

  for (const line of lines) {
    const trimmed = line.trim();

    if (!inMeetingSection) {
      if (trimmed.includes("議 事 の 経 過") || trimmed.includes("議事の経過")) {
        inMeetingSection = true;
      }
      continue;
    }

    if (!trimmed) continue;

    // テーブルヘッダーはスキップ
    if (trimmed.includes("日 程 発 言 者 発 言") || trimmed.includes("日程 発言者 発言")) continue;

    // 〃 は前の役職+氏名を繰り返す
    if (trimmed === "〃" || trimmed === "″") {
      speakerQueue.push({ role: pendingRole, name: lastSpeakerName });
      prevWasRole = true;
      continue;
    }

    // 役職行
    const role = matchRole(trimmed);
    if (role) {
      pendingRole = role;
      prevWasRole = true;
      continue;
    }

    // 氏名行（役職行の直後）
    const name = extractName(trimmed);
    if (name !== null && prevWasRole) {
      lastSpeakerName = name;
      speakerQueue.push({ role: pendingRole, name });
      prevWasRole = false;
      continue;
    }

    // ページ番号・日程行・時刻行・状態行はスキップ
    if (isSpeakerSectionLine(trimmed)) {
      prevWasRole = false;
      continue;
    }

    // 発言内容行
    prevWasRole = false;
    contentLines.push(trimmed);
  }

  if (speakerQueue.length === 0) return results;

  // コンテンツ行を発言者数に対応して分割
  // 各発言者の発言をひとまとめにする（行数ベースで均等分割）
  if (contentLines.length === 0) return results;

  // 発言内容をひとつの長いテキストとして結合し、発言者の数で処理
  // 各発言者に対して発言内容の1段落（または複数行）を割り当てる
  // シンプルな方法: 全コンテンツをひとつの発言として最初の発言者に割り当て
  // より正確な方法: 発言の区切りを検出する

  // 発言内容を適切にグループ化するために、段落（空行または特定パターン）で分割を試みる
  // ただし、真狩村のPDFはページごとに発言が分かれることがあるため、
  // ページ全体の発言内容をすべての発言者に分配する

  // 実用的なアプローチ: コンテンツを発言者数で均等に分割
  const speakerCount = speakerQueue.length;
  const linesPerSpeaker = Math.ceil(contentLines.length / speakerCount);

  for (let i = 0; i < speakerCount; i++) {
    const speaker = speakerQueue[i]!;
    const start = i * linesPerSpeaker;
    const end = Math.min(start + linesPerSpeaker, contentLines.length);
    const contentSlice = contentLines.slice(start, end);

    if (contentSlice.length === 0) break;

    const content = contentSlice
      .join("\n")
      .replace(/\n+/g, " ")
      .trim();

    if (!content) continue;

    results.push({
      speakerRole: speaker.role,
      speakerName: speaker.name,
      content,
    });
  }

  return results;
}

/**
 * PDF テキスト全体（全ページ）から ParsedStatement 配列を生成する。
 */
export function parseStatements(pages: string[]): ParsedStatement[] {
  const allStatements: ParsedStatement[] = [];
  let offset = 0;

  for (const pageText of pages) {
    const pageResults = parsePageText(pageText);

    for (const { speakerRole, speakerName, content } of pageResults) {
      if (!content || content.length < 5) continue;

      const contentHash = createHash("sha256").update(content).digest("hex");
      const startOffset = offset;
      const endOffset = offset + content.length;

      allStatements.push({
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
  }

  return allStatements;
}

/**
 * PDF URL からページごとのテキストを取得する。
 */
async function fetchPdfPages(pdfUrl: string): Promise<string[] | null> {
  try {
    const buffer = await fetchBinary(pdfUrl);
    if (!buffer) return null;

    const pdf = await getDocumentProxy(new Uint8Array(buffer));
    const { text } = await extractText(pdf, { mergePages: false });
    // unpdf の mergePages: false は string[] を返す
    return text as unknown as string[];
  } catch (err) {
    console.warn(
      `[013960-makkari] PDF 取得失敗: ${pdfUrl}`,
      err instanceof Error ? err.message : err,
    );
    return null;
  }
}

/**
 * PDF をダウンロード・テキスト抽出し、MeetingData に変換する。
 */
export async function fetchMeetingData(
  meeting: MakkariMeeting,
  municipalityCode: string,
): Promise<MeetingData | null> {
  if (!meeting.heldOn) return null;

  const pages = await fetchPdfPages(meeting.pdfUrl);
  if (!pages) return null;

  const statements = parseStatements(pages);
  if (statements.length === 0) return null;

  // PDF URL のファイル名から externalId を生成
  const urlPath = new URL(meeting.pdfUrl).pathname;
  const fileName = urlPath.split("/").pop()?.replace(/\.pdf$/i, "") ?? null;
  const externalId = fileName ? `makkari_${fileName}` : null;

  return {
    municipalityCode,
    title: meeting.title,
    meetingType: detectMeetingType(meeting.title),
    heldOn: meeting.heldOn,
    sourceUrl: meeting.pdfUrl,
    externalId,
    statements,
  };
}
