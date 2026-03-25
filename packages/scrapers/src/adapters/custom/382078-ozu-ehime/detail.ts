/**
 * 大洲市議会 会議録 — detail フェーズ
 *
 * 会議録本文 HTML (UTF-8) から全発言を抽出し、MeetingData に変換する。
 *
 * 会議録の構造:
 *   - <BODY> 直下の <P><FONT face="ＭＳ ゴシック"> タグ内にテキストが <BR> 区切りで入る
 *   - ページネーションなし (1会期複数日は別ファイル -1.html, -2.html, ...)
 *
 * 発言者パターン（役職が後置）:
 *   ○新山勝久議長　ただいまから令和８年大洲市議会第１回臨時会を開会いたします。
 *   ○二宮隆久市長　議長
 *   ○18番梅木加津子議員　議案第１号に対する質疑を行います。
 *   <A name="{ID}">○{氏名}{役職}</A>
 *
 * ヘッダー情報:
 *   令和８年大洲市議会第１回臨時会会議録　第１号
 *   令和８年１月13日（火曜日）
 */

import { createHash } from "node:crypto";
import type { MeetingData, ParsedStatement } from "../../../utils/types";
import { detectMeetingType, fetchPage } from "./shared";
import type { OzuDocument } from "./list";

/**
 * 役職サフィックス一覧（長い方を先に配置）。
 * 大洲市は「○{氏名}{役職}」のフォーマット（役職後置）。
 */
const ROLE_SUFFIXES = [
  "副委員長",
  "委員長",
  "副議長",
  "議長",
  "副市長",
  "市長",
  "教育長",
  "事務局長",
  "部長",
  "局長",
  "課長",
  "室長",
  "係長",
  "参事",
  "主幹",
  "主任",
  "議員",
];

/** 行政側の役職キーワード（答弁者として分類する） */
const ANSWER_ROLE_KEYWORDS = [
  "市長",
  "副市長",
  "教育長",
  "部長",
  "課長",
  "室長",
  "局長",
  "係長",
  "参事",
  "主幹",
  "主任",
  "事務局長",
];

/**
 * 発言行から話者名・役職・本文を抽出する。
 *
 * 大洲市のフォーマット（役職後置）:
 *   ○新山勝久議長　テキスト
 *   ○18番梅木加津子議員　テキスト
 *   ○二宮隆久市長　テキスト
 */
export function parseSpeaker(text: string): {
  speakerName: string | null;
  speakerRole: string | null;
  content: string;
} {
  // ○ で始まらない行
  if (!text.startsWith("○")) {
    return { speakerName: null, speakerRole: null, content: text.trim() };
  }

  // ○ の後ろの部分（全角スペースまで）
  const afterMark = text.slice(1);

  // 全角スペースまたは半角スペースで発言者部分と本文を分割
  const spaceIdx = afterMark.search(/[\s　]/);
  if (spaceIdx === -1) {
    // 本文なしの場合（発言者名のみ）
    const speakerPart = afterMark.trim();
    const { name, role } = extractNameAndRole(speakerPart);
    return { speakerName: name, speakerRole: role, content: "" };
  }

  const speakerPart = afterMark.slice(0, spaceIdx).trim();
  const content = afterMark.slice(spaceIdx + 1).trim();

  const { name, role } = extractNameAndRole(speakerPart);
  return { speakerName: name, speakerRole: role, content };
}

/**
 * 発言者文字列から氏名と役職を抽出する。
 *
 * 役職サフィックスを後ろから検索し、マッチした部分を役職、残りを氏名とする。
 * 例:
 *   "新山勝久議長" → { name: "新山勝久", role: "議長" }
 *   "18番梅木加津子議員" → { name: "18番梅木加津子", role: "議員" }
 *   "二宮隆久市長" → { name: "二宮隆久", role: "市長" }
 */
function extractNameAndRole(speakerPart: string): { name: string | null; role: string | null } {
  for (const suffix of ROLE_SUFFIXES) {
    if (speakerPart.endsWith(suffix)) {
      const name = speakerPart.slice(0, speakerPart.length - suffix.length).trim();
      return { name: name || null, role: suffix };
    }
  }
  // 役職が見つからない場合は全体を氏名とする
  return { name: speakerPart || null, role: null };
}

/** 役職から発言種別を分類 */
export function classifyKind(speakerRole: string | null): "remark" | "question" | "answer" {
  if (!speakerRole) return "remark";

  // 議長・副議長・委員長・副委員長の進行発言
  if (["議長", "副議長", "委員長", "副委員長"].includes(speakerRole)) return "remark";

  // 議員（一般質問者）
  if (speakerRole === "議員") return "question";

  // 行政側の答弁
  for (const keyword of ANSWER_ROLE_KEYWORDS) {
    if (speakerRole.includes(keyword)) return "answer";
  }

  return "remark";
}

/**
 * ヘッダーから開催日を抽出する。
 *
 * パターン: 令和８年１月13日（火曜日）/ 平成30年3月1日（木曜日）
 * 全角数字も対応。
 */
export function parseHeldOn(html: string): string | null {
  // 全角数字を半角に変換
  const normalized = html.replace(/[０-９]/g, (c) =>
    String.fromCharCode(c.charCodeAt(0) - 0xfee0),
  );

  // 和暦日付パターン
  const dateMatch = normalized.match(
    /(令和|平成)(元|\d+)年(\d+)月(\d+)日/,
  );
  if (!dateMatch) return null;

  const gengo = dateMatch[1]!;
  const nenStr = dateMatch[2]!;
  const month = parseInt(dateMatch[3]!, 10);
  const day = parseInt(dateMatch[4]!, 10);

  const nen = nenStr === "元" ? 1 : parseInt(nenStr, 10);
  let yyyy: number;
  if (gengo === "令和") {
    yyyy = 2018 + nen;
  } else {
    yyyy = 1988 + nen;
  }

  if (isNaN(yyyy) || isNaN(month) || isNaN(day)) return null;

  return `${yyyy}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

/**
 * 会議録本文 HTML から発言一覧をパースする。
 *
 * 大洲市の会議録は <BODY> 内の <P><FONT> タグ内に <BR> 区切りでテキストが入る。
 * 〔〕内の登壇表記は発言ではないためスキップする。
 */
export function parseStatements(html: string): ParsedStatement[] {
  const statements: ParsedStatement[] = [];

  // <A name="..."> タグを除去してテキスト化
  const cleaned = html
    .replace(/<A\s+name="[^"]*">/gi, "")
    .replace(/<\/A>/gi, "")
    .replace(/<BR\s*\/?>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(Number(code)));

  const lines = cleaned.split("\n");

  let currentSpeaker: { name: string | null; role: string | null } | null = null;
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

    // 登壇表記 〔...登壇〕 はスキップ
    if (/^〔.+登壇〕$/.test(trimmed)) continue;

    // 時刻行はスキップ
    if (/^午[前後][０-９0-9]+時[０-９0-9]+分/.test(trimmed)) {
      flush();
      continue;
    }

    // ○ で始まる行 = 新しい発言者
    if (trimmed.startsWith("○")) {
      flush();
      const { speakerName, speakerRole, content } = parseSpeaker(trimmed);
      currentSpeaker = { name: speakerName, role: speakerRole };
      if (content) {
        currentContent.push(content);
      }
      continue;
    }

    // 継続行
    currentContent.push(trimmed);
  }

  flush();

  return statements;
}

/**
 * 複数ページにまたがる会議録本文を結合して取得する。
 *
 * 大洲市は -1.html, -2.html, ... と分割されることがある。
 * 存在する限りページを取得して結合する。
 */
async function fetchAllPages(baseUrl: string): Promise<string | null> {
  const htmlParts: string[] = [];

  // 最初のページ (-1.html) を取得
  const first = await fetchPage(baseUrl);
  if (!first) return null;
  htmlParts.push(first);

  // 次のページが存在するか確認
  // URL パターン: .../R08/202601rinji-1.html → -2.html, -3.html, ...
  const pageMatch = baseUrl.match(/^(.+)-(\d+)\.html$/);
  if (pageMatch) {
    const prefix = pageMatch[1]!;
    let pageNum = 2;

    while (true) {
      const nextUrl = `${prefix}-${pageNum}.html`;
      const html = await fetchPage(nextUrl);
      if (!html) break;
      htmlParts.push(html);
      pageNum++;

      // 安全のため上限を設ける
      if (pageNum > 20) break;
    }
  }

  return htmlParts.join("\n");
}

/**
 * 会議録ページから MeetingData を組み立てる。
 */
export async function fetchMeetingData(
  doc: OzuDocument,
  municipalityCode: string,
): Promise<MeetingData | null> {
  const html = await fetchAllPages(doc.detailUrl);
  if (!html) return null;

  const heldOn = parseHeldOn(html) ?? null;
  if (!heldOn) {
    console.warn(`[ozu-ehime] heldOn parse failed: ${doc.detailUrl}`);
  }

  const statements = parseStatements(html);
  if (statements.length === 0) return null;

  return {
    municipalityCode,
    title: doc.sessionTitle,
    meetingType: detectMeetingType(doc.sessionTitle),
    heldOn: heldOn ?? doc.heldYearMonth + "-01",
    sourceUrl: doc.detailUrl,
    externalId: `ozu-ehime_${doc.fileKey}`,
    statements,
  };
}
