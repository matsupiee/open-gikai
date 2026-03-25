/**
 * 湧別町議会 — detail フェーズ
 *
 * PDF をダウンロードしてテキストを抽出し、○ マーカーで発言を分割して
 * ParsedStatement 配列を生成する。
 *
 * 発言フォーマット（PDF から抽出）:
 *   ○議　　長　ただいまの出席議員は９名でございます。
 *   ○議会事務局長　議案第１号、令和６年度湧別町一般会計補正予算。
 *   ○町　　長　前回の議会以降における行政上の諸課題について...
 *   ○４　　番　今説明がありました説明資料の９ページの...
 *   ○農政課長　村川議員の質問にお答えします。
 *   ○全　　員　（異　議　な　し）
 *
 * 役職名や番号の間にスペースが挿入されている場合がある（例: ○議　　長）。
 * 正規化（スペース除去）後に役職マッチを行う。
 */

import { createHash } from "node:crypto";
import { extractText, getDocumentProxy } from "unpdf";
import type { MeetingData, ParsedStatement } from "../../../utils/types";
import type { YubetsuMeeting } from "./list";
import {
  extractExternalIdKey,
  fetchBinary,
  parseJapaneseDate,
} from "./shared";

// 役職サフィックス（長いものを先に配置して誤マッチを防ぐ）
const ROLE_SUFFIXES = [
  "副委員長",
  "委員長",
  "副議長",
  "議長",
  "副町長",
  "町長",
  "教育長",
  "委員",
  "議員",
  "副部長",
  "部長",
  "副課長",
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
 * 湧別町の特徴:
 *   - 役職名や番号の間にスペースが挿入される（例: ○議　　長、○４　　番）
 *   - 括弧パターンなし、役職と発言の間はスペースで区切られる
 *   - スペースを除去した役職名で ROLE_SUFFIXES をマッチする
 *
 * 対応パターン:
 *   ○議　　長　発言内容 → role=議長, name=null, content=発言内容
 *   ○町　　長　発言内容 → role=町長, name=null, content=発言内容
 *   ○４　　番　発言内容 → role=議員, name=null, content=発言内容
 *   ○農政課長　発言内容 → role=課長, name=null, content=発言内容
 *   ○全　　員　（異　議　な　し） → role=null, name=null, content=（異議なし）
 *
 * 分割戦略:
 *   テキストの各インデックスで試し、そこまでをスペース除去した役職名として
 *   ROLE_SUFFIXES にマッチするかを確認する。
 *   マッチしたもののうち最も長い役職名を採用する。
 */
export function parseSpeaker(text: string): {
  speakerName: string | null;
  speakerRole: string | null;
  content: string;
} {
  const stripped = text.replace(/^[○◯◎●]\s*/, "");

  // テキストを走査して「役職部分 + スペース区切り + 発言内容」の構造を検出する
  // 役職部分にはスペース（全角・半角）が含まれうるため、
  // 全ての可能な「役職候補 + 残り」の組み合わせを試みる
  //
  // 戦略: スペースが含まれるトークンをまとめてスキャンし、
  //       スペース除去後の文字列を役職名として試す

  let bestRolePart: string | null = null;
  let bestContent = "";
  let bestSuffix: string | null = null;

  // テキストをスペースを含む「役職部分」と「発言内容」に分割するため、
  // 各位置でカットして試みる
  for (let i = 1; i <= stripped.length; i++) {
    const candidate = stripped.slice(0, i);
    const rest = stripped.slice(i).trimStart();

    // candidateの最後がスペースでなければ区切り候補でない
    // (スペースの直後がコンテンツの開始)
    if (i < stripped.length) {
      const nextChar = stripped[i];
      // 次の文字がスペースでない場合は、ここは区切りではない（続きを走査）
      if (nextChar !== " " && nextChar !== "　") continue;
    }

    // candidate からスペースを除去して役職名を取得
    const rolePart = candidate.replace(/[\s　]+/g, "").trim();
    if (!rolePart) continue;

    // 番号付き議員パターン
    if (/^[\d０-９]+番$/.test(rolePart)) {
      bestRolePart = rolePart;
      bestContent = rest;
      bestSuffix = "議員";
      break; // 番号+番 は最初にマッチしたら確定
    }

    // 「全員」パターン
    if (rolePart === "全員") {
      bestRolePart = rolePart;
      bestContent = rest;
      bestSuffix = null; // 全員は role なし
      break;
    }

    // 役職サフィックスマッチ（最も長い候補を優先するため更新し続ける）
    for (const suffix of ROLE_SUFFIXES) {
      if (rolePart === suffix || rolePart.endsWith(suffix)) {
        bestRolePart = rolePart;
        bestContent = rest;
        bestSuffix = suffix;
        break;
      }
    }
  }

  if (bestRolePart !== null) {
    // 全員の場合は role=null
    if (bestRolePart.replace(/[\s　]+/g, "") === "全員") {
      return { speakerName: null, speakerRole: null, content: bestContent };
    }
    return { speakerName: null, speakerRole: bestSuffix, content: bestContent };
  }

  // マッチなし: スペースで分割してそのまま返す
  const fallbackMatch = stripped.match(/^([^\s　]+)[\s　]+([\s\S]*)$/);
  if (fallbackMatch) {
    return {
      speakerName: null,
      speakerRole: fallbackMatch[1]! || null,
      content: fallbackMatch[2]!.trim(),
    };
  }

  return { speakerName: null, speakerRole: null, content: stripped.trim() };
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
 * PDF テキストから開催日を抽出する。
 * 例: "令和７年１月１０日湧別町議会議場に招集された。" → "2025-01-10"
 */
export function extractHeldOnFromPdfText(text: string): string | null {
  return parseJapaneseDate(text);
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
      `[015598-yubetsu] PDF 取得失敗: ${pdfUrl}`,
      err instanceof Error ? err.message : err,
    );
    return null;
  }
}

/**
 * PDF をダウンロード・テキスト抽出し、MeetingData に変換する。
 */
export async function fetchMeetingData(
  meeting: YubetsuMeeting,
  municipalityCode: string,
): Promise<MeetingData | null> {
  const text = await fetchPdfText(meeting.pdfUrl);
  if (!text) return null;

  const statements = parseStatements(text);
  if (statements.length === 0) return null;

  // 開催日: list フェーズで取得できていればそれを使い、なければ PDF テキストから取得
  const heldOn = meeting.heldOn ?? extractHeldOnFromPdfText(text);
  if (!heldOn) return null;

  const idKey = extractExternalIdKey(meeting.pdfUrl);
  const externalId = idKey ? `yubetsu_${idKey}` : null;

  return {
    municipalityCode,
    title: meeting.title,
    meetingType: meeting.meetingType,
    heldOn,
    sourceUrl: meeting.pdfUrl,
    externalId,
    statements,
  };
}
