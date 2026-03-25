/**
 * 一宮町議会 -- detail フェーズ
 *
 * PDF をダウンロードしてテキストを抽出し、○ マーカーで発言を分割して
 * ParsedStatement 配列を生成する。
 *
 * 発言フォーマット例:
 *   ○議長（山田太郎君） 本日の会議を開きます。
 *   ○町長（鈴木一郎君） ご説明申し上げます。
 *   ○１番（田中花子君） 質問いたします。
 */

import { createHash } from "node:crypto";
import { extractText, getDocumentProxy } from "unpdf";
import type { MeetingData, ParsedStatement } from "../../../utils/types";
import { fetchBinary } from "./shared";

export interface IchinomiyaDetailParams {
  title: string;
  year: number;
  pdfUrl: string;
  meetingType: string;
  pageUrl: string;
}

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
  "事務局長",
  "局長",
  "副部長",
  "部長",
  "副課長",
  "課長",
  "室長",
  "係長",
  "次長",
  "参事",
  "主幹",
  "主査",
  "補佐",
  "理事",
  "政策監",
  "管理者",
  "議員",
  "委員",
];

// 行政側の役職（答弁者として分類する）
const ANSWER_ROLES = new Set([
  "町長",
  "副町長",
  "教育長",
  "副教育長",
  "部長",
  "副部長",
  "課長",
  "副課長",
  "室長",
  "局長",
  "事務局長",
  "係長",
  "次長",
  "参事",
  "主幹",
  "主査",
  "補佐",
  "理事",
  "政策監",
  "管理者",
]);

/**
 * ○ マーカー付きの発言ヘッダーから発言者情報を抽出する。
 *
 * 対応パターン:
 *   ○議長（山田太郎君）       → role=議長, name=山田太郎
 *   ○町長（鈴木一郎君）       → role=町長, name=鈴木一郎
 *   ○総務常任委員長（田中重夫君） → role=委員長, name=田中重夫
 *   ○１番（佐藤花子君）       → role=議員, name=佐藤花子
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

    // 番号付き議員: ○１番（佐藤花子君）
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
    if (/^[○◯◎●]\s*[（(].*?(?:登壇|退席|退場|着席).*?[）)]$/.test(trimmed))
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
      `[124214-ichinomiya] PDF 取得失敗: ${pdfUrl}`,
      err instanceof Error ? err.message : err
    );
    return null;
  }
}

/**
 * PDF をダウンロード・テキスト抽出し、MeetingData に変換する。
 */
export async function buildMeetingData(
  params: IchinomiyaDetailParams,
  municipalityCode: string
): Promise<MeetingData | null> {
  const text = await fetchPdfText(params.pdfUrl);
  if (!text) return null;

  const statements = parseStatements(text);
  if (statements.length === 0) return null;

  const heldOn = parseHeldOn(params.pdfUrl);
  if (!heldOn) return null;

  return {
    municipalityCode,
    title: params.title,
    meetingType: params.meetingType,
    heldOn,
    sourceUrl: params.pdfUrl,
    externalId: `ichinomiya_${encodeURIComponent(params.pdfUrl)}`,
    statements,
  };
}

/**
 * PDF URL から開催日を推定する。
 *
 * パターン 1: YYYYMMDD.pdf → 2024-05-29
 * パターン 2: R{年}.{月}kaigiroku.pdf → 年月から YYYY-MM-01
 * パターン 3: H30.{月}kaigiroku.pdf → 年月から YYYY-MM-01
 * パターン 4: gikai{YY}{MMDD}.pdf → 和暦年月日から YYYY-MM-DD
 *
 * 解析できない場合は null を返す（フォールバック値禁止）。
 */
export function parseHeldOn(pdfUrl: string): string | null {
  const filename = pdfUrl.split("/").pop() ?? "";

  // パターン 1: YYYYMMDD.pdf（例: 20240529.pdf）
  const pattern1 = filename.match(/^(\d{4})(\d{2})(\d{2})\.pdf$/i);
  if (pattern1) {
    const y = pattern1[1]!;
    const m = pattern1[2]!;
    const d = pattern1[3]!;
    return `${y}-${m}-${d}`;
  }

  // パターン 2: R{年}.{月}kaigiroku.pdf（令和）
  const pattern2 = filename.match(/^R(\d+|元)\.(\d+)kaigiroku/i);
  if (pattern2) {
    const rYear = pattern2[1] === "元" ? 1 : parseInt(pattern2[1]!, 10);
    const month = parseInt(pattern2[2]!, 10);
    const seirekiYear = 2018 + rYear;
    return `${seirekiYear}-${String(month).padStart(2, "0")}-01`;
  }

  // パターン 3: H30.{月}kaigiroku.pdf（平成30年）
  const pattern3 = filename.match(/^H(\d+)\.(\d+)kaigiroku/i);
  if (pattern3) {
    const hYear = parseInt(pattern3[1]!, 10);
    const month = parseInt(pattern3[2]!, 10);
    const seirekiYear = 1988 + hYear;
    return `${seirekiYear}-${String(month).padStart(2, "0")}-01`;
  }

  // パターン 4: gikai{YY}{MMDD or MDD}.pdf
  // 例: gikai251205.pdf → 平成25年12月5日, gikai25304.pdf → 平成25年3月4日
  // 残り桁数が3桁なら M+DD、4桁なら MM+DD
  const pattern4 = filename.match(/^gikai(\d{2})(\d{3,4})[\.(]/i);
  if (pattern4) {
    const hYear = parseInt(pattern4[1]!, 10);
    const rest = pattern4[2]!;
    const seirekiYear = 1988 + hYear;
    if (rest.length === 4) {
      // MMDD 形式（例: 1205 → 12月5日）
      const month = parseInt(rest.slice(0, 2), 10);
      const day = parseInt(rest.slice(2), 10);
      return `${seirekiYear}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    } else {
      // MDD 形式（例: 304 → 3月4日, 918 → 9月18日）
      const month = parseInt(rest.slice(0, 1), 10);
      const day = parseInt(rest.slice(1), 10);
      return `${seirekiYear}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    }
  }

  // 解析できない場合は null（フォールバック値禁止）
  console.warn(`[124214-ichinomiya] parseHeldOn: 開催日解析不可 url=${pdfUrl}`);
  return null;
}
