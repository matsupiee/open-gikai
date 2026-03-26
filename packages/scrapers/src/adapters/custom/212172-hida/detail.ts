/**
 * 飛騨市議会 -- detail フェーズ
 *
 * PDF をダウンロードしてテキストを抽出し、マーカー記号で発言を分割して
 * ParsedStatement 配列を生成する。
 *
 * マーカー記号:
 *   ○ (U+25CB) = 議員の発言（question）
 *   ◎ (U+25CE) = 議長の発言（remark）
 *   □ (U+25A1) = 行政側答弁者（部長・課長等）（answer）
 *   △ (U+25B3) = 市長答弁（answer）
 *   ◆ (U+25C6) = 議事進行見出し（日程第N等）（remark）
 *   〇 (U+3007) = 出席議員等メタ情報（スキップ）
 *
 * 発言フォーマット:
 *   ◎議長（井端浩二） ただいまから会議を開きます。
 *   ○１番（佐藤克成） 質問いたします。
 *   △市長（都竹淳也） お答えいたします。
 *   □商工観光部長（畑上あづさ） お答えいたします。
 *   ◆日程第１ 会議録署名議員の指名
 */

import { createHash } from "node:crypto";
import { extractText, getDocumentProxy } from "../../../utils/pdf";
import type { MeetingData, ParsedStatement } from "../../../utils/types";
import { extractHeldOnFromText, fetchBinary } from "./shared";

export interface HidaDetailParams {
  title: string;
  pdfUrl: string;
  meetingType: string;
  heldOn: string | null;
  speakerName: string | null;
  sessionTitle: string;
}

// 発言マーカー（〇 U+3007 はメタ情報用なので含めない）
const SPEECH_MARKERS = "○◎□△◆";

// 役職サフィックス（長い方を先に置いて誤マッチを防ぐ）
const ROLE_SUFFIXES = [
  "議会運営委員長",
  "副委員長",
  "委員長",
  "副議長",
  "議長",
  "副市長",
  "市長",
  "副町長",
  "町長",
  "副教育長",
  "教育長",
  "教育次長",
  "事務局長",
  "局長",
  "管理者",
  "副部長",
  "部長",
  "副課長",
  "課長補佐",
  "室長",
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

/**
 * マーカー付きの発言ヘッダーから発言者情報を抽出する。
 *
 * 対応パターン:
 *   ◎議長（井端浩二）　→ role=議長, name=井端浩二
 *   △市長（都竹淳也）　→ role=市長, name=都竹淳也
 *   ○１番（佐藤克成）　→ role=議員, name=佐藤克成
 *   □商工観光部長（畑上あづさ）→ role=部長, name=畑上あづさ
 */
export function parseSpeaker(text: string): {
  speakerName: string | null;
  speakerRole: string | null;
  content: string;
} {
  const stripped = text.replace(/^[○◎□△◆]\s*/, "");

  // パターン1: role（name + 君|様|議員）content
  const matchWithSuffix = stripped.match(
    /^(.+?)[（(](.+?)(?:君|様|議員)[）)]\s*([\s\S]*)/,
  );
  // パターン2: role（name）content（敬称なし — 飛騨市 PDF は敬称なしのケースが多い）
  const matchWithoutSuffix = stripped.match(
    /^(.+?)[（(]([^）)]+)[）)]\s*([\s\S]*)/,
  );

  const match = matchWithSuffix ?? matchWithoutSuffix;
  if (match) {
    const rolePart = match[1]!.trim();
    let rawName = match[2]!.replace(/[\s\u3000]+/g, "").trim();
    const content = match[3]!.trim();

    // 敬称ありパターンでマッチした場合は敬称が除去済み、
    // 敬称なしパターンの場合は末尾の「君」「様」を念のため除去
    if (!matchWithSuffix) {
      rawName = rawName.replace(/(?:君|様|議員)$/, "");
    }

    // 番号付き議員: ○１番（佐藤克成君）
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

  // マーカーはあるがカッコパターンに合致しない場合
  const headerMatch = stripped.match(
    /^([^\s\u3000]{1,30})[\s\u3000]+([\s\S]*)/,
  );
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

/**
 * マーカー文字から発言種別を判定する。
 * マーカーが明確なので、マーカーを最優先で使い、
 * マーカーが ◆ の場合は remark、
 * 議長パターンのみ remark 判定をフォールバック用に残す。
 */
export function classifyKind(
  marker: string,
  speakerRole: string | null,
): "remark" | "question" | "answer" {
  switch (marker) {
    case "◎":
      return "remark"; // 議長
    case "△":
      return "answer"; // 市長
    case "□":
      return "answer"; // 行政側答弁者
    case "○":
      return "question"; // 議員
    case "◆":
      return "remark"; // 議事進行見出し
    default:
      // フォールバック
      if (!speakerRole) return "remark";
      if (
        speakerRole === "議長" ||
        speakerRole === "副議長" ||
        speakerRole === "委員長" ||
        speakerRole === "副委員長"
      )
        return "remark";
      return "question";
  }
}

/**
 * PDF から抽出したテキストを ParsedStatement 配列に変換する。
 * ○◎□△◆ マーカーで分割する。
 * 〇 (U+3007) はメタ情報用のためスキップする。
 */
export function parseStatements(text: string): ParsedStatement[] {
  // マーカーで分割（○◎□△◆）
  const blocks = text.split(/(?=[○◎□△◆])/);
  const statements: ParsedStatement[] = [];
  let offset = 0;

  for (const block of blocks) {
    const trimmed = block.trim();
    if (!trimmed) continue;

    const marker = trimmed.charAt(0);
    if (!SPEECH_MARKERS.includes(marker)) continue;

    // ◆ の議事進行見出しは発言ではないのでスキップ
    if (marker === "◆") continue;

    // 〇出席議員等のメタ情報（万が一残っていたら）をスキップ
    if (/^[○◎□△]議事日程/.test(trimmed)) continue;
    if (/^[○◎□△]出席議員/.test(trimmed)) continue;
    if (/^[○◎□△]欠席議員/.test(trimmed)) continue;
    if (/^[○◎□△]出席説明/.test(trimmed)) continue;
    if (/^[○◎□△]出席事務/.test(trimmed)) continue;
    if (/^[○◎□△]説明のため/.test(trimmed)) continue;
    if (/^[○◎□△]事務局出席/.test(trimmed)) continue;
    if (/^[○◎□△]議事の経過/.test(trimmed)) continue;
    if (/^[○◎□△]本日の会議/.test(trimmed)) continue;
    if (/^[○◎□△]付託議案/.test(trimmed)) continue;
    if (/^[○◎□△]会議の経過/.test(trimmed)) continue;
    if (/^[○◎□△]職務のため/.test(trimmed)) continue;

    const normalized = trimmed.replace(/\s+/g, " ");
    const { speakerName, speakerRole, content } = parseSpeaker(normalized);
    if (!content) continue;

    const kind = classifyKind(marker, speakerRole);
    const contentHash = createHash("sha256").update(content).digest("hex");
    const startOffset = offset;
    const endOffset = offset + content.length;
    statements.push({
      kind,
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
      `[212172-hida] PDF 取得失敗: ${pdfUrl}`,
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
  params: HidaDetailParams,
  municipalityCode: string,
): Promise<MeetingData | null> {
  const text = await fetchPdfText(params.pdfUrl);
  if (!text) return null;

  const statements = parseStatements(text);
  if (statements.length === 0) return null;

  // 開催日はリンクテキストから取得済みの場合はそれを使い、
  // なければ PDF 本文から抽出する
  const heldOn = params.heldOn ?? extractHeldOnFromText(text);
  if (!heldOn) return null;

  return {
    municipalityCode,
    title: params.title,
    meetingType: params.meetingType,
    heldOn,
    sourceUrl: params.pdfUrl,
    externalId: `hida_${heldOn}_${params.title}`,
    statements,
  };
}
