/**
 * 小川村議会 -- detail フェーズ
 *
 * PDF をダウンロードしてテキストを抽出し、発言者パターンで分割して
 * ParsedStatement 配列を生成する。
 *
 * 発言フォーマット（◯/〇 マーカーあり）:
 *   ◯議長（西沢哲朗） ただ今の時刻は…
 *   ◯村長（染野隆嗣） ６月定例議会開会にあたり…
 *   〇１番（新井幹夫議員） おはようございます。
 *   ◯２番（新井幹夫議員） 具体的に…
 *   ◯総務課長（大日方浩和） お答えいたします。
 *   ◯教育長（北田愛治） お答えいたします。
 *
 * マーカー: ◯ または 〇（丸記号）
 */

import { createHash } from "node:crypto";
import { extractText, getDocumentProxy } from "../../../utils/pdf";
import type { MeetingData, ParsedStatement } from "../../../utils/types";
import { extractHeldOnFromText, fetchBinary } from "./shared";

export interface OgawaNaganoDetailParams {
  title: string;
  pdfUrl: string;
  meetingType: string;
  monthSection: string;
  typeSection: string;
}

// 役職サフィックス（長い方を先に置いて誤マッチを防ぐ）
const ROLE_SUFFIXES = [
  "議会運営委員長",
  "社会文教常任委員長",
  "総務建経常任委員長",
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
  "書記",
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
  "書記",
]);

/**
 * 発言ヘッダーから発言者情報を抽出する。
 *
 * 対応パターン:
 *   議長（西沢哲朗） → role=議長, name=西沢哲朗
 *   村長（染野隆嗣） → role=村長, name=染野隆嗣
 *   １番（新井幹夫議員） → role=議員, name=新井幹夫
 *   10番（峰村正一議員） → role=議員, name=峰村正一
 *   総務課長（大日方浩和） → role=課長, name=大日方浩和
 */
export function parseSpeaker(text: string): {
  speakerName: string | null;
  speakerRole: string | null;
  content: string;
} {
  // パターン: role（name + 君|様|議員|省略）content
  const match = text.match(
    /^(.+?)[（(](.+?)(?:君|様|議員)?[）)]\s*([\s\S]*)/,
  );
  if (match) {
    const rolePart = match[1]!.trim();
    const rawName = match[2]!.replace(/[\s\u3000]+/g, "").trim();
    const content = match[3]!.trim();

    // 番号付き議員: １番（新井幹夫議員）, 10番（峰村正一議員）
    if (/^[\d０-９]+番$/.test(rolePart)) {
      return { speakerName: rawName, speakerRole: "議員", content };
    }

    // 役職マッチ（長い順に試す）
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
    speakerRole === "特別委員長" ||
    speakerRole === "社会文教常任委員長" ||
    speakerRole === "総務建経常任委員長"
  )
    return "remark";
  for (const role of ANSWER_ROLES) {
    if (speakerRole.endsWith(role)) return "answer";
  }
  return "question";
}

/**
 * 発言者パターンにマッチする正規表現。
 * 小川村の PDF は ◯ または 〇 マーカーで発言が始まる。
 * 「◯role（name）」の形式。
 */
const SPEAKER_RE =
  /[◯〇](?:[^\s（()）]{0,30}?(?:議会運営委員長|社会文教常任委員長|総務建経常任委員長|特別委員長|副委員長|委員長|副議長|議長|副村長|村長|副教育長|教育長|教育次長|議会事務局長|事務局長|局長|会計管理者|管理者|副部長|部長|副課長|課長補佐|課長|係長|所長|参事|主幹|主査|補佐|書記)|[\d０-９]+番)[（(][^）)]+?(?:君|様|議員)?[）)]/g;

/**
 * PDF から抽出したテキストを ParsedStatement 配列に変換する。
 * 「◯/〇 role（name）」パターンの出現位置でテキストを分割する。
 */
export function parseStatements(text: string): ParsedStatement[] {
  const matches: { index: number; match: string }[] = [];
  let m: RegExpExecArray | null;
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

    // ◯/〇 マーカーを除去して発言者パース
    const normalized = block.replace(/^[◯〇]/, "").replace(/\s+/g, " ");
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
      `[205885-ogawa-nagano] PDF 取得失敗: ${pdfUrl}`,
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
  params: OgawaNaganoDetailParams,
  municipalityCode: string,
): Promise<MeetingData | null> {
  const text = await fetchPdfText(params.pdfUrl);
  if (!text) return null;

  const statements = parseStatements(text);
  if (statements.length === 0) return null;

  // PDF 本文から開催日を抽出（「議事の経過」部分の日付を使う）
  const heldOn = extractHeldOnFromText(text);
  if (!heldOn) return null;

  return {
    municipalityCode,
    title: params.title,
    meetingType: params.meetingType,
    heldOn,
    sourceUrl: params.pdfUrl,
    externalId: `ogawa-nagano_${heldOn}_${params.title}`,
    statements,
  };
}
