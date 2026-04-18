import { GoogleGenAI, Type } from "@google/genai";
import { eq, asc } from "drizzle-orm";
import type { Db } from "@open-gikai/db";
import { meetings, statements, type MeetingTopicDigest } from "@open-gikai/db/schema";
import { SYSTEM_PROMPT } from "./prompt";
import { callWithRetry } from "./retry";

export const DEFAULT_MODEL = "gemini-2.5-flash";

export type SummarizeResult = {
  summary: string;
  topicDigests: MeetingTopicDigest[];
  model: string;
  usage: {
    promptTokens: number;
    candidateTokens: number;
    thoughtsTokens: number;
    totalTokens: number;
  };
};

const RESPONSE_SCHEMA = {
  type: Type.OBJECT,
  properties: {
    summary: { type: Type.STRING },
    topic_digests: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          topic: { type: Type.STRING },
          relevance: { type: Type.STRING, enum: ["primary", "secondary"] },
          digest: { type: Type.STRING },
          speakers: { type: Type.ARRAY, items: { type: Type.STRING } },
        },
        required: ["topic", "relevance", "digest", "speakers"],
        propertyOrdering: ["topic", "relevance", "digest", "speakers"],
      },
    },
  },
  required: ["summary", "topic_digests"],
  propertyOrdering: ["summary", "topic_digests"],
} as const;

/**
 * 指定 meeting の全発言を 1 回の LLM 呼び出しでサマリ化する。
 * 戻り値を返すだけで DB 書き込みは呼び出し側の責務。
 */
export async function summarizeMeeting(
  db: Db,
  meetingId: string,
  client: GoogleGenAI,
  model: string = DEFAULT_MODEL,
): Promise<SummarizeResult> {
  const meeting = await db.query.meetings.findFirst({
    where: eq(meetings.id, meetingId),
  });
  if (!meeting) throw new Error(`meeting not found: ${meetingId}`);

  const stmts = await db.query.statements.findMany({
    where: eq(statements.meetingId, meetingId),
    orderBy: [asc(statements.startOffset)],
  });

  const transcript = stmts
    .map((s) => {
      const who = [s.speakerName, s.speakerRole].filter(Boolean).join(" / ") || "不明";
      return `[${s.kind}] ${who}: ${s.content}`;
    })
    .join("\n");

  const userMessage = `# 会議情報
- 自治体: ${meeting.municipalityCode}
- タイトル: ${meeting.title}
- 開催日: ${meeting.heldOn}
- 種別: ${meeting.meetingType}
- 発言数: ${stmts.length}

# 発言本文

${transcript}`;

  const response = await callWithRetry(() =>
    client.models.generateContent({
      model,
      contents: userMessage,
      config: {
        systemInstruction: SYSTEM_PROMPT,
        responseMimeType: "application/json",
        responseSchema: RESPONSE_SCHEMA,
        thinkingConfig: { thinkingBudget: -1 },
      },
    }),
  );

  const text = response.text;
  if (!text) throw new Error("Gemini returned empty response");

  const parsed = JSON.parse(text) as {
    summary: string;
    topic_digests: MeetingTopicDigest[];
  };

  const usage = response.usageMetadata;
  return {
    summary: parsed.summary,
    topicDigests: parsed.topic_digests,
    model,
    usage: {
      promptTokens: usage?.promptTokenCount ?? 0,
      candidateTokens: usage?.candidatesTokenCount ?? 0,
      thoughtsTokens: usage?.thoughtsTokenCount ?? 0,
      totalTokens: usage?.totalTokenCount ?? 0,
    },
  };
}
