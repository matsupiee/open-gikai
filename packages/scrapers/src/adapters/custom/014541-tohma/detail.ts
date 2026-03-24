/**
 * 当麻町議会 会議録 — detail フェーズ
 *
 * PDF をダウンロードし、テキストを抽出して発言（質問・答弁）を構造化する。
 *
 * PDF の発言フォーマット:
 *   ○質問　{議員名}議員「{質問タイトル}」
 *   ○答弁　{役職名}
 */

import { createHash } from "node:crypto";
import { extractText, getDocumentProxy } from "unpdf";
import type { MeetingData, ParsedStatement } from "../../../utils/types";
import { fetchBinary, parsePdfTitleDate, parseMeetingTitle } from "./shared";

/**
 * 質問行をパースする。
 * 例: ○質問　上杉達則議員「米の価格高騰についての対策」
 */
export function parseQuestionLine(line: string): {
  speakerName: string;
  title: string;
} | null {
  // 全角スペースと半角スペース両方対応
  const m = line.match(/^[○◯]質問[\s　]+(.+?)議員[「「](.+?)[」」]/);
  if (!m) return null;
  return {
    speakerName: m[1]!.trim(),
    title: m[2]!.trim(),
  };
}

/**
 * 答弁行をパースする。
 * 例: ○答弁　村椿哲朗町長
 */
export function parseAnswerLine(line: string): {
  speakerName: string;
} | null {
  const m = line.match(/^[○◯]答弁[\s　]+(.+)/);
  if (!m) return null;
  return {
    speakerName: m[1]!.trim(),
  };
}

/**
 * PDF テキストから発言ブロックを抽出する。
 * ○質問 / ○答弁 をセパレーターとして発言を分割する。
 */
export function parseStatements(text: string): ParsedStatement[] {
  const statements: ParsedStatement[] = [];
  let offset = 0;

  const lines = text.split(/\n/);

  type SpeakerInfo =
    | { kind: "question"; speakerName: string; speakerRole: string }
    | { kind: "answer"; speakerName: string; speakerRole: string }
    | null;

  let currentSpeaker: SpeakerInfo = null;
  let contentLines: string[] = [];

  function flushStatement() {
    if (contentLines.length === 0 || currentSpeaker === null) return;
    const content = contentLines.join(" ").replace(/\s+/g, " ").trim();
    if (!content) return;

    const contentHash = createHash("sha256").update(content).digest("hex");
    const startOffset = offset;
    const endOffset = offset + content.length;

    statements.push({
      kind: currentSpeaker.kind,
      speakerName: currentSpeaker.speakerName,
      speakerRole: currentSpeaker.speakerRole,
      content,
      contentHash,
      startOffset,
      endOffset,
    });
    offset = endOffset + 1;
    contentLines = [];
  }

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;

    const questionResult = parseQuestionLine(trimmed);
    if (questionResult) {
      flushStatement();
      currentSpeaker = {
        kind: "question",
        speakerName: questionResult.speakerName,
        speakerRole: "議員",
      };
      // 質問タイトルをコンテンツの最初の行として追加
      contentLines.push(questionResult.title);
      continue;
    }

    const answerResult = parseAnswerLine(trimmed);
    if (answerResult) {
      flushStatement();
      currentSpeaker = {
        kind: "answer",
        speakerName: answerResult.speakerName,
        speakerRole: answerResult.speakerName,
      };
      continue;
    }

    // 継続行
    if (currentSpeaker !== null) {
      // ヘッダー行（令和X年第Y回定例会...）はスキップ
      if (/^(令和|平成)\d+年第\d+回定例会/.test(trimmed)) continue;
      contentLines.push(trimmed);
    }
  }

  flushStatement();
  return statements;
}

/**
 * PDF URL からテキストを抽出し、発言を返す。
 */
export async function fetchPdfStatements(
  pdfUrl: string,
): Promise<{ statements: ParsedStatement[]; pdfText: string } | null> {
  const buffer = await fetchBinary(pdfUrl);
  if (!buffer) return null;

  let text: string;
  try {
    const pdf = await getDocumentProxy(new Uint8Array(buffer));
    const { text: extracted } = await extractText(pdf, { mergePages: true });
    text = extracted;
  } catch (e) {
    console.warn(`[tohma] PDF テキスト抽出失敗: ${pdfUrl}`, e);
    return null;
  }

  const statements = parseStatements(text);
  return { statements, pdfText: text };
}

/**
 * PDF ドキュメント情報から MeetingData を組み立てる。
 */
export async function fetchMeetingData(
  doc: {
    pdfUrl: string;
    linkText: string;
  },
  municipalityId: string,
): Promise<MeetingData | null> {
  const result = await fetchPdfStatements(doc.pdfUrl);
  if (!result) return null;

  const { statements, pdfText } = result;
  if (statements.length === 0) return null;

  // PDF 本文から開催日を抽出（先頭数行を確認）
  const firstLines = pdfText.split(/\n/).slice(0, 10);
  let heldOn: string | null = null;
  for (const line of firstLines) {
    const date = parsePdfTitleDate(line.trim());
    if (date) {
      heldOn = date;
      break;
    }
  }

  // PDF から取得できなければリンクテキストから年度を推定
  if (!heldOn) {
    const meta = parseMeetingTitle(doc.linkText);
    if (meta) {
      // 定例会の月を回数から推定（1回=3月, 2回=6月, 3回=9月, 4回=12月）
      const sessionMonths: Record<number, number> = { 1: 3, 2: 6, 3: 9, 4: 12 };
      const month = sessionMonths[meta.session] ?? 3;
      heldOn = `${meta.year}-${String(month).padStart(2, "0")}-01`;
    }
  }

  if (!heldOn) return null;

  // タイトルをリンクテキストから取得（.pdf 拡張子を除去）
  const title = doc.linkText.replace(/\.pdf$/i, "").trim() || doc.linkText;

  return {
    municipalityId,
    title,
    meetingType: "plenary",
    heldOn,
    sourceUrl: doc.pdfUrl,
    externalId: `tohma_${encodeURIComponent(doc.pdfUrl)}`,
    statements,
  };
}
