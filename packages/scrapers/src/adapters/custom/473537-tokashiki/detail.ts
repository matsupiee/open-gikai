/**
 * 渡嘉敷村議会 会議録 — detail フェーズ
 *
 * PDF をダウンロードしてテキストを抽出し、○ マーカーで発言を分割して
 * ParsedStatement 配列を生成する。
 *
 * 発言フォーマット（PDF から抽出）:
 *   ○　當山清彦議長　発言内容
 *   ○　新里武広村長　答弁内容
 *   ○　３番　玉城保弘議員　質問内容
 *   ○　金城　満教育長　説明内容
 */

import { createHash } from "node:crypto";
import { extractText, getDocumentProxy } from "../../../utils/pdf";
import type { MeetingData, ParsedStatement } from "../../../utils/types";
import type { TokashikiMeeting } from "./list";
import {
  detectMeetingType,
  eraToWesternYear,
  fetchBinary,
  toHalfWidth,
} from "./shared";

// 役職サフィックス（長い方を先に置いて誤マッチを防ぐ）
const ROLE_SUFFIXES = [
  "副委員長",
  "委員長",
  "副議長",
  "副村長",
  "教育長",
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
]);

/**
 * ○ マーカー付きの発言行から発言者情報を抽出する。
 *
 * 対応パターン:
 *   ○　當山清彦議長    → role=議長, name=當山清彦
 *   ○　新里武広村長    → role=村長, name=新里武広
 *   ○　３番　玉城保弘議員 → role=議員, name=玉城保弘
 *   ○　金城　満教育長  → role=教育長, name=金城満
 *   ○　新垣　聡総務課長 → role=課長, name=新垣聡
 *
 * 戦略: スペースで分割し、最後のトークンが役職サフィックスで終わる場合に
 * 名前部分（スペースを除去した形）と役職を分離する。
 */
export function parseSpeaker(text: string): {
  speakerName: string | null;
  speakerRole: string | null;
  content: string;
} {
  // ○ マーカーと続くスペースを除去
  const stripped = text.replace(/^[○◯◎●]\s*[　\s]*/, "");

  // 議員パターン: ○　{数字}番　{名前}議員　{内容}
  // 全角・半角数字に対応
  const memberPatternOrig = /^[０-９\d]+番[　\s]+(.+?)議員[　\s]*([\s\S]*)/;
  const origMatch = stripped.match(memberPatternOrig);
  if (origMatch) {
    const name = origMatch[1]!.replace(/[\s　]+/g, "").trim();
    const content = origMatch[2]!.trim();
    return { speakerName: name, speakerRole: "議員", content };
  }

  // 役職者パターン: ○　{名前}{役職}　{内容}
  // 発言行をスペースで分割し、各トークンを前から順に確認する。
  //
  // パターン1（名前と役職が同じトークン内、スペースなし）:
  //   "當山清彦議長　ただいまから..." → tokens=["當山清彦議長", "ただいまから..."]
  //   token[0]="當山清彦議長" ends with "議長" → name="當山清彦", role="議長"
  //
  // パターン2（名前の苗字と名が別トークン、役職は名に付属）:
  //   "金城　満教育長　説明いたします。" → tokens=["金城", "満教育長", "説明..."]
  //   token[0]="金城" → no suffix
  //   token[1]="満教育長" ends with "教育長" → tokenNamePart="満"(1文字=given name)
  //   → name = "金城" + "満" = "金城満", role="教育長"
  //
  // パターン3（フルネームと役職が別トークン）:
  //   "新垣聡　総務課長　報告..." → tokens=["新垣聡", "総務課長", "報告..."]
  //   token[1]="総務課長" ends with "課長" → tokenNamePart="総務"(2文字)
  //   ただし "総務" は部署名であり名前の一部ではない
  //   → name = tokens before = "新垣聡", role="課長"
  //
  // tokenNamePart が「名前の一部（given name）」か「部署名プレフィックス」かの判定:
  //   - 既にスペース区切りで前トークンがある場合: tokenNamePart は部署名プレフィックスとみなす
  //   - 前トークンがない（最初のトークン）場合: tokenNamePart が名前
  const tokens = stripped.split(/[　\s]+/).filter(Boolean);

  for (let i = 0; i < tokens.length; i++) {
    const token = tokens[i]!;
    for (const suffix of ROLE_SUFFIXES) {
      if (token.endsWith(suffix)) {
        const tokenNamePart = token.slice(0, -suffix.length);
        const content = tokens.slice(i + 1).join(" ").trim();
        const prevTokens = tokens.slice(0, i);

        let name: string;
        if (prevTokens.length === 0) {
          // 最初のトークンが「名前+役職」: tokenNamePart はすべて名前
          name = tokenNamePart;
        } else {
          // 前トークンがある場合:
          //   tokenNamePart が1文字 → given name（例: "満"）なので名前に追加
          //   tokenNamePart が2文字以上 → 部署名プレフィックスとみなし名前には含めない
          if (tokenNamePart.length === 1) {
            name = [...prevTokens, tokenNamePart].join("");
          } else {
            name = prevTokens.join("");
          }
        }

        return { speakerName: name || null, speakerRole: suffix, content };
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
  return "question";
}

/**
 * PDF から抽出したテキストを ParsedStatement 配列に変換する。
 */
export function parseStatements(text: string): ParsedStatement[] {
  const lines = text.split("\n");
  const statements: ParsedStatement[] = [];
  let offset = 0;

  let currentSpeaker: {
    speakerName: string | null;
    speakerRole: string | null;
  } | null = null;
  let contentLines: string[] = [];

  const flushStatement = () => {
    if (!currentSpeaker || contentLines.length === 0) return;
    const content = contentLines.join(" ").replace(/\s+/g, " ").trim();
    if (!content) return;

    const contentHash = createHash("sha256").update(content).digest("hex");
    const startOffset = offset;
    const endOffset = offset + content.length;

    statements.push({
      kind: classifyKind(currentSpeaker.speakerRole),
      speakerName: currentSpeaker.speakerName,
      speakerRole: currentSpeaker.speakerRole,
      content,
      contentHash,
      startOffset,
      endOffset,
    });
    offset = endOffset + 1;
    contentLines = [];
  };

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;

    // ○ マーカーで始まる行は発言者行
    if (/^[○◯◎●]/.test(trimmed)) {
      // ◎ で始まる議事日程見出しはスキップ
      if (/^◎/.test(trimmed)) continue;

      // ト書き（登壇等）をスキップ
      if (/^[○◯●]\s*[（(].+?(?:登壇|退席|退場|着席)[）)]/.test(trimmed))
        continue;

      flushStatement();

      const { speakerName, speakerRole, content } = parseSpeaker(trimmed);
      currentSpeaker = { speakerName, speakerRole };
      if (content) {
        contentLines.push(content);
      }
    } else if (currentSpeaker) {
      // 発言内容の続き
      contentLines.push(trimmed);
    }
  }

  // 最後の発言をフラッシュ
  flushStatement();

  return statements;
}

/**
 * PDF テキストから開催日を抽出する。
 * パターン: "令和７年12月10日(水)午前10時00分"
 */
export function parseDateFromPdfText(text: string): string | null {
  const halfWidth = toHalfWidth(text);
  const match = halfWidth.match(/(令和|平成)(元|\d+)年(\d+)月(\d+)日/);
  if (!match) return null;

  const year = eraToWesternYear(`${match[1]}${match[2]}年`);
  if (!year) return null;

  const month = parseInt(match[3]!, 10);
  const day = parseInt(match[4]!, 10);
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
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
      `[473537-tokashiki] PDF 取得失敗: ${pdfUrl}`,
      err instanceof Error ? err.message : err,
    );
    return null;
  }
}

/**
 * PDF をダウンロード・テキスト抽出し、MeetingData に変換する。
 */
export async function fetchMeetingData(
  meeting: TokashikiMeeting,
  municipalityCode: string,
): Promise<MeetingData | null> {
  const text = await fetchPdfText(meeting.pdfUrl);
  if (!text) return null;

  const statements = parseStatements(text);
  if (statements.length === 0) return null;

  const heldOn = meeting.heldOn ?? parseDateFromPdfText(text);
  if (!heldOn) return null;

  return {
    municipalityCode,
    title: meeting.title,
    meetingType: detectMeetingType(meeting.title),
    heldOn,
    sourceUrl: meeting.pdfUrl,
    externalId: meeting.pdfKey,
    statements,
  };
}
