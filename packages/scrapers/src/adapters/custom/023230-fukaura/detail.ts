/**
 * 深浦町議会 — detail フェーズ
 *
 * 一般質問 PDF をダウンロードしてテキストを抽出し、
 * 議会だより形式の Q&A をパースして ParsedStatement 配列を生成する。
 *
 * PDF テキストは unpdf で mergePages: true とすると1行に連結される。
 * テキスト内で「○○議員」「町長」「副町長」等の役職名が発言ブロックの
 * 境界となるため、正規表現で分割する。
 *
 * 紙面上の「問」「答」マーカーやサイドバーの見出しテキストも混在するが、
 * 発言者パターンをアンカーにして分割すれば無視できる。
 */

import { createHash } from "node:crypto";
import { extractText, getDocumentProxy } from "unpdf";
import type { MeetingData, ParsedStatement } from "../../../utils/types";
import { detectMeetingType, fetchBinary } from "./shared";

/** 答弁者の役職一覧（正規表現のOR分岐で使用、長い方を先に） */
const ANSWERER_ROLES = [
  "農林水産課長",
  "総務課長",
  "企画課長",
  "建設課長",
  "産業課長",
  "住民課長",
  "福祉課長",
  "観光課長",
  "税務課長",
  "会計管理者",
  "副町長",
  "教育長",
  "町長",
  "課長",
] as const;

/** 答弁者役職のセット（classifyKind 用） */
const ANSWERER_ROLE_SET = new Set<string>(ANSWERER_ROLES);

/**
 * 発言ブロックの境界を検出する正規表現のソース。
 *
 * negative lookbehind (?<![CJK]) で部分マッチを防ぐ。
 * これにより「副町長」が「町長」として誤マッチすることを防ぐ。
 *
 * グループ1: 議員名（「○○議員」）
 * グループ2: 答弁者の役職名
 */
const SPEAKER_PATTERN_SOURCE = `(?<![\\u4E00-\\u9FFF\\u3400-\\u4DBF])(?:([\\u4E00-\\u9FFF\\u3400-\\u4DBF]{1,5}議員)|(${ANSWERER_ROLES.join("|")}))\\s`;

/** 議員パターン: 「○○議員 内容」（parseSpeaker で使用） */
const QUESTIONER_PATTERN = /^([\u4E00-\u9FFF\u3400-\u4DBF]{1,5}議員)\s+([\s\S]*)/;

/**
 * テキストブロックから発言者情報を解析する。
 */
export function parseSpeaker(text: string): {
  speakerName: string | null;
  speakerRole: string | null;
  content: string;
} {
  const trimmed = text.trim();

  // 議員パターン: 「○○議員 内容」
  const questionerMatch = trimmed.match(QUESTIONER_PATTERN);
  if (questionerMatch) {
    const fullName = questionerMatch[1]!.trim();
    const name = fullName.replace(/議員$/, "");
    const content = questionerMatch[2]!.trim();
    return { speakerName: name, speakerRole: "議員", content };
  }

  // 答弁者パターン: 「役職名 内容」
  for (const role of ANSWERER_ROLES) {
    if (trimmed.startsWith(role)) {
      const rest = trimmed.slice(role.length).trim();
      if (rest.length > 0) {
        return { speakerName: null, speakerRole: role, content: rest };
      }
    }
  }

  return { speakerName: null, speakerRole: null, content: trimmed };
}

/** 役職から発言種別を分類 */
export function classifyKind(speakerRole: string | null): "remark" | "question" | "answer" {
  if (!speakerRole) return "remark";
  if (speakerRole === "議員") return "question";
  if (ANSWERER_ROLE_SET.has(speakerRole)) return "answer";
  for (const role of ANSWERER_ROLES) {
    if (speakerRole.endsWith(role)) return "answer";
  }
  return "remark";
}

/**
 * ノイズテキストを除去する。
 * 議会だよりの紙面レイアウトに起因するサイドバー見出し、
 * ページ番号、「問」「答」マーカー等を除去する。
 */
function cleanContent(content: string): string {
  return (
    content
      // 「問」「答」単独マーカー（前後にスペースがある）
      .replace(/\s+問\s+/g, " ")
      .replace(/\s+答\s+/g, " ")
      // 末尾の「問」「答」
      .replace(/\s+[問答]$/g, "")
      // 先頭の「問」「答」
      .replace(/^[問答]\s+/g, "")
      // ふかうらまち議会だよりヘッダー
      .replace(/ふかうらまち議会だより[^）)]*[）)]/g, "")
      // わが町のここが聞きたい
      .replace(/わが町のここが聞きたい/g, "")
      // つぶやきセクション以降
      .replace(/つぶやき[\s\S]*/g, "")
      // ルビ風のひらがな列（議員名のルビ: 「大 お お か わ 川」等）
      .replace(
        /[\u4E00-\u9FFF]\s+(?:[ぁ-ん]\s+){2,}[\u4E00-\u9FFF](?:\s+[ぁ-ん]\s+(?:[ぁ-ん]\s+)*[\u4E00-\u9FFF])*/g,
        "",
      )
      // 議員名のルビパターン末尾の「議員」
      .replace(/\s+議員\s*$/g, "")
      // ▲ で始まるキャプション
      .replace(/▲[^\s]*(?:\s+[^\s]*){0,5}/g, "")
      // ※ 注記
      .replace(/※[\d１-９]+\s+[^※]*/g, "")
      // 『...』で囲まれた見出し
      .replace(/『[^』]*』/g, "")
      // 連続スペースを正規化
      .replace(/\s{2,}/g, " ")
      .trim()
  );
}

/**
 * PDF から抽出したテキストを ParsedStatement 配列に変換する。
 *
 * unpdf の mergePages: true は全テキストを1行にする。
 * 発言者パターン（「○○議員」「町長」等）を matchAll で検出し、
 * 各マッチ位置の間のテキストを発言内容として抽出する。
 */
export function parseStatements(text: string): ParsedStatement[] {
  const statements: ParsedStatement[] = [];

  // グローバルフラグ付きなので毎回新しい RegExp を生成
  const pattern = new RegExp(SPEAKER_PATTERN_SOURCE, "g");
  const matches = [...text.matchAll(pattern)];

  if (matches.length === 0) return [];

  let offset = 0;
  for (let i = 0; i < matches.length; i++) {
    const match = matches[i]!;
    const speaker = (match[1] || match[2])!;
    const contentStart = match.index! + match[0].length;
    const contentEnd =
      i + 1 < matches.length ? matches[i + 1]!.index! : text.length;

    const rawContent = text.slice(contentStart, contentEnd).trim();

    // 議員名から「議員」を除去して speakerName / speakerRole を決定
    let speakerName: string | null = null;
    let speakerRole: string;

    if (speaker.endsWith("議員")) {
      speakerName = speaker.replace(/議員$/, "");
      speakerRole = "議員";
    } else {
      speakerRole = speaker;
    }

    const content = cleanContent(rawContent);

    // 短すぎるコンテンツはスキップ
    if (!content || content.length < 10) continue;

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
      `[023230-fukaura] PDF 取得失敗: ${pdfUrl}`,
      err instanceof Error ? err.message : err,
    );
    return null;
  }
}

/**
 * 一般質問 PDF をダウンロード・テキスト抽出し、MeetingData に変換する。
 * 複数の PDF がある場合は全て結合する。
 */
export async function fetchMeetingData(
  params: {
    title: string;
    heldOn: string;
    articleUrl: string;
    questionPdfUrls: string[];
    docId: string;
  },
  municipalityId: string,
): Promise<MeetingData | null> {
  const allStatements: ParsedStatement[] = [];

  for (let i = 0; i < params.questionPdfUrls.length; i++) {
    const pdfUrl = params.questionPdfUrls[i]!;
    const text = await fetchPdfText(pdfUrl);
    if (!text) continue;

    const statements = parseStatements(text);
    allStatements.push(...statements);

    // レート制限: PDF 間に 1 秒待機（最後の1件では不要）
    if (i < params.questionPdfUrls.length - 1) {
      await new Promise((r) => setTimeout(r, 1000));
    }
  }

  // 一般質問 PDF がない場合は null を返す
  if (allStatements.length === 0) return null;

  return {
    municipalityId,
    title: params.title,
    meetingType: detectMeetingType(params.title),
    heldOn: params.heldOn,
    sourceUrl: params.articleUrl,
    externalId: `fukaura_${params.docId}`,
    statements: allStatements,
  };
}
