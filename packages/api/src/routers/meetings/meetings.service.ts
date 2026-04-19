import type { Db } from "@open-gikai/db";
import { meetings, municipalities } from "@open-gikai/db/schema";
import { GoogleGenAI, type Content, type FunctionCall, type Tool } from "@google/genai";
import { ORPCError } from "@orpc/server";
import { and, desc, eq, gte, inArray, like, lte, lt } from "drizzle-orm";
import { z } from "zod";

import { callWithRetry } from "../../shared/retry";
import { findMeetingsWithTopics, getMeetingDigest, searchTopics } from "../topics/topics.service";
import type { meetingsListSchema, meetingsAskSchema } from "./_schemas";

export interface MeetingListItem {
  id: string;
  title: string;
  heldOn: string;
  prefecture: string;
  municipality: string;
}

export interface MeetingsListResponse {
  meetings: MeetingListItem[];
  nextCursor: string | null;
}

function queryMeetings(db: Db, input: z.input<typeof meetingsListSchema>, limit: number) {
  const conditions = [];

  if (input.heldOnFrom) conditions.push(gte(meetings.heldOn, input.heldOnFrom));
  if (input.heldOnTo) conditions.push(lte(meetings.heldOn, input.heldOnTo));
  if (input.prefecture) conditions.push(eq(municipalities.prefecture, input.prefecture));
  if (input.municipality) {
    const tokens = input.municipality.trim().split(/\s+/).filter(Boolean);
    for (const token of tokens) {
      conditions.push(like(municipalities.name, `%${token}%`));
    }
  }
  if (input.municipalityCodes && input.municipalityCodes.length > 0) {
    conditions.push(inArray(meetings.municipalityCode, input.municipalityCodes));
  }
  if (input.title) conditions.push(like(meetings.title, `%${input.title}%`));
  if (input.cursor) conditions.push(lt(meetings.id, input.cursor));

  const query = db
    .select({
      id: meetings.id,
      title: meetings.title,
      heldOn: meetings.heldOn,
      prefecture: municipalities.prefecture,
      municipality: municipalities.name,
    })
    .from(meetings)
    .innerJoin(municipalities, eq(meetings.municipalityCode, municipalities.code));

  const finalQuery = conditions.length > 0 ? query.where(and(...conditions)) : query;

  return finalQuery.orderBy(desc(meetings.heldOn), desc(meetings.id)).limit(limit);
}

export async function listMeetings(
  db: Db,
  input: z.input<typeof meetingsListSchema>,
): Promise<MeetingsListResponse> {
  const limit = input.limit ?? 20;
  const results = await queryMeetings(db, input, limit + 1);

  const hasMore = results.length > limit;
  const meetingsList = hasMore ? results.slice(0, limit) : results;

  return {
    meetings: meetingsList as MeetingListItem[],
    nextCursor: hasMore ? meetingsList[meetingsList.length - 1]!.id : null,
  };
}

const MAX_ASK_ITERATIONS = 15;

const ASK_SYSTEM_PROMPT = `あなたは地方議会の議事録サマリを検索し、ユーザーの質問に時系列で整理した議論の流れを提示するアシスタントです。

# 使えるツール

- \`search_topics(query, municipality_code?, date_from?, date_to?)\`: 議題名・ダイジェスト本文・会議サマリのいずれかに \`query\` が含まれる会議を、新しい順に返す
- \`get_meeting_digest(meeting_id)\`: 特定の会議のサマリと全 topic_digests を取得する
- \`find_meetings_with_topics(topics, municipality_code?)\`: 複数の議題すべてを扱っている会議を返す（関連分析用）

# 手順

1. ユーザーの質問から検索キーワードを抽出し、\`search_topics\` で関連会議を探す
2. 関連度が高そうな会議について \`get_meeting_digest\` で詳細を取得し、該当 topic の digest を確認する
3. 複数議題の関連を問う質問なら \`find_meetings_with_topics\` を使う
4. 集めた情報を **時系列（古い→新しい）** に整理し、以下のフォーマットで回答する:

   ## 〇〇について

   ### 議論の流れ（〜年）
   - 〇〇年〇月: [会議名] で △△議員が〜と質問し、当局は〜と回答
   - ...

   ### 主なポイント
   - ...

   ### 関連議題（あれば）
   - ...

# ルール

- 必ずツールで取得した情報のみに基づいて回答する。推測や一般論で埋めない
- 日付・数字・固有名詞は省略せず引用する
- 情報が見つからない場合は「該当する議事録サマリは見つかりませんでした」と率直に回答する
- ツールを最大 ${MAX_ASK_ITERATIONS - 1} 回まで呼べる。無駄な呼び出しは避ける`;

const ASK_TOOLS: Tool[] = [
  {
    functionDeclarations: [
      {
        name: "search_topics",
        description:
          "議題名・ダイジェスト本文・会議全体サマリのいずれかにクエリが含まれる会議を新しい順で返す。",
        parametersJsonSchema: {
          type: "object",
          properties: {
            query: {
              type: "string",
              description: "検索キーワード（日本語）。部分一致で検索される",
            },
            municipality_code: {
              type: "string",
              description: "自治体コード（例: 462012 = 鹿児島市）。絞り込みたい場合に指定",
            },
            date_from: {
              type: "string",
              description: "開催日の下限 (YYYY-MM-DD)",
            },
            date_to: {
              type: "string",
              description: "開催日の上限 (YYYY-MM-DD)",
            },
            limit: {
              type: "integer",
              description: "返却件数上限（デフォルト 30）",
            },
          },
          required: ["query"],
        },
      },
      {
        name: "get_meeting_digest",
        description: "特定の会議の全サマリ情報（summary + topic_digests 配列）を取得する。",
        parametersJsonSchema: {
          type: "object",
          properties: {
            meeting_id: { type: "string" },
          },
          required: ["meeting_id"],
        },
      },
      {
        name: "find_meetings_with_topics",
        description: "複数の議題すべてを同じ会議内で扱っている会議を返す。関連性の分析に使う。",
        parametersJsonSchema: {
          type: "object",
          properties: {
            topics: {
              type: "array",
              items: { type: "string" },
              description: "すべてにマッチすることを要求するキーワードの配列（2〜3 個推奨）",
            },
            municipality_code: { type: "string" },
            limit: { type: "integer" },
          },
          required: ["topics"],
        },
      },
    ],
  },
];

export interface AskMeetingsTraceEntry {
  tool: string;
  args: unknown;
  resultSummary: string;
}

export interface AskMeetingsResponse {
  answer: string;
  iterations: number;
  inputTokens: number;
  outputTokens: number;
  trace: AskMeetingsTraceEntry[];
}

export type AskMeetingsStreamEvent =
  | {
      type: "iteration_start";
      iteration: number;
    }
  | {
      type: "tool_call";
      iteration: number;
      tool: string;
      args: unknown;
    }
  | {
      type: "tool_result";
      iteration: number;
      tool: string;
      resultSummary: string;
    }
  | {
      type: "final_delta";
      text: string;
    }
  | {
      type: "done";
      result: AskMeetingsResponse;
    };

export async function askMeetings(
  db: Db,
  input: z.input<typeof meetingsAskSchema>,
): Promise<AskMeetingsResponse> {
  // ストリーム実装を最後まで駆動し最終結果だけ返す（非ストリームの互換維持用）
  let finalResult: AskMeetingsResponse | null = null;
  for await (const event of askMeetingsStream(db, input)) {
    if (event.type === "done") {
      finalResult = event.result;
    }
  }
  if (!finalResult) {
    throw new ORPCError("INTERNAL_SERVER_ERROR", {
      message: "askMeetingsStream did not yield a done event",
    });
  }
  return finalResult;
}

export async function* askMeetingsStream(
  db: Db,
  input: z.input<typeof meetingsAskSchema>,
): AsyncGenerator<AskMeetingsStreamEvent, void, unknown> {
  const apiKey = process.env.GEMINI_API_KEY ?? process.env.GOOGLE_API_KEY;
  if (!apiKey) {
    throw new ORPCError("INTERNAL_SERVER_ERROR", {
      message: "GEMINI_API_KEY is not configured",
    });
  }

  const model = input.model ?? "gemini-2.5-flash-lite";
  const client = new GoogleGenAI({ apiKey });

  const contextHint = input.municipalityCode
    ? `(検索対象の自治体コードは ${input.municipalityCode} です。search_topics / find_meetings_with_topics にはこの municipality_code を渡してください)`
    : "";

  const history: Content[] = [
    {
      role: "user",
      parts: [{ text: `${input.question}\n\n${contextHint}`.trim() }],
    },
  ];

  const trace: AskMeetingsTraceEntry[] = [];
  let totalInputTokens = 0;
  let totalOutputTokens = 0;

  for (let iter = 0; iter < MAX_ASK_ITERATIONS; iter++) {
    yield { type: "iteration_start", iteration: iter + 1 };

    const response = await callWithRetry(() =>
      client.models.generateContent({
        model,
        contents: history,
        config: {
          systemInstruction: ASK_SYSTEM_PROMPT,
          tools: ASK_TOOLS,
        },
      }),
    );

    totalInputTokens += response.usageMetadata?.promptTokenCount ?? 0;
    totalOutputTokens += response.usageMetadata?.candidatesTokenCount ?? 0;

    const parts = response.candidates?.[0]?.content?.parts ?? [];
    history.push({ role: "model", parts });

    const functionCalls = parts
      .map((p) => p.functionCall)
      .filter((fc): fc is FunctionCall => Boolean(fc));

    if (functionCalls.length === 0) {
      const finalText = parts
        .map((p) => p.text)
        .filter((t): t is string => Boolean(t))
        .join("");

      if (finalText) {
        yield { type: "final_delta", text: finalText };
      }

      const result: AskMeetingsResponse = {
        answer: finalText,
        iterations: iter + 1,
        inputTokens: totalInputTokens,
        outputTokens: totalOutputTokens,
        trace,
      };
      yield { type: "done", result };
      return;
    }

    const functionResponses = [];
    for (const call of functionCalls) {
      const toolName = call.name ?? "unknown";
      yield {
        type: "tool_call",
        iteration: iter + 1,
        tool: toolName,
        args: call.args ?? {},
      };

      const result = await executeAskFunction(db, input.municipalityCode, call);
      const resultSummary = summarizeAskResult(result);
      trace.push({
        tool: toolName,
        args: call.args ?? {},
        resultSummary,
      });
      yield {
        type: "tool_result",
        iteration: iter + 1,
        tool: toolName,
        resultSummary,
      };

      functionResponses.push({
        functionResponse: {
          name: call.name,
          response: result as Record<string, unknown>,
        },
      });
    }
    history.push({ role: "user", parts: functionResponses });
  }

  const result: AskMeetingsResponse = {
    answer: "",
    iterations: MAX_ASK_ITERATIONS,
    inputTokens: totalInputTokens,
    outputTokens: totalOutputTokens,
    trace,
  };
  yield { type: "done", result };
}

async function executeAskFunction(
  db: Db,
  defaultMunicipality: string | undefined,
  call: FunctionCall,
): Promise<unknown> {
  const a = (call.args ?? {}) as Record<string, unknown>;
  try {
    switch (call.name) {
      case "search_topics":
        return {
          rows: await searchTopics(db, {
            query: String(a.query ?? ""),
            municipalityCode: (a.municipality_code as string | undefined) ?? defaultMunicipality,
            dateFrom: a.date_from as string | undefined,
            dateTo: a.date_to as string | undefined,
            limit: a.limit as number | undefined,
          }),
        };
      case "get_meeting_digest": {
        const digest = await getMeetingDigest(db, String(a.meeting_id));
        return digest ?? { error: "not found" };
      }
      case "find_meetings_with_topics":
        return {
          rows: await findMeetingsWithTopics(db, {
            topics: (a.topics as string[]) ?? [],
            municipalityCode: (a.municipality_code as string | undefined) ?? defaultMunicipality,
            limit: a.limit as number | undefined,
          }),
        };
      default:
        return { error: `unknown function: ${call.name}` };
    }
  } catch (err) {
    return { error: err instanceof Error ? err.message : String(err) };
  }
}

function summarizeAskResult(result: unknown): string {
  if (typeof result !== "object" || result === null) return String(result);
  const r = result as Record<string, unknown>;
  if (Array.isArray(r.rows)) return `rows=${r.rows.length}`;
  if (r.error) return `error: ${String(r.error)}`;
  if (r.meetingId)
    return `meeting=${r.title ?? ""} (${r.heldOn ?? ""}) topics=${
      Array.isArray(r.topicDigests) ? r.topicDigests.length : 0
    }`;
  return JSON.stringify(r).slice(0, 120);
}
