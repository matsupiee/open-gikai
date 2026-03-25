/**
 * 八代市議会 -- detail フェーズ
 *
 * ACT=203 で会議録本文 HTML を取得し、発言ブロックを解析して
 * ParsedStatement 配列を生成する。
 *
 * 発言フォーマット:
 *   ○議長（高山正夫君）　これより令和７年９月定例会を開会いたします。
 *   ◎副市長（平井宏英君）　お許しをいただきましたので...
 *   ◆木村博幸君　皆様、こんにちは。
 *
 * 記号の意味:
 *   ○ → 議長・一般発言者
 *   ◎ → 答弁者（行政側）
 *   ◆ → 質問者（議員）
 */

import { createHash } from "node:crypto";
import type { MeetingData, ParsedStatement } from "../../../utils/types";
import { BASE_URL, detectMeetingType, fetchPage } from "./shared";

export interface YatsushiroDetailParams {
  /** ファイル番号 */
  fino: number;
  /** 会議番号 */
  kgno: number;
  /** 会議名（例: "令和　７年　９月定例会"） */
  meetingTitle: string;
  /** 会議種別 */
  meetingType: string;
  /** 詳細ページ URL */
  detailUrl: string;
}

// 役職サフィックス（長いものを先に置いて誤マッチを防ぐ）
const ROLE_SUFFIXES = [
  "副委員長",
  "委員長",
  "副議長",
  "議長",
  "副市長",
  "市長",
  "副教育長",
  "教育長",
  "事務局長",
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
  "理事",
  "議員",
  "委員",
];

// 行政側の役職（答弁者として分類する）
const ANSWER_ROLES = new Set([
  "市長",
  "副市長",
  "教育長",
  "副教育長",
  "部長",
  "副部長",
  "課長",
  "副課長",
  "室長",
  "局長",
  "事務局長",
  "係長",
  "参事",
  "主幹",
  "主査",
  "補佐",
  "理事",
]);

/**
 * 発言ヘッダーから発言者情報を抽出する。
 *
 * 対応パターン:
 *   ○議長（高山正夫君）　→ role=議長, name=高山正夫
 *   ◎副市長（平井宏英君）　→ role=副市長, name=平井宏英
 *   ◆木村博幸君　→ role=議員, name=木村博幸
 *   ◆（木村博幸君）　→ role=議員, name=木村博幸
 *   ◎理事兼水道局長（吉永哲也君）　→ role=局長, name=吉永哲也
 */
export function parseSpeaker(text: string): {
  speakerName: string | null;
  speakerRole: string | null;
  content: string;
} {
  const stripped = text.replace(/^[○◎◆]\s*/, "");

  // パターン1: role（name + 君）content
  const withRoleMatch = stripped.match(
    /^(.+?)（(.+?)君）[\u3000\s]*([\s\S]*)/,
  );
  if (withRoleMatch) {
    const rolePart = withRoleMatch[1]!.trim();
    const rawName = withRoleMatch[2]!.replace(/[\s\u3000]+/g, "").trim();
    const content = withRoleMatch[3]!.trim();

    // 役職マッチ（長いものを優先）
    for (const suffix of ROLE_SUFFIXES) {
      if (rolePart === suffix || rolePart.endsWith(suffix)) {
        return { speakerName: rawName, speakerRole: suffix, content };
      }
    }

    return {
      speakerName: rawName,
      speakerRole: rolePart || null,
      content,
    };
  }

  // パターン2: ◆name君　content（役職なし議員）
  const noRoleMatch = stripped.match(/^(.+?)君[\u3000\s]+([\s\S]*)/);
  if (noRoleMatch) {
    const rawName = noRoleMatch[1]!.replace(/[\s\u3000]+/g, "").trim();
    const content = noRoleMatch[2]!.trim();
    // 役職マッチを試みる（例: 「議長」単独）
    for (const suffix of ROLE_SUFFIXES) {
      if (rawName === suffix || rawName.endsWith(suffix)) {
        const name =
          rawName.length > suffix.length
            ? rawName.slice(0, -suffix.length)
            : null;
        return { speakerName: name, speakerRole: suffix, content };
      }
    }
    return { speakerName: rawName, speakerRole: "議員", content };
  }

  return { speakerName: null, speakerRole: null, content: stripped.trim() };
}

/** 役職から発言種別を分類 */
export function classifyKind(
  speakerRole: string | null,
  marker: string,
): "remark" | "question" | "answer" {
  if (!speakerRole) {
    // マーカーで判定
    if (marker === "◆") return "question";
    if (marker === "◎") return "answer";
    return "remark";
  }

  if (ANSWER_ROLES.has(speakerRole)) return "answer";
  if (
    speakerRole === "議長" ||
    speakerRole === "副議長" ||
    speakerRole === "委員長" ||
    speakerRole === "副委員長"
  )
    return "remark";

  // サフィックスで行政役職を判定
  for (const role of ANSWER_ROLES) {
    if (speakerRole.endsWith(role)) return "answer";
  }

  return "question";
}

/**
 * HTML の <BR> タグを改行に変換してテキストを抽出する。
 */
export function htmlToText(html: string): string {
  return html
    .replace(/<BR\s*\/?>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, "\u3000")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .trim();
}

/**
 * 会議録本文 HTML を ParsedStatement 配列に変換する。
 *
 * <A NAME="HUID{数値}"></A> アンカーで発言ブロックを区切る。
 * 各ブロック内の発言記号（○◎◆）で始まるテキストを発言として抽出。
 */
export function parseStatements(html: string): ParsedStatement[] {
  // HUID アンカーでブロックを分割
  const blocks = html.split(/<A\s+NAME="HUID\d+"><\/A>/i);

  const statements: ParsedStatement[] = [];
  let offset = 0;

  for (const block of blocks) {
    const text = htmlToText(block);
    if (!text) continue;

    // ブロック内の行を解析
    const lines = text.split("\n").map((l) => l.trim()).filter(Boolean);

    // 発言マーカーで始まる連続する行をまとめて1つの発言にする
    let currentMarker: string | null = null;
    let currentLines: string[] = [];

    const flushStatement = () => {
      if (!currentMarker || currentLines.length === 0) return;

      const fullText = currentLines.join(" ");
      const markerPattern = /^([○◎◆])\s*/;
      const markerMatch = fullText.match(markerPattern);
      const marker = markerMatch ? markerMatch[1]! : currentMarker;

      const { speakerName, speakerRole, content } = parseSpeaker(fullText);
      if (!content) return;

      // ト書きをスキップ（登壇・退席等）
      if (/^[○◎◆]\s*[（(].+?(?:登壇|退席|退場|着席)[）)]$/.test(fullText.trim())) {
        currentMarker = null;
        currentLines = [];
        return;
      }

      const kind = classifyKind(speakerRole, marker);
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

      currentMarker = null;
      currentLines = [];
    };

    for (const line of lines) {
      if (/^[○◎◆]/.test(line)) {
        // 前の発言を確定
        flushStatement();
        currentMarker = line[0]!;
        currentLines = [line];
      } else if (currentMarker) {
        // 継続行
        currentLines.push(line);
      }
      // マーカーのない行（議事日程等）はスキップ
    }
    // ブロック末尾の発言を確定
    flushStatement();
  }

  return statements;
}

/**
 * 会議録 HTML からメタ情報（開催日、会議名）を抽出する。
 *
 * パターン例:
 * ・令和７年１０月３日（金曜日）
 * ・令和元年６月５日（水曜日）
 * ・昭和６２年３月１１日（水曜日）
 */
export function extractHeldOn(html: string): string | null {
  const text = htmlToText(html);

  // 全角数字を半角に変換
  const normalized = text.replace(/[０-９]/g, (c) =>
    String.fromCharCode(c.charCodeAt(0) - 0xfee0),
  );

  // 開催日パターン: ・令和/平成/昭和 + 年 + 月 + 日
  const patterns = [
    /(令和|平成|昭和)(元|\d+)\s*年\s*(\d{1,2})\s*月\s*(\d{1,2})\s*日/,
  ];

  for (const pattern of patterns) {
    const m = normalized.match(pattern);
    if (m) {
      const era = m[1]!;
      const eraYear = m[2] === "元" ? 1 : parseInt(m[2]!, 10);
      const month = parseInt(m[3]!, 10);
      const day = parseInt(m[4]!, 10);

      const baseYear =
        era === "令和" ? 2018 : era === "平成" ? 1988 : 1925;
      const year = baseYear + eraYear;

      return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    }
  }

  return null;
}

/**
 * 会議録本文の URL を構築する（ACT=203）。
 */
export function buildContentUrl(fino: number): string {
  return `${BASE_URL}?ACT=203&FINO=${fino}&KENSAKU=0&SORT=0&KTYP=0,1,2,3&KGTP=1,2&HATSUGENMODE=1&HYOUJIMODE=0&STYLE=0`;
}

/**
 * detailParams から MeetingData を組み立てる。
 */
export async function buildMeetingData(
  params: YatsushiroDetailParams,
  municipalityCode: string,
): Promise<MeetingData | null> {
  const contentUrl = buildContentUrl(params.fino);
  const html = await fetchPage(contentUrl);
  if (!html) return null;

  const heldOn = extractHeldOn(html);
  if (!heldOn) return null;

  const statements = parseStatements(html);
  if (statements.length === 0) return null;

  const meetingType = detectMeetingType(params.meetingTitle);

  return {
    municipalityCode,
    title: params.meetingTitle.replace(/[\u3000\s]+/g, ""),
    meetingType: meetingType || params.meetingType,
    heldOn,
    sourceUrl: params.detailUrl,
    externalId: `yatsushiro_fino${params.fino}`,
    statements,
  };
}
