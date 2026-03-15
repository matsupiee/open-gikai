import { createHash } from "node:crypto";
import { eq } from "drizzle-orm";
import { meetings, statements } from "@open-gikai/db/schema";
import type { Db } from "@open-gikai/db";
import { buildChunksForMeeting } from "./build-chunks";

/**
 * rawText を発言単位に分割する。
 *
 * 1. "\n\n---\n\n" セパレータがある場合: そのセパレータで分割（鹿児島等）
 * 2. セパレータがない場合: 行頭の ○◎◆ 発言者マーカーで発言者ごとに分割
 *    （議会会議録のように「○氏名役職　発言内容」形式のテキスト）
 *    ※ 最初の発言者マーカーより前のヘッダー行はスキップする
 */
function splitIntoStatements(rawText: string): string[] {
  if (rawText.includes("\n\n---\n\n")) {
    const parts = rawText
      .split("\n\n---\n\n")
      .map((p) => p.trim())
      .filter(Boolean);
    return parts.length > 0 ? parts : [rawText.trim()];
  }

  // 発言者マーカー（○◎◆）で始まる行で分割
  const speakerLinePattern = /^[○◎◆]/;
  const lines = rawText.split("\n");

  const statements: string[] = [];
  let currentLines: string[] = [];
  let foundFirstSpeaker = false;

  for (const line of lines) {
    if (speakerLinePattern.test(line)) {
      if (foundFirstSpeaker && currentLines.length > 0) {
        const statement = currentLines.join("\n").trim();
        if (statement) statements.push(statement);
      }
      currentLines = [line];
      foundFirstSpeaker = true;
    } else if (foundFirstSpeaker) {
      currentLines.push(line);
    }
    // foundFirstSpeaker が false の間はヘッダー行をスキップ
  }

  // 最後のブロックを追加
  if (foundFirstSpeaker && currentLines.length > 0) {
    const statement = currentLines.join("\n").trim();
    if (statement) statements.push(statement);
  }

  return statements.length > 0 ? statements : [rawText.trim()];
}

/**
 * 行政職員の役職（答弁者として扱う）
 */
const EXECUTIVE_ROLES = new Set([
  "市長",
  "副市長",
  "部長",
  "副部長",
  "課長",
  "副課長",
  "室長",
  "市長室長",
  "局長",
  "係長",
  "主任",
  "補佐",
  "主査",
]);

/**
 * 議事進行役の役職（一般発言として扱う）
 */
const PRESIDING_ROLES = new Set(["議長", "副議長", "委員長", "副委員長"]);

/**
 * 発言種別を分類する。
 *
 * - presiding role (議長/委員長 など)  → "remark"
 * - executive role (市長/部長/課長 など) → "answer"
 * - その他 (議員・委員 など)              → "question"
 */
function classifyKind(speakerRole: string | null): string {
  if (speakerRole) {
    if (PRESIDING_ROLES.has(speakerRole)) return "remark";
    if (EXECUTIVE_ROLES.has(speakerRole)) return "answer";
  }
  return "question";
}

/**
 * 役職サフィックス一覧（長いものを優先してマッチ）
 */
const ROLE_SUFFIXES = [
  "委員長",
  "副委員長",
  "副議長",
  "市長室長",
  "副市長",
  "副部長",
  "副課長",
  "議長",
  "市長",
  "委員",
  "部長",
  "課長",
  "室長",
  "局長",
  "係長",
  "主任",
  "補佐",
  "主査",
];

/**
 * 発言テキストから発言者プレフィックス（○委員長（中元かつあき）　など）を除去して
 * 本文のみを返す。
 */
function stripSpeakerPrefix(text: string): string {
  return text.replace(/^[○◎◆][^（　\s]+(?:（[^）]+）)?[　\s]?/, "").trim();
}

/**
 * 発言テキストから発言者情報を抽出する。
 *
 * 対応パターン:
 *   NDL:      ○役職（氏名）　content  → speakerRole=役職,  speakerName=氏名
 *             ○氏名君　content        → speakerRole=null,   speakerName=氏名
 *   鹿児島:   ○氏名役職　content      → speakerRole=役職,  speakerName=氏名
 *             ◎氏名役職　content      → speakerRole=役職,  speakerName=氏名
 *             ◆氏名役職　content      → speakerRole=役職,  speakerName=氏名
 */
function parseSpeaker(text: string): {
  speakerName: string | null;
  speakerRole: string | null;
} {
  // 末尾のスペース/全角スペースは任意（dbsr.jp は ◯役職（氏名）content で空白なし）
  const match = text.match(/^[○◎◆]([^（　\s]+)(?:（([^）]+)）)?[　\s]?/);
  if (!match) return { speakerName: null, speakerRole: null };

  const nameAndRole = match[1] ?? "";
  const inParen = match[2];

  // NDL パターン: ○役職（氏名）
  if (inParen) {
    return {
      speakerRole: nameAndRole,
      speakerName: inParen.replace(/君$/, ""),
    };
  }

  // NDL パターン: ○氏名君
  if (nameAndRole.endsWith("君")) {
    return {
      speakerRole: null,
      speakerName: nameAndRole.replace(/君$/, ""),
    };
  }

  // 鹿児島パターン: 氏名 + 役職サフィックス
  for (const suffix of ROLE_SUFFIXES) {
    if (nameAndRole.endsWith(suffix) && nameAndRole.length > suffix.length) {
      return {
        speakerRole: suffix,
        speakerName: nameAndRole.slice(0, -suffix.length),
      };
    }
  }

  // サフィックス不明: 全体を氏名として扱う
  return {
    speakerRole: null,
    speakerName: nameAndRole,
  };
}

/**
 * status="pending" の meetings を statements に変換して保存する。
 * OPENAI_API_KEY が指定された場合は embedding も生成する。
 */
export async function processPendingMeetings(
  db: Db,
  openaiApiKey?: string
): Promise<void> {
  const pendingMeetings = await db
    .select()
    .from(meetings)
    .where(eq(meetings.status, "pending"))
    .limit(100);

  console.log(
    `[process-meetings] Found ${pendingMeetings.length} pending meeting(s)`
  );

  for (const meeting of pendingMeetings) {
    const rawText = meeting.rawText.trim();

    if (!rawText) {
      await db
        .update(meetings)
        .set({ status: "processed" })
        .where(eq(meetings.id, meeting.id));
      continue;
    }

    const parts = splitIntoStatements(rawText);
    let offset = 0;
    let hasError = false;

    for (const part of parts) {
      const contentHash = createHash("sha256").update(part).digest("hex");
      const startOffset = offset;
      const endOffset = offset + part.length;

      const { speakerName, speakerRole } = parseSpeaker(part);
      const content = stripSpeakerPrefix(part);
      const kind = classifyKind(speakerRole);

      try {
        await db
          .insert(statements)
          .values({
            meetingId: meeting.id,
            kind,
            speakerName,
            speakerRole,
            content,
            contentHash,
            startOffset,
            endOffset,
          })
          .onConflictDoNothing();
      } catch (err) {
        console.error(
          `[process-meetings] Failed to insert statement for meeting ${meeting.id}:`,
          err
        );
        hasError = true;
        break;
      }

      // 次の part の開始オフセットを更新（セパレータ "\n\n---\n\n" の9文字分を加算）
      offset = endOffset + 9;
    }

    if (hasError) continue;

    await db
      .update(meetings)
      .set({ status: "processed" })
      .where(eq(meetings.id, meeting.id));

    console.log(
      `[process-meetings] Processed meeting ${meeting.id} → ${parts.length} statement(s)`
    );

    // statement_chunks を構築（手続き系除外 + スピーカーグループ化）
    const { inserted: chunksInserted } = await buildChunksForMeeting(
      db,
      meeting.id,
      openaiApiKey
    );
    console.log(
      `[process-meetings] Built ${chunksInserted} chunk(s) for meeting ${meeting.id}`
    );
  }
}
