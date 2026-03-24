/**
 * ときがわ町議会 — detail フェーズ
 *
 * 会議録本文 HTML を Shift_JIS でフェッチし、
 * `○` で始まる発言行を ParsedStatement 配列に変換する。
 *
 * 発言フォーマット:
 *   ○神山　俊議長　皆さん、おはようございます。
 *   ○渡邉一美町長　田中議員ご質問の…
 *   ○６番　田中紀吉議員　議長の発言許可をいただきましたので…
 *   ◇　田　中　紀　吉　議員  （質問者見出し — 発言としてパースしない）
 */

import { createHash } from "node:crypto";
import type { MeetingData, ParsedStatement } from "../../../utils/types";
import type { TokigawaMeeting } from "./list";
import { detectMeetingType, fetchPage } from "./shared";

// 行政側の役職（答弁者として分類する）
const ANSWER_ROLES = new Set([
  "町長",
  "副町長",
  "教育長",
  "副教育長",
  "事務局長",
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
  "代表監査委員",
  "監査委員",
  "会計管理者",
]);

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
 * 発言者テキストから役職と氏名を抽出する。
 *
 * パターン:
 *   "神山　俊議長"  -> name="神山　俊", role="議長"
 *   "渡邉一美町長"  -> name="渡邉一美", role="町長"
 *   "６番　田中紀吉議員" -> name="田中紀吉", role="議員"
 *   "総務課長" -> name=null, role="課長"
 */
export function parseSpeakerText(speakerText: string): {
  speakerName: string | null;
  speakerRole: string | null;
} {
  const text = speakerText.trim();

  // 番号付き議員: "６番　田中紀吉議員" または "6番　田中紀吉議員"
  // 全角スペースまたは半角スペースで番号と氏名が区切られる
  const numberedMemberPattern = /^(?:[０-９\d]+番)[　\s]+(.+?)議員$/;
  const numberedMatch = text.match(numberedMemberPattern);
  if (numberedMatch) {
    return {
      speakerName: numberedMatch[1]!.trim() || null,
      speakerRole: "議員",
    };
  }

  // 役職サフィックスでマッチ（長いものを先に）
  const roleSuffixes = [
    "副委員長",
    "委員長",
    "副議長",
    "副町長",
    "副教育長",
    "教育長",
    "議長",
    "町長",
    "副部長",
    "副課長",
    "事務局長",
    "部長",
    "課長",
    "室長",
    "局長",
    "係長",
    "参事",
    "主幹",
    "主査",
    "補佐",
    "代表監査委員",
    "監査委員",
    "会計管理者",
    "議員",
    "委員",
  ];

  for (const suffix of roleSuffixes) {
    if (text.endsWith(suffix)) {
      const namePart = text.slice(0, -suffix.length).trim() || null;
      return { speakerName: namePart, speakerRole: suffix };
    }
  }

  // マッチしない場合はそのまま
  return { speakerName: text || null, speakerRole: null };
}

// 発言者識別に使用する役職サフィックス（長いものを先に）
const SPEAKER_ROLE_SUFFIXES = [
  "副委員長",
  "委員長",
  "副議長",
  "副町長",
  "副教育長",
  "教育長",
  "議長",
  "町長",
  "副部長",
  "副課長",
  "事務局長",
  "部長",
  "課長",
  "室長",
  "局長",
  "係長",
  "参事",
  "主幹",
  "主査",
  "補佐",
  "代表監査委員",
  "監査委員",
  "会計管理者",
  "議員",
  "委員",
];

/**
 * ○ に続く行を発言者部分と発言内容に分割する。
 *
 * 発言者の終わりは役職サフィックスの位置で判断する。
 * 役職サフィックスの直後に来る全角スペース・タブ・半角スペースが区切り。
 *
 * 例:
 *   "神山　俊議長　皆さん…" -> speaker="神山　俊議長", speech="皆さん…"
 *   "６番　田中紀吉議員　議長の発言…" -> speaker="６番　田中紀吉議員", speech="議長の発言…"
 *   "渡邉一美町長　…" -> speaker="渡邉一美町長", speech="…"
 */
export function splitSpeakerAndSpeech(body: string): {
  speakerPart: string;
  speechPart: string;
} {
  // 番号付き議員パターン: "６番　田中紀吉議員　..."
  const numberedMemberMatch = body.match(
    /^([０-９\d]+番[　\s]+.+?議員)[　\s]+(.*)/,
  );
  if (numberedMemberMatch) {
    return {
      speakerPart: numberedMemberMatch[1]!.trim(),
      speechPart: numberedMemberMatch[2]!.trim(),
    };
  }

  // 役職サフィックスで区切り位置を探す
  for (const suffix of SPEAKER_ROLE_SUFFIXES) {
    const idx = body.indexOf(suffix);
    if (idx === -1) continue;

    const afterSuffix = idx + suffix.length;
    // 役職サフィックスの直後が区切り文字か行末であることを確認
    if (
      afterSuffix >= body.length ||
      body[afterSuffix] === "　" ||
      body[afterSuffix] === "\t" ||
      body[afterSuffix] === " "
    ) {
      const speakerPart = body.slice(0, afterSuffix).trim();
      const speechPart = body.slice(afterSuffix).trim();
      return { speakerPart, speechPart };
    }
  }

  // 役職が見つからない場合は最初の区切りで分割
  const fallbackMatch = body.match(/^(.+?)[　\t](.*)$/);
  if (fallbackMatch) {
    return {
      speakerPart: fallbackMatch[1]!.trim(),
      speechPart: fallbackMatch[2]!.trim(),
    };
  }

  return { speakerPart: body.trim(), speechPart: "" };
}

/**
 * 会議録 HTML テキストを ParsedStatement 配列に変換する。
 *
 * ○ で始まる行が発言の区切り。
 * 発言者と発言内容は役職サフィックス直後の区切り文字で分割する。
 * ◇ で始まる行（質問者見出し）はスキップする。
 */
export function parseStatements(text: string): ParsedStatement[] {
  const statements: ParsedStatement[] = [];
  let offset = 0;

  // HTML タグを除去
  const plainText = text
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(Number(code)));

  const lines = plainText.split(/\r?\n/);

  let currentSpeaker: {
    speakerName: string | null;
    speakerRole: string | null;
  } | null = null;
  let contentBuffer = "";

  const flushStatement = () => {
    if (!currentSpeaker) return;
    const content = contentBuffer.trim();
    if (content) {
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
    }
    contentBuffer = "";
    currentSpeaker = null;
  };

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line) continue;

    // ◇ で始まる行（質問者見出し）はスキップ
    if (line.startsWith("◇")) continue;

    // ○ で始まる行が発言
    if (line.startsWith("○")) {
      flushStatement();

      const body = line.slice(1); // ○ を除いた残り
      const { speakerPart, speechPart } = splitSpeakerAndSpeech(body);

      currentSpeaker = parseSpeakerText(speakerPart);
      contentBuffer = speechPart;
    } else {
      // ○ で始まらない行は直前の発言の継続
      if (currentSpeaker !== null) {
        contentBuffer += (contentBuffer ? "\n" : "") + line;
      }
    }
  }

  flushStatement();

  return statements;
}

/**
 * 会議録ファイルから MeetingData を生成する。
 */
export async function fetchMeetingData(
  meeting: TokigawaMeeting,
  municipalityId: string,
): Promise<MeetingData | null> {
  const html = await fetchPage(meeting.fileUrl);
  if (!html) return null;

  const statements = parseStatements(html);
  if (statements.length === 0) return null;

  const baseName = `${meeting.yearDir}_${meeting.fileName.replace(/\.htm$/i, "")}`;
  const externalId = `tokigawa_${baseName}`;

  return {
    municipalityId,
    title: meeting.meetingTitle,
    meetingType: detectMeetingType(meeting.meetingTitle),
    heldOn: meeting.heldOn,
    sourceUrl: meeting.fileUrl,
    externalId,
    statements,
  };
}
