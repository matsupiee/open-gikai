/**
 * 山ノ内町議会 -- detail フェーズ
 *
 * PDF をダウンロードしてテキストを抽出し、発言者パターンで分割して
 * ParsedStatement 配列を生成する。
 *
 * 発言フォーマット（〇マーカーあり）:
 *   〇議長（鈴木一郎君） ただいまから会議を開きます。
 *   〇町長（田中次郎君） お答えいたします。
 *   〇３番（山田太郎君） 質問いたします。
 *   〇総務課長（佐藤花子君） ご説明いたします。
 */

import { createHash } from "node:crypto";
import { extractText, getDocumentProxy } from "../../../utils/pdf";
import type { MeetingData, ParsedStatement } from "../../../utils/types";
import { extractHeldOnFromText, fetchBinary, toHalfWidth } from "./shared";

export interface YamanouchiDetailParams {
  sessionName: string;
  date: string;
  type: string;
  speakers: string[];
  pdfUrl: string;
  meetingType: string;
  year: number;
}

// 役職サフィックス（長いものを先に置いて誤マッチを防ぐ）
const ROLE_SUFFIXES = [
  "議会運営委員長",
  "特別委員長",
  "副委員長",
  "委員長",
  "副議長",
  "議長",
  "副町長",
  "町長",
  "副教育長",
  "教育長",
  "教育次長",
  "議会事務局長",
  "事務局長",
  "局長",
  "会計管理者",
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
  "町長",
  "副町長",
  "教育長",
  "副教育長",
  "教育次長",
  "議会事務局長",
  "事務局長",
  "局長",
  "会計管理者",
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
 *   〇議長（鈴木一郎君） → role=議長, name=鈴木一郎
 *   〇町長（田中次郎君） → role=町長, name=田中次郎
 *   〇３番（山田太郎君） → role=議員, name=山田太郎
 *   〇総務課長（佐藤花子君） → role=課長, name=佐藤花子
 *   〇総務課長（佐藤花子様） → role=課長, name=佐藤花子
 */
export function parseSpeaker(text: string): {
  speakerName: string | null;
  speakerRole: string | null;
  content: string;
} {
  // 〇 マーカーを除去して正規化
  const normalized = toHalfWidth(text.replace(/^[〇○◯]/u, "").trim());

  // パターン: role（name + 君|様|議員）content
  const match = normalized.match(
    /^(.+?)[（(](.+?)(?:君|様|議員)[）)]\s*([\s\S]*)/,
  );
  if (match) {
    const rolePart = match[1]!.trim();
    const rawName = match[2]!.replace(/[\s\u3000]+/g, "").trim();
    const content = match[3]!.trim();

    // 番号付き議員: ３番 or 3番（全角半角対応済み）
    if (/^\d+番$/.test(rolePart)) {
      return { speakerName: rawName, speakerRole: "議員", content };
    }

    // 役職マッチ（長いものを先に）
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
 * 山ノ内町の PDF は 〇 マーカーで発言を区切る。
 *
 * 役職部分のパターン（長い方を先に配置）:
 * - 議会運営委員長, 特別委員長, 副委員長, 委員長
 * - 副議長, 議長
 * - 副町長, 町長
 * - 副教育長, 教育長, 教育次長
 * - 議会事務局長, 事務局長, 局長
 * - 会計管理者
 * - 副部長, 部長, 副課長, 課長補佐, 課長, 係長, 所長
 * - 参事, 主幹, 主査, 補佐
 * - N番（議員）
 */
const SPEAKER_RE =
  /[〇○◯](?:[^\s（()）]{0,20}?(?:議会運営委員長|特別委員長|副委員長|委員長|副議長|議長|副町長|町長|副教育長|教育長|教育次長|議会事務局長|事務局長|局長|会計管理者|副部長|部長|副課長|課長補佐|課長|係長|所長|参事|主幹|主査|補佐)|\d+番)[（(][^）)]+?(?:君|様|議員)[）)]/g;

/**
 * PDF から抽出したテキストを ParsedStatement 配列に変換する。
 * 〇 マーカーパターンの出現位置でテキストを分割し、
 * 各ブロックを発言として抽出する。
 */
export function parseStatements(text: string): ParsedStatement[] {
  // 全角数字を半角に変換してから処理
  const normalized = toHalfWidth(text);

  // 全ての発言者パターンの位置を見つける
  const matches: { index: number; match: string }[] = [];
  let m: RegExpExecArray | null;
  SPEAKER_RE.lastIndex = 0;
  while ((m = SPEAKER_RE.exec(normalized)) !== null) {
    matches.push({ index: m.index, match: m[0] });
  }

  if (matches.length === 0) return [];

  const statements: ParsedStatement[] = [];
  let offset = 0;

  for (let i = 0; i < matches.length; i++) {
    const start = matches[i]!.index;
    const end =
      i < matches.length - 1 ? matches[i + 1]!.index : normalized.length;
    const block = normalized.substring(start, end).trim();
    if (!block) continue;

    const singleLine = block.replace(/\s+/g, " ");
    const { speakerName, speakerRole, content } = parseSpeaker(singleLine);
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
      `[205613-yamanouchi] PDF 取得失敗: ${pdfUrl}`,
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
  params: YamanouchiDetailParams,
  municipalityCode: string,
): Promise<MeetingData | null> {
  // 目次 PDF はスキップ
  if (params.type === "目次") return null;

  const text = await fetchPdfText(params.pdfUrl);
  if (!text) return null;

  const statements = parseStatements(text);
  if (statements.length === 0) return null;

  // PDF 本文から開催日を抽出
  const heldOn = extractHeldOnFromText(text);
  if (!heldOn) return null;

  const title = `${params.sessionName} ${params.type}`;

  return {
    municipalityCode,
    title,
    meetingType: params.meetingType,
    heldOn,
    sourceUrl: params.pdfUrl,
    externalId: `yamanouchi_${heldOn}_${params.type}`,
    statements,
  };
}
