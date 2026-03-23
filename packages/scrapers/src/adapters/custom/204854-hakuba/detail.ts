/**
 * 白馬村議会 -- detail フェーズ
 *
 * PDF をダウンロードしてテキストを抽出し、発言者パターンで分割して
 * ParsedStatement 配列を生成する。
 *
 * 発言フォーマット（〇マーカーなし）:
 *   議長（太田伸子君） ただいまから会議を開きます。
 *   村長（丸山俊郎君） お答えいたします。
 *   第８番（津滝俊幸君） 質問いたします。
 *   総務課長（田中克俊君） お答えいたします。
 *   参事兼建設課長（矢口俊樹君） お答えいたします。
 *   産業経済委員長（切久保達也君） ご報告申し上げます。
 *
 * マーカー: なし（role（name君）パターンで直接判定）
 */

import { createHash } from "node:crypto";
import { extractText, getDocumentProxy } from "unpdf";
import type { MeetingData, ParsedStatement } from "../../../utils/types";
import { extractHeldOnFromText, fetchBinary } from "./shared";

export interface HakubaDetailParams {
  title: string;
  pdfUrl: string;
  meetingType: string;
  headingYear: number;
}

// 役職サフィックス（長い方を先に置いて誤マッチを防ぐ）
const ROLE_SUFFIXES = [
  "議会運営委員長",
  "特別委員長",
  "副委員長",
  "委員長",
  "副議長",
  "議長",
  "副村長",
  "村長",
  "副教育長",
  "教育長",
  "教育次長",
  "議会事務局長",
  "事務局長",
  "局長",
  "会計管理者会計室長",
  "会計管理者",
  "管理者",
  "副部長",
  "部長",
  "副課長",
  "課長補佐",
  "課長",
  "係長",
  "所長",
  "参事",
  "主幹",
  "主査",
  "補佐",
  "議員",
  "委員",
];

// 行政側の役職（答弁者として分類する）
const ANSWER_ROLES = new Set([
  "村長",
  "副村長",
  "教育長",
  "副教育長",
  "教育次長",
  "議会事務局長",
  "事務局長",
  "局長",
  "会計管理者会計室長",
  "会計管理者",
  "管理者",
  "部長",
  "副部長",
  "課長",
  "副課長",
  "課長補佐",
  "係長",
  "所長",
  "参事",
  "主幹",
  "主査",
  "補佐",
]);

/**
 * 発言ヘッダーから発言者情報を抽出する。
 *
 * 対応パターン:
 *   議長（太田伸子君） → role=議長, name=太田伸子
 *   村長（丸山俊郎君） → role=村長, name=丸山俊郎
 *   第８番（津滝俊幸君） → role=議員, name=津滝俊幸
 *   総務課長（田中克俊君） → role=課長, name=田中克俊
 *   参事兼建設課長（矢口俊樹君） → role=課長, name=矢口俊樹
 *   産業経済委員長（切久保達也君） → role=委員長, name=切久保達也
 */
export function parseSpeaker(text: string): {
  speakerName: string | null;
  speakerRole: string | null;
  content: string;
} {
  // パターン: role（name + 君|様|議員）content
  const match = text.match(
    /^(.+?)[（(](.+?)(?:君|様|議員)[）)]\s*([\s\S]*)/,
  );
  if (match) {
    const rolePart = match[1]!.trim();
    const rawName = match[2]!.replace(/[\s\u3000]+/g, "").trim();
    const content = match[3]!.trim();

    // 番号付き議員: 第８番（津滝俊幸君）
    if (/^第[\d０-９]+番$/.test(rolePart)) {
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

  return { speakerName: null, speakerRole: null, content: text.trim() };
}

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
    speakerRole === "副委員長" ||
    speakerRole === "議会運営委員長" ||
    speakerRole === "特別委員長"
  )
    return "remark";
  for (const role of ANSWER_ROLES) {
    if (speakerRole.endsWith(role)) return "answer";
  }
  return "question";
}

/**
 * 発言者パターンにマッチする正規表現。
 * 白馬村の PDF は〇マーカーがなく、
 * 「role（name君）」の形式で発言を区切る。
 * PDF テキストは改行なしの連続テキストのため、
 * 文中どこにでも出現しうる。
 *
 * 役職部分のパターン（長い方を先に配置）:
 * - 議会運営委員長, 特別委員長, 副委員長, 委員長
 * - 副議長, 議長
 * - 副村長, 村長
 * - 副教育長, 教育長, 教育次長
 * - 議会事務局長, 事務局長, 局長
 * - 会計管理者会計室長, 会計管理者, 管理者
 * - 副部長, 部長, 副課長, 課長補佐, 課長, 係長, 所長
 * - 参事, 主幹, 主査, 補佐
 * - 第N番（議員）
 */
const SPEAKER_RE =
  /(?:[^\s（()）]{0,20}?(?:議会運営委員長|特別委員長|副委員長|委員長|副議長|議長|副村長|村長|副教育長|教育長|教育次長|議会事務局長|事務局長|局長|会計管理者会計室長|会計管理者|管理者|副部長|部長|副課長|課長補佐|課長|係長|所長|参事|主幹|主査|補佐)|第[\d０-９]+番)[（(][^）)]+?君[）)]/g;

/**
 * PDF から抽出したテキストを ParsedStatement 配列に変換する。
 * 「role（name君）」パターンの出現位置でテキストを分割し、
 * 各ブロックを発言として抽出する。
 */
export function parseStatements(text: string): ParsedStatement[] {
  // 全ての発言者パターンの位置を見つける
  const matches: { index: number; match: string }[] = [];
  let m: RegExpExecArray | null;
  // Reset lastIndex for global regex
  SPEAKER_RE.lastIndex = 0;
  while ((m = SPEAKER_RE.exec(text)) !== null) {
    matches.push({ index: m.index, match: m[0] });
  }

  if (matches.length === 0) return [];

  const statements: ParsedStatement[] = [];
  let offset = 0;

  for (let i = 0; i < matches.length; i++) {
    const start = matches[i]!.index;
    const end = i < matches.length - 1 ? matches[i + 1]!.index : text.length;
    const block = text.substring(start, end).trim();
    if (!block) continue;

    const normalized = block.replace(/\s+/g, " ");
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
      `[204854-hakuba] PDF 取得失敗: ${pdfUrl}`,
      err instanceof Error ? err.message : err,
    );
    return null;
  }
}

/**
 * detailParams から MeetingData を組み立てる。
 * PDF をダウンロード・テキスト抽出し、発言を分割する。
 */
export async function buildMeetingData(
  params: HakubaDetailParams,
  municipalityId: string,
): Promise<MeetingData | null> {
  const text = await fetchPdfText(params.pdfUrl);
  if (!text) return null;

  const statements = parseStatements(text);
  if (statements.length === 0) return null;

  // PDF 本文から開催日を抽出
  const heldOn = extractHeldOnFromText(text);
  if (!heldOn) return null;

  return {
    municipalityId,
    title: params.title,
    meetingType: params.meetingType,
    heldOn,
    sourceUrl: params.pdfUrl,
    externalId: `hakuba_${heldOn}_${params.title}`,
    statements,
  };
}
