/**
 * 竜王町議会 — detail フェーズ
 *
 * 会議録 PDF をダウンロードしてテキストを抽出し、
 * MeetingData を組み立てる。
 *
 * 発言フォーマット（例）:
 *   ○議長（田中一郎君）　ただいまから会議を開きます。
 *   ○町長（山田次郎君）　お答えいたします。
 *   ○２番（鈴木三郎君）　質問いたします。
 */

import { createHash } from "node:crypto";
import { extractText, getDocumentProxy } from "unpdf";
import type { MeetingData, ParsedStatement } from "../../../utils/types";
import { delay, fetchBinary } from "./shared";

export interface RyuoDetailParams {
  /** PDF の絶対 URL */
  pdfUrl: string;
  /** リンクテキスト（例: 第4日） */
  linkText: string;
  /** 会議名（例: 第3回定例会） */
  sessionTitle: string;
  /** 会議種別 */
  meetingType: string;
  /** 開催年（西暦） */
  year: number;
  /** 回数 */
  session: number;
  /** 日数 */
  day: number;
  /** ソース URL */
  sourceListUrl: string;
}

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
  "部長",
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
 * ○ マーカー付きの発言ヘッダーから発言者情報を抽出する。
 *
 * 対応パターン:
 *   ○議長（田中一郎君）　→ role=議長, name=田中一郎
 *   ○町長（山田次郎君）　→ role=町長, name=山田次郎
 *   ○２番（鈴木三郎君）　→ role=議員, name=鈴木三郎
 *   ○総務部長（佐藤四郎君）→ role=部長, name=佐藤四郎
 */
export function parseSpeaker(text: string): {
  speakerName: string | null;
  speakerRole: string | null;
  content: string;
} {
  const stripped = text.replace(/^[○◯◎●]\s*/, "");

  // パターン: role（name + 君|様|議員）content
  const match = stripped.match(
    /^(.+?)[（(](.+?)(?:君|様|議員)[）)]\s*([\s\S]*)/,
  );
  if (match) {
    const rolePart = match[1]!.trim();
    const rawName = match[2]!.replace(/[\s　]+/g, "").trim();
    const content = match[3]!.trim();

    // 番号付き議員: ○２番（鈴木三郎君）
    if (/^[\d０-９]+番$/.test(rolePart)) {
      return { speakerName: rawName, speakerRole: "議員", content };
    }

    // 役職マッチ
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
 * 開催日文字列を組み立てる。
 * 月が不明な場合は null を返す（"1970-01-01" は使用禁止）。
 *
 * 竜王町の PDF ファイル名にはセッション番号と日数のみが含まれ、
 * 正確な日付は不明なため、年のみをベースとした推定値を使用する。
 * 定例会の概算開催月:
 *   第1回→3月, 第2回→6月, 第3回→9月, 第4回→12月
 */
export function buildHeldOn(
  year: number,
  session: number,
  meetingType: string,
): string | null {
  // 定例会: 回数から概算月を推定
  if (meetingType === "plenary") {
    const monthMap: Record<number, number> = {
      1: 3,
      2: 6,
      3: 9,
      4: 12,
    };
    const month = monthMap[session];
    if (!month) return null;
    return `${year}-${String(month).padStart(2, "0")}-01`;
  }
  // 臨時会: 月情報なし
  return null;
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
      `[253847-ryuo] PDF 取得失敗: ${pdfUrl}`,
      err instanceof Error ? err.message : err,
    );
    return null;
  }
}

/**
 * detailParams から MeetingData を組み立てる。
 *
 * 会議録 PDF を1件ダウンロードしてテキスト抽出し、
 * ParsedStatement 配列を生成する。
 * statements が空なら null を返す。
 */
export async function buildMeetingData(
  params: RyuoDetailParams,
  municipalityCode: string,
): Promise<MeetingData | null> {
  await delay(1000);

  const text = await fetchPdfText(params.pdfUrl);
  if (!text) return null;

  const statements = parseStatements(text);
  if (statements.length === 0) return null;

  // externalId: pdfUrl の末尾ファイル名をベースにする
  const fileName = params.pdfUrl.split("/").pop() ?? params.pdfUrl;
  const externalId = `ryuo_${fileName}`;

  const heldOn = buildHeldOn(params.year, params.session, params.meetingType);

  // タイトルを組み立てる
  // sessionTitle が空の場合は pdfUrl のディレクトリ情報から補完
  const titleBase = params.sessionTitle
    ? `${params.sessionTitle} ${params.linkText}`
    : params.linkText;

  return {
    municipalityCode,
    title: titleBase.trim(),
    meetingType: params.meetingType,
    heldOn: heldOn ?? "",
    sourceUrl: params.pdfUrl,
    externalId,
    statements,
  };
}
