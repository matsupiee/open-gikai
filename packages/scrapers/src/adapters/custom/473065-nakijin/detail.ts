/**
 * 今帰仁村議会 会議録 — detail フェーズ
 *
 * PDF をダウンロードしてテキストを抽出し、○ マーカーで発言を分割して
 * ParsedStatement 配列を生成する。
 *
 * 発言フォーマット（想定）:
 *   ○　上原祐希　議長　ただいまの出席議員は11名です。
 *   ○　久田浩也　村長　皆さんおはようございます。
 *   ○　5番　石嶺美奈実　質問します。（議席番号付き）
 */

import { createHash } from "node:crypto";
import { extractText, getDocumentProxy } from "unpdf";
import type { MeetingData, ParsedStatement } from "../../../utils/types";
import type { NakijinMeeting } from "./list";
import { fetchBinary } from "./shared";

// 役職サフィックス（長い方を先に置いて誤マッチを防ぐ）
const ROLE_SUFFIXES = [
  "副委員長",
  "委員長",
  "副議長",
  "副村長",
  "教育長",
  "消防長",
  "事務局長",
  "議長",
  "村長",
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
  "次長",
  "主査",
  "補佐",
];

// 行政側の役職（答弁者として分類する）
const ANSWER_ROLES = new Set([
  "村長",
  "副村長",
  "教育長",
  "消防長",
  "部長",
  "副部長",
  "課長",
  "副課長",
  "室長",
  "局長",
  "係長",
  "参事",
  "主幹",
  "次長",
  "主査",
  "補佐",
  "事務局長",
]);

/**
 * ○ マーカー付きの発言ヘッダーから発言者情報を抽出する。
 *
 * 今帰仁村議会のフォーマット:
 *   ○　上原祐希　議長　発言内容...
 *   ○　久田浩也　村長　発言内容...
 *   ○　5番　石嶺美奈実　発言内容...（議席番号付き）
 *   ○　総務課長　鈴木一郎　発言内容...（役職が先の場合）
 *
 * フォールバック（括弧パターン）:
 *   ○議長（田中太郎君）　発言内容...
 */
export function parseSpeaker(text: string): {
  speakerName: string | null;
  speakerRole: string | null;
  content: string;
} {
  const stripped = text.replace(/^[○◯◎●]\s*/, "");

  // パターン1: ○（役職）（名前）発言内容 - 括弧パターン（フォールバック用）
  const bracketMatch = stripped.match(
    /^(.+?)[（(](.+?)(?:君|様|議員|さん)?[）)]\s*([\s\S]*)/,
  );
  if (bracketMatch) {
    const rolePart = bracketMatch[1]!.trim();
    const rawName = bracketMatch[2]!.replace(/[\s　]+/g, "").trim();
    const content = bracketMatch[3]!.trim();

    // 番号付き議員: ○3番（石嶺美奈実）
    if (/^[\d０-９]+番$/.test(rolePart)) {
      return { speakerName: rawName, speakerRole: "議員", content };
    }

    // 役職マッチ（長い順に照合）
    for (const suffix of ROLE_SUFFIXES) {
      if (rolePart === suffix || rolePart.endsWith(suffix)) {
        return { speakerName: rawName, speakerRole: suffix, content };
      }
    }

    return { speakerName: rawName, speakerRole: rolePart || null, content };
  }

  // パターン2: ○　氏名　役職　発言内容 (今帰仁村議会の主要フォーマット)
  // 全角スペースや半角スペースで区切られた「氏名 役職 発言内容」
  const parts = stripped.split(/[\s　]+/).filter((p) => p.length > 0);

  if (parts.length >= 2) {
    // ○　5番　石嶺美奈実　発言内容... (議席番号パターン)
    if (/^[\d０-９]+番$/.test(parts[0]!)) {
      if (parts.length >= 3) {
        const name = parts[1]!;
        const content = parts.slice(2).join(" ").trim();
        if (content) {
          return { speakerName: name, speakerRole: "議員", content };
        }
      }
    }

    // ○　上原祐希　議長　発言内容... (氏名 役職 発言内容パターン)
    if (parts.length >= 3) {
      const secondPart = parts[1]!;
      for (const suffix of ROLE_SUFFIXES) {
        if (secondPart === suffix || secondPart.endsWith(suffix)) {
          const name = parts[0]!;
          const content = parts.slice(2).join(" ").trim();
          if (content) {
            return { speakerName: name, speakerRole: suffix, content };
          }
          // content が空の場合は役職のみ行（スキップ対象）
          return { speakerName: name, speakerRole: suffix, content: "" };
        }
      }

      // ○　総務課長　鈴木一郎　発言内容... (役職 氏名 発言内容パターン)
      const firstPart = parts[0]!;
      for (const suffix of ROLE_SUFFIXES) {
        if (firstPart === suffix || firstPart.endsWith(suffix)) {
          const name = parts[1]!;
          const content = parts.slice(2).join(" ").trim();
          if (content) {
            return { speakerName: name, speakerRole: suffix, content };
          }
          return { speakerName: name, speakerRole: suffix, content: "" };
        }
      }
    }

    // 2パーツの場合: 氏名 役職 (発言内容なし) または ヘッダー 内容
    const header = parts[0]!;
    const secondPart = parts[1]!;

    // 2番目のパーツが役職の場合、発言内容なし
    for (const suffix of ROLE_SUFFIXES) {
      if (secondPart === suffix || secondPart.endsWith(suffix)) {
        return { speakerName: header, speakerRole: suffix, content: "" };
      }
    }

    // 1番目のパーツが「氏名+役職」の場合
    for (const suffix of ROLE_SUFFIXES) {
      if (header.endsWith(suffix)) {
        const name =
          header.length > suffix.length ? header.slice(0, -suffix.length) : null;
        const content = secondPart;
        return { speakerName: name, speakerRole: suffix, content };
      }
    }

    const content = parts.slice(1).join(" ").trim();
    if (content) {
      return { speakerName: header, speakerRole: null, content };
    }
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
  ) {
    return "remark";
  }
  // 末尾が ANSWER_ROLES にマッチする場合（例: "総務課長"）
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
    if (/^[○◯◎●].*[（(](?:登壇|退席|退場|着席)[）)]\s*$/.test(trimmed)) continue;

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
      `[473065-nakijin] PDF 取得失敗: ${pdfUrl}`,
      err instanceof Error ? err.message : err,
    );
    return null;
  }
}

/**
 * PDF をダウンロード・テキスト抽出し、MeetingData に変換する。
 */
export async function fetchMeetingData(
  meeting: NakijinMeeting,
  municipalityId: string,
): Promise<MeetingData | null> {
  if (!meeting.year) return null;

  const text = await fetchPdfText(meeting.fileUrl);
  if (!text) return null;

  const statements = parseStatements(text);
  if (statements.length === 0) return null;

  // ファイル URL のファイル名を externalId として利用
  const urlPath = new URL(meeting.fileUrl).pathname;
  const fileName =
    urlPath
      .split("/")
      .pop()
      ?.replace(/\.pdf$/i, "") ?? null;
  const externalId = fileName ? `nakijin_${fileName}` : null;

  const heldOn = meeting.heldOn;
  if (!heldOn) return null;

  return {
    municipalityId,
    title: meeting.title,
    meetingType: meeting.meetingType,
    heldOn,
    sourceUrl: meeting.fileUrl,
    externalId,
    statements,
  };
}
