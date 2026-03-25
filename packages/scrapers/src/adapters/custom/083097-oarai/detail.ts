/**
 * 大洗町議会 -- detail フェーズ
 *
 * PDF をダウンロードしてテキストを抽出し、○ マーカーで発言を分割して
 * ParsedStatement 配列を生成する。
 *
 * 発言フォーマット（PDF から抽出したテキストを想定）:
 *   ○議長（田中太郎君） ただいまから本日の会議を開きます。
 *   ○町長（鈴木一郎君） お答えいたします。
 *   ○１番（山田花子君） 質問いたします。
 */

import { createHash } from "node:crypto";
import { extractText, getDocumentProxy } from "unpdf";
import type { MeetingData, ParsedStatement } from "../../../utils/types";
import { fetchBinary } from "./shared";
import type { OaraiPdfRecord } from "./list";
import { extractFileName } from "./list";

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
  "係長",
  "次長",
  "参事",
  "主幹",
  "主査",
  "補佐",
  "管理者",
  "事務局長",
]);

/**
 * ○ マーカー付きの発言ヘッダーから発言者情報を抽出する。
 *
 * 対応パターン:
 *   ○議長（田中太郎君）     → role=議長, name=田中太郎
 *   ○町長（鈴木一郎君）     → role=町長, name=鈴木一郎
 *   ○１番（山田花子君）     → role=null, name=山田花子
 *   ○福祉課長（佐藤次郎君） → role=課長, name=佐藤次郎
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
    const rawName = match[2]!.replace(/[\s　]+/g, " ").trim();
    const content = match[3]!.trim();

    // 役職マッチ
    for (const suffix of ROLE_SUFFIXES) {
      if (rolePart === suffix || rolePart.endsWith(suffix)) {
        return { speakerName: rawName, speakerRole: suffix, content };
      }
    }

    // 番号付き（1番・2番など、全角半角両対応）の議員
    const normalizedRole = rolePart.replace(/[０-９]/g, (c) =>
      String.fromCharCode(c.charCodeAt(0) - 0xff10 + 0x30)
    );
    if (/^\d+番$/.test(normalizedRole)) {
      return { speakerName: rawName, speakerRole: "議員", content };
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
 * PDF テキストから開催日（YYYY-MM-DD）を抽出する。
 *
 * 大洗町の場合、ファイル名またはPDFテキストから開催日を取得する。
 * PDFテキスト内の日付パターン（優先）またはファイル名の dayLabel から抽出。
 *
 * 対応パターン:
 *   「令和6年12月3日 開 会」 → 最初の開会日を初日として使用
 *   「令和6年12月3日午前10時開会」
 *   「令和６年１２月３日」（全角数字）
 */
export function parseHeldOn(text: string): string | null {
  // 全角数字を半角に変換
  const normalized = text.replace(/[０-９]/g, (c) =>
    String.fromCharCode(c.charCodeAt(0) - 0xff10 + 0x30)
  );

  // 令和年のパターン（優先）
  const reiwaPatterns = [
    /令和(元|\d+)年(\d+)月(\d+)日\s*開\s*会/,
    /令和(元|\d+)年(\d+)月(\d+)日\s*午前/,
    /令和(元|\d+)年(\d+)月(\d+)日/,
  ];

  for (const pattern of reiwaPatterns) {
    const m = normalized.match(pattern);
    if (m?.[1] && m[2] && m[3]) {
      const n = m[1] === "元" ? 1 : parseInt(m[1], 10);
      const year = 2018 + n;
      const month = parseInt(m[2], 10);
      const day = parseInt(m[3], 10);
      return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    }
  }

  // 平成年のパターン
  const heiseiPatterns = [
    /平成(元|\d+)年(\d+)月(\d+)日\s*開\s*会/,
    /平成(元|\d+)年(\d+)月(\d+)日/,
  ];

  for (const pattern of heiseiPatterns) {
    const m = normalized.match(pattern);
    if (m?.[1] && m[2] && m[3]) {
      const n = m[1] === "元" ? 1 : parseInt(m[1], 10);
      const year = 1988 + n;
      const month = parseInt(m[2], 10);
      const day = parseInt(m[3], 10);
      return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    }
  }

  return null;
}

/**
 * dayLabel と会議タイトルから開催年を取得して YYYY-MM-DD を生成する。
 * PDFテキストから日付が取れなかった場合のフォールバック。
 *
 * 例: dayLabel="12月3日", title="令和6年第4回議会定例会" → "2024-12-03"
 */
export function parseDateFromDayLabel(
  dayLabel: string,
  title: string
): string | null {
  // 全角数字を半角に変換
  const normLabel = dayLabel.replace(/[０-９]/g, (c) =>
    String.fromCharCode(c.charCodeAt(0) - 0xff10 + 0x30)
  );
  const normTitle = title.replace(/[０-９]/g, (c) =>
    String.fromCharCode(c.charCodeAt(0) - 0xff10 + 0x30)
  );

  const dateMatch = normLabel.match(/(\d+)月(\d+)日/);
  if (!dateMatch?.[1] || !dateMatch[2]) return null;

  const month = parseInt(dateMatch[1], 10);
  const day = parseInt(dateMatch[2], 10);

  // タイトルから年を抽出
  const reiwaMatch = normTitle.match(/令和(元|\d+)年/);
  if (reiwaMatch?.[1]) {
    const n = reiwaMatch[1] === "元" ? 1 : parseInt(reiwaMatch[1], 10);
    const year = 2018 + n;
    return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
  }

  const heiseiMatch = normTitle.match(/平成(元|\d+)年/);
  if (heiseiMatch?.[1]) {
    const n = heiseiMatch[1] === "元" ? 1 : parseInt(heiseiMatch[1], 10);
    const year = 1988 + n;
    return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
  }

  return null;
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

    // 応招議員・不応招議員などの名簿行をスキップ
    if (/^[○◯◎●]\s*(?:応招|不応招)/.test(trimmed)) continue;

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
      `[083097-oarai] PDF 取得失敗: ${pdfUrl}`,
      err instanceof Error ? err.message : err
    );
    return null;
  }
}

/**
 * PDF をダウンロード・テキスト抽出し、MeetingData に変換する。
 */
export async function buildMeetingData(
  record: OaraiPdfRecord,
  municipalityId: string
): Promise<MeetingData | null> {
  const text = await fetchPdfText(record.pdfUrl);
  if (!text) return null;

  // PDFテキストから開催日を抽出、失敗した場合は dayLabel とタイトルから推定
  let heldOn = parseHeldOn(text);
  if (heldOn === null) {
    heldOn = parseDateFromDayLabel(record.dayLabel, record.title);
  }
  if (heldOn === null) return null;

  const statements = parseStatements(text);
  if (statements.length === 0) return null;

  const fileKey = extractFileName(record.pdfUrl);

  return {
    municipalityId,
    title: record.title,
    meetingType: record.meetingType,
    heldOn,
    sourceUrl: record.pdfUrl,
    externalId: `oarai_${fileKey}`,
    statements,
  };
}
