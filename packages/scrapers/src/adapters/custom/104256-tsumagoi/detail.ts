/**
 * 嬬恋村議会（群馬県） — detail フェーズ
 *
 * PDF をダウンロードしてテキストを抽出し、○ マーカーで発言を分割して
 * ParsedStatement 配列を生成する。
 *
 * 発言フォーマット:
 *   ○議長（佐藤鈴江君）　それでは、ただいまから会議を開きます。
 *   ○村長（熊川　栄君）　お答えいたします。
 *   ○３番（伊東正吾君）　質問いたします。
 *   ○交流推進課長（小林千速君）　ご報告いたします。
 */

import { createHash } from "node:crypto";
import { extractText, getDocumentProxy } from "../../../utils/pdf";
import type { MeetingData, ParsedStatement } from "../../../utils/types";
import type { TsumagoiSessionInfo } from "./list";
import { fetchBinary } from "./shared";

export interface TsumagoiDetailParams {
  title: string;
  year: number;
  month: number;
  pdfUrl: string;
  meetingType: "plenary" | "extraordinary" | "committee";
}

// 役職サフィックス（長い方を先に置いて誤マッチを防ぐ）
const ROLE_SUFFIXES = [
  "副委員長",
  "委員長",
  "副議長",
  "議長",
  "副村長",
  "村長",
  "副教育長",
  "教育長",
  "事務局長",
  "局長",
  "副部長",
  "部長",
  "副課長",
  "課長",
  "室長",
  "係長",
  "参事",
  "主幹",
  "主査",
  "補佐",
  "議員",
  "委員",
] as const;

// 行政側の役職（答弁者として分類する）
const ANSWER_ROLES = new Set([
  "村長",
  "副村長",
  "教育長",
  "副教育長",
  "事務局長",
  "局長",
  "部長",
  "副部長",
  "課長",
  "副課長",
  "室長",
  "係長",
  "参事",
  "主幹",
  "主査",
  "補佐",
]);

/**
 * ○ マーカー付きの発言ヘッダーから発言者情報を抽出する。
 *
 * 対応パターン:
 *   ○議長（佐藤鈴江君）　→ role=議長, name=佐藤鈴江
 *   ○村長（熊川　栄君）　→ role=村長, name=熊川栄
 *   ○３番（伊東正吾君）　→ role=議員, name=伊東正吾
 *   ○交流推進課長（小林千速君）→ role=課長, name=小林千速
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

    // 番号付き議員: ○３番（伊東正吾君）/ ○１０番（田中太郎君）
    const halfWidthRole = rolePart.replace(/[０-９]/g, (c) =>
      String.fromCharCode(c.charCodeAt(0) - 0xfee0)
    );
    if (/^[\d]+番$/.test(halfWidthRole)) {
      return { speakerName: rawName, speakerRole: "議員", content };
    }

    // 役職マッチ（長い順に確認）
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
 * - ○ マーカー行を発言ヘッダーとして検出
 * - 〔...〕形式の議場動作行はスキップ
 * - ページ番号行（−N− 形式）を除去
 */
export function parseStatements(text: string): ParsedStatement[] {
  const blocks = text.split(/(?=[○◯◎●])/);
  const statements: ParsedStatement[] = [];
  let offset = 0;

  for (const block of blocks) {
    const trimmed = block.trim();
    if (!trimmed || !/^[○◯◎●]/.test(trimmed)) continue;

    // 登壇・退席等のト書きをスキップ
    if (/^[○◯◎●]\s*[（(].+?(?:登壇|退席|退場|着席)[）)]$/.test(trimmed))
      continue;

    // ページ番号行（−N− 形式）を除去して正規化
    const cleaned = trimmed
      .split("\n")
      .filter((line) => !/^[−－]\d+[−－]$/.test(line.trim()))
      .join("\n");

    const normalized = cleaned.replace(/\s+/g, " ");
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
      `[104256-tsumagoi] PDF 取得失敗: ${pdfUrl}`,
      err instanceof Error ? err.message : err
    );
    return null;
  }
}

/**
 * PDF をダウンロード・テキスト抽出し、MeetingData に変換する。
 */
export async function fetchMeetingData(
  session: TsumagoiSessionInfo,
  municipalityCode: string
): Promise<MeetingData | null> {
  const text = await fetchPdfText(session.pdfUrl);
  if (!text) return null;

  const statements = parseStatements(text);

  // PDF ファイル名から externalId キーを構築
  const fileName = new URL(session.pdfUrl).pathname.split("/").pop() ?? "";
  const externalId = fileName
    ? `tsumagoi_${fileName.replace(/\.pdf$/i, "")}`
    : null;

  const heldOn = `${session.year}-${String(session.month).padStart(2, "0")}-01`;

  return {
    municipalityCode,
    title: session.title,
    meetingType: session.meetingType,
    heldOn,
    sourceUrl: session.pdfUrl,
    externalId,
    statements,
  };
}

/**
 * detailParams から MeetingData を組み立てる（ネットワークアクセスあり）。
 */
export async function buildMeetingData(
  params: TsumagoiDetailParams,
  municipalityCode: string
): Promise<MeetingData | null> {
  const session: TsumagoiSessionInfo = {
    title: params.title,
    year: params.year,
    month: params.month,
    pdfUrl: params.pdfUrl,
    meetingType: params.meetingType,
  };
  return fetchMeetingData(session, municipalityCode);
}
