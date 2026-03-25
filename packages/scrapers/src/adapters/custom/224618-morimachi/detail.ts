/**
 * 森町議会（静岡県）— detail フェーズ
 *
 * PDF をダウンロードしてテキストを抽出し、（ NAME 君 ） マーカーで発言を分割して
 * ParsedStatement 配列を生成する。
 *
 * 発言フォーマット（森町固有形式）:
 *   （ 𠮷 筋 惠 治 君 ）ただいまから本日の会議を開きます。
 *   （ 太 田 康 雄 君 ）お答えいたします。
 *
 * 名前はスペース区切りで表記される。役職は以下の方法で取得:
 *   - PDF冒頭のメンバーリスト: "町 長 太 田 康 雄" 形式
 *   - 役職アナウンス: "町長、太田康雄君。" 形式
 */

import { createHash } from "node:crypto";
import { extractText, getDocumentProxy } from "unpdf";
import type { MeetingData, ParsedStatement } from "../../../utils/types";
import type { MorimachMeeting } from "./list";
import { detectMeetingType, fetchBinary } from "./shared";

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
 * PDF冒頭のメンバーリストから 名前→役職 のマッピングを構築する。
 *
 * フォーマット例: "町 長 太 田 康 雄" → { "太田康雄": "町長" }
 */
export function buildNameRoleMap(text: string): Map<string, string> {
  const map = new Map<string, string>();

  // メンバーリストは冒頭 2000 文字以内に収まる
  const headerArea = text.slice(0, 2000);

  for (const role of ROLE_SUFFIXES) {
    // "役 職 氏 名" のスペース区切り形式を検索（改行をまたがない）
    const spacedRole = role.split("").join("[ \\t]+");
    const pattern = new RegExp(
      `${spacedRole}[ \\t]+([\\u4e00-\\u9fff\\uD840-\\uDFFF](?:[ \\t]+[\\u4e00-\\u9fff\\uD840-\\uDFFF]){1,4})`,
      "gu"
    );
    for (const m of headerArea.matchAll(pattern)) {
      const name = m[1]!.replace(/\s+/g, "");
      // 名前として妥当な長さ (2-8 文字) かつ役職キーワードを含まない
      if (
        name.length >= 2 &&
        name.length <= 8 &&
        !ROLE_SUFFIXES.some((r) => name.includes(r))
      ) {
        if (!map.has(name)) {
          map.set(name, role);
        }
      }
    }
  }

  // "役職、氏名君。" アナウンス形式も収集（本文全体から）
  for (const role of ROLE_SUFFIXES) {
    // "町長、太田康雄君。" など
    const announcePattern = new RegExp(`${role}[、，,]([^。「」]{2,8})君`, "g");
    for (const m of text.matchAll(announcePattern)) {
      const name = m[1]!.trim();
      if (name.length >= 2 && name.length <= 8) {
        if (!map.has(name)) {
          map.set(name, role);
        }
      }
    }
  }

  return map;
}

/**
 * 発言ブロック直前のテキストから役職を抽出する。
 *
 * 「議 長」「町 長」等のスペース区切りラベルを検索。
 */
export function extractRoleFromPreceding(
  preceding: string,
  nameRoleMap: Map<string, string>,
  speakerName: string
): string | null {
  // 1. 役職アナウンス: "役職、名前君" パターン
  for (const role of ROLE_SUFFIXES) {
    const pattern = new RegExp(`${role}[、，,][^。]*${speakerName}`);
    if (pattern.test(preceding)) {
      return role;
    }
  }

  // 2. スペース区切りの役職ラベルが末尾にある: "議 長 " "町 長 " 等
  const trimmedEnd = preceding.trimEnd();
  for (const role of ROLE_SUFFIXES) {
    const spacedRole = role.split("").join("\\s*");
    const spacedPattern = new RegExp(`(?:${spacedRole}\\s*)+$`);
    if (spacedPattern.test(trimmedEnd)) {
      return role;
    }
  }

  // 3. 名前マップから照合
  if (nameRoleMap.has(speakerName)) {
    return nameRoleMap.get(speakerName)!;
  }

  return null;
}

/**
 * PDF から抽出したテキストを ParsedStatement 配列に変換する。
 *
 * 森町固有の（ NAME 君 ）形式の発言ブロックを解析する。
 */
export function parseStatements(text: string): ParsedStatement[] {
  const statements: ParsedStatement[] = [];

  // 名前→役職マップを構築
  const nameRoleMap = buildNameRoleMap(text);

  // （ NAME 君 ） パターンで発言ブロックを分割
  // サロゲートペア文字に対応するため /u フラグを使用
  const speakerPattern = /（\s+((?:.\s+)*)君\s+）/gu;

  const allMatches = [...text.matchAll(speakerPattern)];

  // 名前として妥当なブロックのみを対象とする
  const validMatches = allMatches.filter((m) => {
    const namePart = m[1]!.replace(/\s+/g, "");
    // 有効な名前: 2-8 文字、数字・ASCII・引用符等を含まない
    return (
      namePart.length >= 2 &&
      namePart.length <= 8 &&
      !/[\d\u0020-\u007F「」！？、。０-９－]/.test(namePart)
    );
  });

  let offset = 0;

  for (let i = 0; i < validMatches.length; i++) {
    const m = validMatches[i]!;
    const speakerName = m[1]!.replace(/\s+/g, "");
    const speakerEnd = m.index! + m[0].length;

    // コンテンツ: 次の発言ブロック直前まで
    const nextSpeakerStart = validMatches[i + 1]?.index ?? text.length;
    const rawContent = text.slice(speakerEnd, nextSpeakerStart);

    // コンテンツのクリーニング:
    // - ページ番号 "- N -" を除去
    // - 役職ラベル行 "議 長 " 等を除去
    // - 余分な空白を正規化
    const content = rawContent
      .replace(/- \d+ -/g, "")
      .replace(/\s*(?:[\u4e00-\u9fff]{1,2}\s){1,3}\s*/g, (m) => {
        // 「議 長 」「町 長 」のような短い役職ラベル行
        const cleaned = m.replace(/\s+/g, "");
        if (ROLE_SUFFIXES.some((r) => r === cleaned)) {
          return " ";
        }
        return m;
      })
      .replace(/\s+/g, " ")
      .trim();

    if (!content) continue;

    // 発言ブロック直前のテキストから役職を取得
    const preceding = text.slice(Math.max(0, m.index! - 500), m.index!);
    const speakerRole =
      extractRoleFromPreceding(preceding, nameRoleMap, speakerName) ?? null;

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
      `[224618-morimachi] PDF 取得失敗: ${pdfUrl}`,
      err instanceof Error ? err.message : err
    );
    return null;
  }
}

/**
 * PDF をダウンロード・テキスト抽出し、MeetingData に変換する。
 */
export async function fetchMeetingData(
  meeting: MorimachMeeting,
  municipalityCode: string
): Promise<MeetingData | null> {
  const text = await fetchPdfText(meeting.pdfUrl);
  if (!text) return null;

  const statements = parseStatements(text);

  // statements が空の場合は null を返す
  if (statements.length === 0) return null;

  // PDF ファイル名から externalId を生成
  const pathMatch = new URL(meeting.pdfUrl).pathname.match(/\/([^/]+)\.pdf$/i);
  const idKey = pathMatch ? pathMatch[1] : null;
  const externalId = idKey ? `morimachi_${idKey}` : null;

  // heldOn が null の場合はスキップ
  if (!meeting.heldOn) return null;

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
