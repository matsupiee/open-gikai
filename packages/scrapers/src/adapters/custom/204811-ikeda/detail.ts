/**
 * 池田町議会（長野県北安曇郡） — detail フェーズ
 *
 * PDF をダウンロードしてテキストを抽出し、○ マーカーで発言を分割して
 * ParsedStatement 配列を生成する。
 *
 * 発言フォーマット（想定）:
 *   ○議長（横澤はま君）　それでは、ただいまから会議を開きます。
 *   ○町長（山田利彦君）　お答えいたします。
 *   ○１番（矢口結以君）　質問いたします。
 *   ○建設水道課長（山本利彦君）　ご報告いたします。
 */

import { createHash } from "node:crypto";
import { writeFile, unlink } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import type { MeetingData, ParsedStatement } from "../../../utils/types";
import type { IkedaMeeting } from "./list";
import { detectMeetingType, fetchBinary } from "./shared";

const execFileAsync = promisify(execFile);

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
  "会計管理者兼会計課長",
  "事務局長",
  "局長",
  "副部長",
  "部長",
  "副課長",
  "課長",
  "係長",
  "参事",
  "主幹",
  "補佐",
  "議員",
  "委員",
];

// 行政側の役職（答弁者として分類する）
const ANSWER_ROLES = new Set([
  "町長",
  "副町長",
  "教育長",
  "副教育長",
  "会計管理者兼会計課長",
  "部長",
  "副部長",
  "課長",
  "副課長",
  "事務局長",
  "局長",
  "参事",
  "主幹",
  "係長",
  "補佐",
]);

/**
 * ○ マーカー付きの発言ヘッダーから発言者情報を抽出する。
 *
 * 対応パターン:
 *   ○議長（横澤はま君）　→ role=議長, name=横澤はま
 *   ○町長（山田利彦君）　→ role=町長, name=山田利彦
 *   ○１番（矢口結以君）　→ role=議員, name=矢口結以
 *   ○建設水道課長（山本利彦君）　→ role=課長, name=山本利彦
 */
export function parseSpeaker(text: string): {
  speakerName: string | null;
  speakerRole: string | null;
  content: string;
} {
  const stripped = text.replace(/^[○◯◎●]\s*/, "");

  // パターン: role（name + 君|様|議員）content
  const match = stripped.match(
    /^(.+?)[（(](.+?)(?:君|様|議員)[）)]\s*([\s\S]*)/
  );
  if (match) {
    const rolePart = match[1]!.trim();
    const rawName = match[2]!.replace(/[\s　]+/g, "").trim();
    const content = match[3]!.trim();

    // 番号付き議員: ○１番（矢口結以君）、○１０番（服部久子君）
    if (/^[\d０-９]+番$/.test(rolePart)) {
      return { speakerName: rawName, speakerRole: "議員", content };
    }

    // 役職マッチ（長い方から順に試す）
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
  speakerRole: string | null
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
 * PDF から抽出したテキストを ParsedStatement 配列に変換する。
 *
 * ページ番号行（−N−形式）を除外し、○ マーカーで発言を分割する。
 */
export function parseStatements(text: string): ParsedStatement[] {
  // ページ番号行を除外: −1−、−2− などの全角ハイフン囲み
  const cleaned = text
    .split("\n")
    .filter((line) => !/^[−ー\-]\d+[−ー\-]$/.test(line.trim()))
    .join("\n");

  const blocks = cleaned.split(/(?=[○◯◎●])/);
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
 * PDF URL からテキストを取得する。
 *
 * 池田町の PDF は Identity-H エンコーディング（CID フォント）を使用しており、
 * unpdf (pdfjs-dist) では文字化けが発生するため、pdftotext コマンドを使用する。
 */
async function fetchPdfText(pdfUrl: string): Promise<string | null> {
  const buffer = await fetchBinary(pdfUrl);
  if (!buffer) return null;

  const tmpPath = join(tmpdir(), `ikeda_${Date.now()}.pdf`);
  try {
    await writeFile(tmpPath, Buffer.from(buffer));
    const { stdout } = await execFileAsync("pdftotext", ["-layout", tmpPath, "-"]);
    return stdout;
  } catch (err) {
    console.warn(
      `[204811-ikeda] PDF テキスト抽出失敗: ${pdfUrl}`,
      err instanceof Error ? err.message : err
    );
    return null;
  } finally {
    await unlink(tmpPath).catch(() => {});
  }
}

/**
 * PDF の URL からファイル名ベースの externalId キーを抽出する。
 * e.g., "https://www.ikedamachi.net/cmsfiles/contents/0000000/115/R7.12T.pdf"
 *   → "R7.12T"
 */
function extractExternalIdKey(pdfUrl: string): string | null {
  const match = pdfUrl.match(/\/([^/]+)\.pdf$/i);
  if (!match) return null;
  return match[1]!;
}

/**
 * PDF をダウンロード・テキスト抽出し、MeetingData に変換する。
 */
export async function fetchMeetingData(
  meeting: IkedaMeeting,
  municipalityCode: string
): Promise<MeetingData | null> {
  const text = await fetchPdfText(meeting.pdfUrl);
  if (!text) return null;

  const statements = parseStatements(text);
  if (statements.length === 0) return null;

  const idKey = extractExternalIdKey(meeting.pdfUrl);
  const externalId = idKey ? `ikeda_${idKey.toLowerCase()}` : null;

  return {
    municipalityCode,
    title: meeting.title,
    meetingType: detectMeetingType(meeting.section),
    heldOn: meeting.heldOn,
    sourceUrl: meeting.pdfUrl,
    externalId,
    statements,
  };
}
