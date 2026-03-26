/**
 * 川南町議会 -- detail フェーズ
 *
 * PDF をダウンロードしてテキストを抽出し、○ マーカーで発言を分割して
 * ParsedStatement 配列を生成する。
 *
 * 発言フォーマット:
 *   ○議長（河野 浩一議員） ただいまから…
 *   ○町長（宮崎 吉敏君） お答えいたします。
 *   ○議員（内藤 逸子議員） 質問いたします。
 *   ○福祉課長（河野 賢二君） ご説明いたします。
 *
 * PDF 種別:
 *   - 定例会・臨時会 PDF: 複数日分を含む。heldOn は「令和X年Y月Z日 開 会」から初日を取得。
 *   - 一般質問 PDF: 1議員分。heldOn は冒頭「（ 令和X年 Y 月 Z 日 午前…開始 ）」から取得。
 */

import { createHash } from "node:crypto";
import { extractText, getDocumentProxy } from "../../../utils/pdf";
import type { MeetingData, ParsedStatement } from "../../../utils/types";
import { fetchBinary } from "./shared";
import type { KawaminamiPdfRecord } from "./list";

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
 *   ○議長（河野 浩一議員）  → role=議長, name=河野 浩一
 *   ○町長（宮崎 吉敏君）    → role=町長, name=宮崎 吉敏
 *   ○議員（内藤 逸子議員）  → role=議員, name=内藤 逸子
 *   ○福祉課長（河野 賢二君） → role=課長, name=河野 賢二
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
 * 一般質問 PDF:
 *   「（ 令和６年 12 月 10 日 午前９時 00 分 開始 ）」
 * 定例会・臨時会 PDF:
 *   「令和6年12月6日 開 会」 → 最初の開会日を初日として使用
 */
export function parseHeldOn(text: string): string | null {
  // 全角数字を半角に変換
  const normalized = text.replace(/[０-９]/g, (c) =>
    String.fromCharCode(c.charCodeAt(0) - 0xff10 + 0x30)
  );

  // 一般質問 PDF パターン: （ 令和X年 Y 月 Z 日 午前
  const ippanMatch = normalized.match(
    /[（(]\s*令和(\d+)年\s*(\d+)\s*月\s*(\d+)\s*日\s*午前/
  );
  if (ippanMatch) {
    const year = 2018 + parseInt(ippanMatch[1]!, 10);
    const month = parseInt(ippanMatch[2]!, 10);
    const day = parseInt(ippanMatch[3]!, 10);
    return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
  }

  // 定例会・臨時会 PDF パターン: 令和X年Y月Z日 開 会
  const kaikaiMatch = normalized.match(
    /令和(\d+)年(\d+)月(\d+)日\s*開\s*会/
  );
  if (kaikaiMatch) {
    const year = 2018 + parseInt(kaikaiMatch[1]!, 10);
    const month = parseInt(kaikaiMatch[2]!, 10);
    const day = parseInt(kaikaiMatch[3]!, 10);
    return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
  }

  // 平成年のフォールバック
  const heiseiMatch = normalized.match(
    /平成(\d+)年(\d+)月(\d+)日\s*開\s*会/
  );
  if (heiseiMatch) {
    const year = 1988 + parseInt(heiseiMatch[1]!, 10);
    const month = parseInt(heiseiMatch[2]!, 10);
    const day = parseInt(heiseiMatch[3]!, 10);
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
      `[454052-kawaminami] PDF 取得失敗: ${pdfUrl}`,
      err instanceof Error ? err.message : err
    );
    return null;
  }
}

/**
 * PDF をダウンロード・テキスト抽出し、MeetingData に変換する。
 */
export async function buildMeetingData(
  record: KawaminamiPdfRecord,
  municipalityCode: string
): Promise<MeetingData | null> {
  const text = await fetchPdfText(record.pdfUrl);
  if (!text) return null;

  const heldOn = parseHeldOn(text);
  if (heldOn === null) return null;

  const statements = parseStatements(text);
  if (statements.length === 0) return null;

  // externalId: pdfUrl からファイル ID を取得
  const fileIdMatch = record.pdfUrl.match(/\/attachment\/(\d+)\.pdf$/);
  const fileId = fileIdMatch?.[1] ?? record.pdfUrl;

  // ラベルが空でない場合はタイトルに付加
  const title = record.pdfLabel
    ? `${record.title} ${record.pdfLabel}`
    : record.title;

  return {
    municipalityCode,
    title,
    meetingType: record.meetingType,
    heldOn,
    sourceUrl: record.pdfUrl,
    externalId: `kawaminami_${fileId}`,
    statements,
  };
}
