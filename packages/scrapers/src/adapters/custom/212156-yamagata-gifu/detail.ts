/**
 * 岐阜県山県市議会 会議録 — detail フェーズ
 *
 * PDF をダウンロードしてテキストを抽出し、会議日ごとに分割し、
 * ○ マーカーで発言を分割して ParsedStatement 配列を生成する。
 *
 * 発言フォーマット:
 *   ○議長（𠮷田茂広）　それでは、ただいまから会議を開きます。
 *   ○副議長（加藤義信）　...
 *   ○議会運営委員会委員長（武藤孝成）　...
 *   ○市長（林宏優）　...
 *   ○副市長（久保田聡）　...
 *   ○３番  吉田昌樹議員質疑...（発言内容）
 *   ○１１番  山崎　通議員質問...（発言内容）
 *   ○谷村理事兼総務課長答弁...（発言内容）
 *   ○服部市民環境課長答弁...（発言内容）
 *
 * 会議日区切り:
 *   令和X年X月X日（X曜日）第X号
 */

import { createHash } from "node:crypto";
import { extractText, getDocumentProxy } from "unpdf";
import type { MeetingData, ParsedStatement } from "../../../utils/types";
import type { YamagataGifuMeeting } from "./list";
import { detectMeetingType, fetchBinary } from "./shared";

// 役職サフィックス（長いものを先に置いて誤マッチを防ぐ）
const ROLE_SUFFIXES = [
  "副委員長",
  "委員長",
  "副議長",
  "副市長",
  "教育長",
  "議長",
  "市長",
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
  "理事",
];

// 行政側の役職（答弁者として分類する）
const ANSWER_ROLES = new Set([
  "市長",
  "副市長",
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
  "次長",
  "主査",
  "補佐",
  "理事",
]);

/**
 * ○ マーカー付きの発言ヘッダーから発言者情報を抽出する。
 *
 * 対応パターン:
 *   ○議長（𠮷田茂広）　→ role=議長, name=𠮷田茂広
 *   ○市長（林宏優）　→ role=市長, name=林宏優
 *   ○議会運営委員会委員長（武藤孝成）　→ role=委員長, name=武藤孝成
 *   ○３番  吉田昌樹議員質疑　→ role=議員, name=吉田昌樹
 *   ○谷村理事兼総務課長答弁　→ role=課長, name=谷村
 */
export function parseSpeaker(text: string): {
  speakerName: string | null;
  speakerRole: string | null;
  content: string;
} {
  const stripped = text.replace(/^[○◯◎●]\s*/, "");

  // パターン1: ○役職（氏名）content （括弧あり）
  const bracketMatch = stripped.match(
    /^(.+?)[（(](.+?)[）)]\s*([\s\S]*)/,
  );
  if (bracketMatch) {
    const rolePart = bracketMatch[1]!.trim();
    const rawName = bracketMatch[2]!.replace(/[\s　]+/g, "").trim();
    const content = bracketMatch[3]!.trim();

    // 番号付き議員: ○３番（佐藤次郎）
    if (/^[\d０-９]+番$/.test(rolePart)) {
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

  // パターン2: ○N番  氏名議員{質疑|質問|発言|討論}content
  // 例: ○３番  吉田昌樹議員質疑...
  const memberMatch = stripped.match(
    /^([\d０-９]+)番[\s　]+(.+?)議員(?:質疑|質問|発言|反対討論|賛成討論)[\s　]*([\s\S]*)/,
  );
  if (memberMatch) {
    const rawName = memberMatch[2]!.replace(/[\s　]+/g, "").trim();
    const content = memberMatch[3]!.trim();
    return { speakerName: rawName, speakerRole: "議員", content };
  }

  // パターン3: ○氏名役職名答弁 content （括弧なし・答弁者）
  // 例: ○谷村理事兼総務課長答弁  / ○服部市民環境課長答弁
  const answerMatch = stripped.match(/^(.+?答弁)[\s　]*([\s\S]*)/);
  if (answerMatch) {
    const roleText = answerMatch[1]!.trim();
    const content = answerMatch[2]!.trim();

    // 役職サフィックスから名前と役職を分離
    for (const suffix of ROLE_SUFFIXES) {
      const idx = roleText.lastIndexOf(suffix);
      if (idx > 0) {
        // 答弁の前の部分に役職が含まれる
        const beforeAnswer = roleText.slice(0, roleText.lastIndexOf("答弁"));
        const suffixIdx = beforeAnswer.lastIndexOf(suffix);
        if (suffixIdx >= 0) {
          const nameCandidate = beforeAnswer.slice(0, suffixIdx).trim();
          return {
            speakerName: nameCandidate || null,
            speakerRole: suffix,
            content,
          };
        }
        break;
      }
    }

    return { speakerName: null, speakerRole: null, content };
  }

  // パターン4: ○役職名 content （括弧なし・空白区切り）
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
  if (speakerRole === "議員") return "question";
  return "question";
}

/**
 * PDF から抽出したテキストを ParsedStatement 配列に変換する。
 *
 * ページ区切り（\f）とページ番号行（「－ N －」形式）を除去してからパースする。
 */
export function parseStatements(text: string): ParsedStatement[] {
  // ページ区切り文字とページ番号行を除去
  const cleaned = text
    .replace(/\f/g, "\n")
    .replace(/^[\s]*[－\-]\s*\d+\s*[－\-][\s]*$/gm, "")
    .replace(/^[\s]*[―]\s*\d+\s*[―][\s]*$/gm, "");

  const blocks = cleaned.split(/(?=[○◯◎●])/);
  const statements: ParsedStatement[] = [];
  let offset = 0;

  for (const block of blocks) {
    const trimmed = block.trim();
    if (!trimmed || !/^[○◯◎●]/.test(trimmed)) continue;

    // ト書き（登壇等）をスキップ
    if (/^[○◯◎●].*[（(](?:登壇|退席|退場|着席)[）)]\s*$/.test(trimmed))
      continue;

    // 傍聴者の発言形式「〔...〕」のみの行はスキップ
    if (/^[○◯◎●]\s*〔.+〕\s*$/.test(trimmed)) continue;

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
 * PDF テキストから会議日ごとのセクションに分割し、
 * 各会議日の開催日を抽出する。
 *
 * 会議日区切りパターン: 「令和X年X月X日（X曜日）第X号」
 *
 * @returns { heldOn: string | null, text: string }[] の配列
 */
export function splitIntoSessions(
  text: string,
): { heldOn: string | null; sessionTitle: string; text: string }[] {
  // 会議日のセクション開始を検出するパターン
  const sessionPattern =
    /(?:令和|平成)(元|\d+)年(\d+)月(\d+)日[（(].曜日[）)][^\n]*第\d+号/g;

  const matches: { index: number; match: RegExpExecArray }[] = [];
  let m: RegExpExecArray | null;
  while ((m = sessionPattern.exec(text)) !== null) {
    matches.push({ index: m.index, match: m });
  }

  if (matches.length === 0) {
    // セッション区切りが見つからない場合は全体を1セッションとして返す
    return [{ heldOn: null, sessionTitle: "", text }];
  }

  const sessions: { heldOn: string | null; sessionTitle: string; text: string }[] = [];

  for (let i = 0; i < matches.length; i++) {
    const { index, match } = matches[i]!;
    const nextIndex = i + 1 < matches.length ? matches[i + 1]!.index : text.length;
    const sessionText = text.slice(index, nextIndex);

    // 開催日の解析
    const eraText = match[1] === "元" ? "1" : match[1]!;
    const eraName = match[0]!.startsWith("令和") ? "令和" : "平成";
    const eraYear = parseInt(eraText, 10);
    let westernYear: number;
    if (eraName === "令和") {
      westernYear = eraYear + 2018;
    } else {
      westernYear = eraYear + 1988;
    }

    const month = parseInt(match[2]!, 10);
    const day = parseInt(match[3]!, 10);
    const heldOn = `${westernYear}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;

    sessions.push({
      heldOn,
      sessionTitle: match[0]!,
      text: sessionText,
    });
  }

  return sessions;
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
      `[212156-yamagata-gifu] PDF 取得失敗: ${pdfUrl}`,
      err instanceof Error ? err.message : err,
    );
    return null;
  }
}

/**
 * PDF をダウンロード・テキスト抽出し、会議日ごとに分割して MeetingData 配列を返す。
 * 発言が空の場合は null を返す。
 */
export async function fetchMeetingData(
  meeting: YamagataGifuMeeting,
  municipalityId: string,
): Promise<MeetingData | null> {
  const text = await fetchPdfText(meeting.pdfUrl);
  if (!text) return null;

  const sessions = splitIntoSessions(text);

  // 全セッションのステートメントをまとめて1つの MeetingData として返す
  // （PDF 1ファイルが1つの定例会・臨時会に対応するため）
  const allStatements: ParsedStatement[] = [];
  let heldOn: string | null = null;

  for (const session of sessions) {
    if (session.heldOn && !heldOn) {
      heldOn = session.heldOn;
    }
    const stmts = parseStatements(session.text);
    allStatements.push(...stmts);
  }

  if (allStatements.length === 0) return null;

  // PDF URL からファイル名部分を externalId として利用
  const urlPath = new URL(meeting.pdfUrl).pathname;
  const fileName = urlPath.split("/").pop()?.replace(/\.pdf$/i, "") ?? null;
  const externalId = fileName ? `yamagata_gifu_${fileName}` : null;

  if (!heldOn) return null;

  return {
    municipalityId,
    title: meeting.title,
    meetingType: detectMeetingType(meeting.title),
    heldOn,
    sourceUrl: meeting.pdfUrl,
    externalId,
    statements: allStatements,
  };
}
