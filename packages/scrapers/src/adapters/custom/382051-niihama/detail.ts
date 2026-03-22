/**
 * 新居浜市議会 会議録 — detail フェーズ
 *
 * 会議録ページから全発言を抽出し、MeetingData に変換する。
 *
 * 発言は <br> 区切りのプレーンテキストで格納されている。
 * 話者パターン:
 *   ○議長（小野辰夫）　これより本日の会議を開きます。
 *   <a id="9">○２５番（仙波憲一）</a>（登壇）　おはようございます。
 *   <a id="10">○市長（古川拓哉）</a>（登壇）　お答えします。
 *   <a id="16">○福祉部こども局長（沢田友子）</a>（登壇）　お答えいたします。
 *
 * 継続行は全角スペースで始まる:
 *   　本日の議事日程につきましては...
 */

import { createHash } from "node:crypto";
import type { MeetingData, ParsedStatement } from "../../../utils/types";
import { BASE_ORIGIN, detectMeetingType, fetchPage } from "./shared";

// 行政側の役職キーワード（答弁者として分類する）
const ANSWER_ROLE_KEYWORDS = [
  "市長",
  "副市長",
  "部長",
  "課長",
  "室長",
  "局長",
  "係長",
  "参事",
  "主幹",
  "事務局長",
];

/**
 * 発言行から話者名・役職・本文を抽出する。
 *
 * 新居浜市のフォーマット:
 *   ○議長（小野辰夫）　テキスト
 *   ○２５番（仙波憲一）（登壇）　テキスト
 *   ○市長（古川拓哉）（登壇）　テキスト
 *   ○福祉部こども局長（沢田友子）（登壇）　テキスト
 */
export function parseSpeaker(text: string): {
  speakerName: string | null;
  speakerRole: string | null;
  content: string;
} {
  // ○{役職}（{名前}）（登壇）　{本文} のパターン
  const match = text.match(
    /^○(.+?)（([^）]+)）(?:（登壇）)?[\s　]+(.+)/s,
  );
  if (!match) {
    return { speakerName: null, speakerRole: null, content: text.trim() };
  }

  const role = match[1]!.trim();
  const name = match[2]!.trim();
  const content = match[3]!.trim();

  return { speakerName: name, speakerRole: role, content };
}

/** 役職から発言種別を分類 */
export function classifyKind(speakerRole: string | null): string {
  if (!speakerRole) return "remark";

  // 議長・副議長の進行発言
  if (speakerRole === "議長" || speakerRole === "副議長") return "remark";

  // 番号付き議員（例: "２５番"）
  if (/^\d+番$/.test(speakerRole) || /^[０-９]+番$/.test(speakerRole)) return "question";

  // 行政側の答弁
  for (const keyword of ANSWER_ROLE_KEYWORDS) {
    if (speakerRole.includes(keyword)) return "answer";
  }

  return "question";
}

/**
 * 会議録ページの HTML から本文テキストを抽出する。
 *
 * detail_free div 内の開議マーカー以降を本文として扱い、
 * <br> で行分割して発言ブロックを構築する。
 */
export function parseStatements(html: string): ParsedStatement[] {
  const statements: ParsedStatement[] = [];

  // detail_free div 内のコンテンツを取得（開議以降）
  // 開議マーカー: 午前/午後N時N分開議
  const openingMatch = html.match(/午[前後][０-９0-9]+時[０-９0-9]+分開議/);
  if (!openingMatch?.index) return [];

  // 開議以降のHTMLを取得
  const bodyHtml = html.slice(openingMatch.index);

  // HTMLタグを処理してテキスト行に変換
  const cleaned = bodyHtml
    .replace(/<a\s+id="[^"]*">/gi, "")  // アンカータグ開始を除去
    .replace(/<\/a>/gi, "")              // アンカータグ終了を除去
    .replace(/<br\s*\/?>/gi, "\n")       // <br> を改行に
    .replace(/<[^>]+>/g, "")             // その他のHTMLタグ除去
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(Number(code)));

  const lines = cleaned.split("\n");

  // ○ で始まる行を発言の開始として認識し、
  // 次の ○ 行までを1つの発言ブロックとしてまとめる
  let currentSpeaker: { role: string | null; name: string | null } | null = null;
  let currentContent: string[] = [];
  let offset = 0;

  const flush = () => {
    if (!currentSpeaker && currentContent.length === 0) return;

    const content = currentContent.join("\n").trim();
    if (!content) {
      currentSpeaker = null;
      currentContent = [];
      return;
    }

    const contentHash = createHash("sha256").update(content).digest("hex");
    const startOffset = offset;
    const endOffset = offset + content.length;

    statements.push({
      kind: currentSpeaker ? classifyKind(currentSpeaker.role) : "remark",
      speakerName: currentSpeaker?.name ?? null,
      speakerRole: currentSpeaker?.role ?? null,
      content,
      contentHash,
      startOffset,
      endOffset,
    });

    offset = endOffset + 1;
    currentSpeaker = null;
    currentContent = [];
  };

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;

    // セクション区切りはスキップ
    if (/^[―─]+\s*◇\s*[―─]+$/.test(trimmed)) {
      flush();
      continue;
    }

    // 時刻行はスキップ
    if (/^午[前後][０-９0-9]+時[０-９0-9]+分/.test(trimmed)) {
      flush();
      continue;
    }

    // 日程行はスキップ
    if (/^日程第[０-９0-9]+/.test(trimmed)) {
      flush();
      continue;
    }

    // ○ で始まる行 = 新しい発言者
    if (trimmed.startsWith("○")) {
      flush();
      const { speakerName, speakerRole, content } = parseSpeaker(trimmed);
      currentSpeaker = { role: speakerRole, name: speakerName };
      if (content) {
        currentContent.push(content);
      }
      continue;
    }

    // 継続行（全角スペースで始まる行等）
    currentContent.push(trimmed);
  }

  flush();

  return statements;
}

/**
 * 会議録ページから MeetingData を組み立てる。
 */
export async function fetchMeetingData(
  doc: {
    year: number;
    session: number;
    number: number;
    sessionTitle: string;
    heldOn: string;
    path: string;
  },
  municipalityId: string,
): Promise<MeetingData | null> {
  const url = `${BASE_ORIGIN}${doc.path}`;
  const html = await fetchPage(url);
  if (!html) return null;

  // h1 からタイトルを取得
  const h1Match = html.match(/<h1[^>]*>(.*?)<\/h1>/i);
  const title = h1Match?.[1]?.replace(/<[^>]+>/g, "").trim() ?? doc.sessionTitle;

  const statements = parseStatements(html);
  if (statements.length === 0) return null;

  return {
    municipalityId,
    title,
    meetingType: detectMeetingType(doc.sessionTitle),
    heldOn: doc.heldOn,
    sourceUrl: url,
    externalId: `niihama_${doc.year}-${doc.session}-${doc.number}`,
    statements,
  };
}
