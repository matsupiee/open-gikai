/**
 * kensakusystem.jp スクレイパー — detail フェーズ
 *
 * 議事録詳細ページから本文を取得し、MeetingData に変換する。
 *
 * 処理フロー:
 * 1. ResultFrame.exe (frameset) → FRAME SRC から r_Speakers.exe URL を取得
 * 2. r_Speakers.exe → Code, fileName, downloadPos (全発言者), GetPerson.exe URL を取得
 * 3. GetPerson.exe に全 downloadPos を POST → Shift-JIS plain text で全発言を取得
 * 4. plain text を ○ マーカーで分割して ParsedStatement 配列に変換
 */

import { createHash } from "node:crypto";
import type { MeetingData, ParsedStatement } from "../../../utils/types";
import {
  fetchWithEncoding,
  fetchRawBytesPost,
  decodeShiftJis,
  detectMeetingType,
} from "../_shared";

export interface KensakusystemDetailSchedule {
  title: string;
  heldOn: string;
  url: string;
}

// 役職サフィックス（長い方を先に置いて誤マッチを防ぐ）
const ROLE_SUFFIXES = [
  "委員長",
  "副委員長",
  "副議長",
  "副市長",
  "副町長",
  "副村長",
  "副部長",
  "副課長",
  "市長室長",
  "支所長",
  "センター長",
  "議長",
  "市長",
  "町長",
  "村長",
  "委員",
  "議員",
  "部長",
  "課長",
  "室長",
  "局長",
  "係長",
  "主任",
  "補佐",
  "主査",
];

// 行政側の役職（答弁者として分類する）
const ANSWER_ROLES = new Set([
  "市長",
  "町長",
  "村長",
  "副市長",
  "副町長",
  "副村長",
  "市長室長",
  "支所長",
  "センター長",
  "部長",
  "課長",
  "室長",
  "局長",
  "係長",
  "主任",
  "補佐",
  "主査",
]);

function parseSpeaker(text: string): {
  speakerName: string | null;
  speakerRole: string | null;
  content: string;
} {
  const hasMarker = /^[○◯◎●]/.test(text);
  const stripped = text.replace(/^[○◯◎●]\s*/, "");
  // 50文字まで対応（複数の括弧を含む役職名に対応）
  const headerMatch = stripped.match(/^([^\s　]{1,50})[\s　]+/);
  if (headerMatch?.[1]) {
    const header = headerMatch[1];
    const content = stripped.slice(headerMatch[0].length).trim();

    // パターン1: 末尾が（名前君）または（名前様）で終わる場合
    // 例: "議長（川越桂路君）"
    // 例: "青山支所長（兼地域振興総括監）（稲森真一君）" → role=青山支所長, name=稲森真一
    // 例: "１２番（宮﨑栄樹君）" → role=議員, name=宮﨑栄樹
    const lastParenMatch = header.match(/^(.*?)[（(]([^（）()]*)[君様][）)]$/);
    if (lastParenMatch?.[1] != null && lastParenMatch[2] != null) {
      const rolePart = lastParenMatch[1].trim();
      const rawName = lastParenMatch[2].trim();

      // 番号議員: "１２番" や "12番" → speakerRole = "議員"
      if (/^[\d０-９]+番$/.test(rolePart)) {
        return { speakerName: rawName || null, speakerRole: "議員", content };
      }

      // ROLE_SUFFIXES にマッチする場合
      for (const suffix of ROLE_SUFFIXES) {
        if (rolePart === suffix || rolePart.endsWith(suffix)) {
          return { speakerName: rawName || null, speakerRole: suffix, content };
        }
      }

      // サフィックスにマッチしない場合 — 括弧内補足を除いた役職を使う
      // 例: "青山支所長（兼地域振興総括監）" → "青山支所長"
      if (rawName && hasMarker) {
        const roleWithoutParens = rolePart
          .replace(/[（(][^）)]*[）)]/g, "")
          .trim();
        return {
          speakerName: rawName,
          speakerRole: roleWithoutParens || null,
          content,
        };
      }
    }

    // パターン2: 名前役職形式 — 例: "田中市長"
    for (const suffix of ROLE_SUFFIXES) {
      if (header.endsWith(suffix)) {
        const name =
          header.length > suffix.length
            ? header.slice(0, -suffix.length)
            : null;
        return { speakerName: name, speakerRole: suffix, content };
      }
    }

    // ○ マーカーがある場合、役職が不明でも先頭の名前部分を content から除去する
    if (hasMarker) {
      return { speakerName: header, speakerRole: null, content };
    }
  }
  return { speakerName: null, speakerRole: null, content: stripped.trim() };
}

function classifyKind(speakerRole: string | null): string {
  if (!speakerRole) return "remark";
  if (ANSWER_ROLES.has(speakerRole)) return "answer";
  if (speakerRole === "議長" || speakerRole === "委員長") return "remark";
  // 部分一致: "環境センター長" → endsWith("センター長") → "answer"
  for (const role of ANSWER_ROLES) {
    if (speakerRole.endsWith(role)) return "answer";
  }
  return "question";
}

/**
 * GetPerson.exe から返される plain text を ParsedStatement 配列に変換する。
 *
 * plain text は ○ マーカーで始まる発言ブロックの連続。
 * 複数行にまたがる発言は空白で連結してひとつの content にまとめる。
 */
function parseStatementsFromPlainText(text: string): ParsedStatement[] {
  // ○ 記号の前で分割（ルックアヘッド）
  const blocks = text.split(/(?=[○◯◎●])/);
  const statements: ParsedStatement[] = [];
  let offset = 0;

  for (const block of blocks) {
    const trimmed = block.trim();
    if (!trimmed || !/^[○◯◎●]/.test(trimmed)) continue;

    // 複数行を空白でつなぐ
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
 * r_Speakers.exe HTML から GetPerson.exe への POST に必要な情報を抽出する。
 */
function extractSpeakerPageInfo(html: string): {
  actionUrl: string | null;
  code: string | null;
  fileName: string | null;
  downloadPositions: string[];
} {
  // フォーム action URL（name="download" のフォーム）
  const actionMatch = html.match(
    /<form[^>]*name=["\']download["\'][^>]*action=["\']([^"\']+)["\']|<form[^>]*action=["\']([^"\']+)["\'][^>]*name=["\']download["\']/i
  );
  const actionUrl = actionMatch?.[1] ?? actionMatch?.[2] ?? null;

  // hidden: Code
  const codeMatch = html.match(
    /<input[^>]*name=["\']Code["\'][^>]*value=["\']([^"\']*)["\']|<input[^>]*value=["\']([^"\']*)["\'][^>]*name=["\']Code["\'][^>]*/i
  );
  const code = codeMatch?.[1] ?? codeMatch?.[2] ?? null;

  // hidden: fileName
  const fileNameMatch = html.match(
    /<input[^>]*name=["\']fileName["\'][^>]*value=["\']([^"\']*)["\']|<input[^>]*value=["\']([^"\']*)["\'][^>]*name=["\']fileName["\'][^>]*/i
  );
  const fileName = fileNameMatch?.[1] ?? fileNameMatch?.[2] ?? null;

  // checkbox: downloadPos（全て収集）
  const downloadPositions: string[] = [];
  for (const m of html.matchAll(
    /<input[^>]*name=["\']downloadPos["\'][^>]*value=["\']([^"\']*)["\']|<input[^>]*value=["\']([^"\']*)["\'][^>]*name=["\']downloadPos["\'][^>]*/gi
  )) {
    const val = m[1] ?? m[2];
    if (val) downloadPositions.push(val);
  }

  return { actionUrl, code, fileName, downloadPositions };
}

/**
 * ResultFrame.exe frameset HTML から r_Speakers.exe の FRAME SRC URL を抽出する。
 */
function extractSpeakersFrameUrl(
  framesetHtml: string,
  baseUrl: string
): string | null {
  const match = framesetHtml.match(
    /<frame[^>]*src=["\']([^"\']*r_Speakers\.exe[^"\']*)["\'][^>]*/i
  );
  if (!match?.[1]) return null;
  return new URL(match[1], baseUrl).toString();
}

/**
 * 議事録詳細ページから発言一覧を取得する。
 *
 * detailUrl は ResultFrame.exe URL。
 * frameset → r_Speakers.exe → GetPerson.exe の順で取得する。
 */
export async function fetchMeetingStatements(
  detailUrl: string
): Promise<ParsedStatement[] | null> {
  // Step 1: ResultFrame.exe frameset を取得し r_Speakers.exe URL を抽出
  const framesetHtml = await fetchWithEncoding(detailUrl);
  if (!framesetHtml) return null;

  const speakersUrl = extractSpeakersFrameUrl(framesetHtml, detailUrl);
  if (!speakersUrl) return null;

  // Step 2: r_Speakers.exe を取得して Code, fileName, downloadPos, action URL を抽出
  const speakersHtml = await fetchWithEncoding(speakersUrl);
  if (!speakersHtml) return null;

  const { actionUrl, code, fileName, downloadPositions } =
    extractSpeakerPageInfo(speakersHtml);

  if (!actionUrl || !code || !fileName || downloadPositions.length === 0) {
    return null;
  }

  // Step 3: GetPerson.exe に全 downloadPos を POST して plain text を取得
  const absoluteActionUrl = new URL(actionUrl, speakersUrl).toString();
  const bodyParts: string[] = [
    `Code=${encodeURIComponent(code)}`,
    `fileName=${encodeURIComponent(fileName)}`,
    ...downloadPositions.map((pos) => `downloadPos=${encodeURIComponent(pos)}`),
  ];
  const body = bodyParts.join("&");

  const rawBytes = await fetchRawBytesPost(absoluteActionUrl, body);
  if (!rawBytes) return null;

  // Step 4: Shift-JIS デコード → plain text パース
  let plainText: string;
  try {
    plainText = decodeShiftJis(rawBytes);
  } catch {
    return null;
  }

  const statements = parseStatementsFromPlainText(plainText);
  return statements.length > 0 ? statements : null;
}

/**
 * 一覧から個別の議事録を取得して MeetingData に変換
 */
export async function fetchMeetingDataFromSchedule(
  schedule: KensakusystemDetailSchedule,
  municipalityId: string,
  slug: string
): Promise<MeetingData | null> {
  const statements = await fetchMeetingStatements(schedule.url);
  if (!statements) return null;

  const meetingType = detectMeetingType(schedule.title);

  const fileNameMatch = schedule.url.match(/[?&]fileName=([^&]+)/i);
  const codeMatch = schedule.url.match(/[?&]Code=([^&]+)/);
  const fileName = fileNameMatch?.[1] ?? "";
  const code = codeMatch?.[1] ?? "";
  const externalId = fileName
    ? `kensakusystem_${slug}_${fileName}`
    : code
    ? `kensakusystem_${slug}_${code}`
    : null;

  return {
    municipalityId,
    title: schedule.title,
    meetingType,
    heldOn: schedule.heldOn,
    sourceUrl: schedule.url,
    externalId,
    statements,
  };
}
