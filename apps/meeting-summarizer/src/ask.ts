/**
 * 議事録サマリに対する質問応答エージェント（PoC）。
 *
 * 使い方:
 *   bun run src/ask.ts -- --municipality 462012 "市バス事業について調べて"
 *   bun run src/ask.ts -- --municipality 462012 --preset policy "市バス路線再編の変遷"
 *   bun run src/ask.ts -- --municipality 462012 --preset member "〇〇議員の追及してきた議題"
 *   bun run src/ask.ts -- --municipality 462012 --no-save "一時的な質問"
 *
 * --preset: default | member | policy | compare
 * --save / --no-save: 実行ログを runs/YYYYMMDD-HHMMSS.md に保存するか（デフォルト: --save）
 */

import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";
import {
  GoogleGenAI,
  type Content,
  type FunctionCall,
  type Tool,
} from "@google/genai";
import { createDb, type Db } from "@open-gikai/db";
import {
  AGENT_PRESET_NAMES,
  getAgentSystemPrompt,
  isAgentPresetName,
  type AgentPresetName,
} from "./agent-presets";
import { callWithRetry } from "./retry";
import {
  buildToolCallIteration,
  formatRunTimestamp,
  saveRunLog,
  type AgentIteration,
  type AgentRunLog,
} from "./run-log";
import { findMeetingsWithTopics, getMeetingDigest, searchTopics } from "./tools";

const root = resolve(fileURLToPath(import.meta.url), "../../../../");
dotenv.config({ path: resolve(root, ".env.local"), override: true });

const DEFAULT_MODEL = "gemini-2.5-flash-lite";
const DEFAULT_PRESET: AgentPresetName = "default";
const MAX_ITERATIONS = 15;

const TOOLS: Tool[] = [
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
        description:
          "複数の議題すべてを同じ会議内で扱っている会議を返す。関連性の分析に使う。",
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

async function main() {
  const args = parseArgs(process.argv.slice(2));

  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) throw new Error("DATABASE_URL is not set");
  const apiKey = process.env.GEMINI_API_KEY ?? process.env.GOOGLE_API_KEY;
  if (!apiKey) throw new Error("GEMINI_API_KEY (or GOOGLE_API_KEY) is not set");

  const db = createDb(databaseUrl);
  const client = new GoogleGenAI({ apiKey });

  const startedAt = new Date();
  const systemPrompt = getAgentSystemPrompt(args.preset, {
    maxToolCalls: MAX_ITERATIONS - 1,
  });

  console.error(
    `[ask] preset=${args.preset} model=${args.model} municipality=${args.municipalityCode ?? "any"}`,
  );
  console.error(`[ask] question: ${args.question}`);
  console.error("");

  const contextHint = args.municipalityCode
    ? `(検索対象の自治体コードは ${args.municipalityCode} です。search_topics / find_meetings_with_topics にはこの municipality_code を渡してください)`
    : "";

  const history: Content[] = [
    {
      role: "user",
      parts: [{ text: `${args.question}\n\n${contextHint}`.trim() }],
    },
  ];

  const iterations: AgentIteration[] = [];
  let totalInputTokens = 0;
  let totalOutputTokens = 0;
  let totalApiCalls = 0;
  let endReason: AgentRunLog["endReason"] = "max_iterations";
  let errorMessage: string | undefined;
  let finalText: string | undefined;

  try {
    for (let iter = 0; iter < MAX_ITERATIONS; iter++) {
      const response = await callWithRetry(() =>
        client.models.generateContent({
          model: args.model,
          contents: history,
          config: {
            systemInstruction: systemPrompt,
            tools: TOOLS,
          },
        }),
      );
      totalApiCalls++;
      totalInputTokens += response.usageMetadata?.promptTokenCount ?? 0;
      totalOutputTokens += response.usageMetadata?.candidatesTokenCount ?? 0;

      const parts = response.candidates?.[0]?.content?.parts ?? [];
      history.push({ role: "model", parts });

      const functionCalls = parts
        .map((p) => p.functionCall)
        .filter((fc): fc is FunctionCall => Boolean(fc));

      if (functionCalls.length === 0) {
        finalText = parts
          .map((p) => p.text)
          .filter((t): t is string => Boolean(t))
          .join("");
        iterations.push({ kind: "final", index: iter + 1, text: finalText });
        endReason = "final";
        console.log(finalText);
        console.error("");
        console.error(
          `[ask] iterations=${iter + 1} in=${totalInputTokens} out=${totalOutputTokens}`,
        );
        break;
      }

      const results: unknown[] = [];
      const functionResponses = [];
      for (const call of functionCalls) {
        console.error(`[ask] → ${call.name}(${JSON.stringify(call.args)})`);
        const result = await executeFunction(db, args.municipalityCode, call);
        console.error(`[ask] ← ${summarizeResult(result)}`);
        results.push(result);
        functionResponses.push({
          functionResponse: {
            name: call.name,
            response: result as Record<string, unknown>,
          },
        });
      }
      iterations.push(buildToolCallIteration(iter + 1, functionCalls, results));
      history.push({ role: "user", parts: functionResponses });
    }

    if (endReason === "max_iterations") {
      console.error(`[ask] iteration cap (${MAX_ITERATIONS}) reached without final answer`);
    }
  } catch (err) {
    endReason = "error";
    errorMessage = err instanceof Error ? err.message : String(err);
    console.error(`[ask] error: ${errorMessage}`);
  } finally {
    if (args.save) {
      const runPath = resolve(
        root,
        "apps/meeting-summarizer/runs",
        `${formatRunTimestamp(startedAt)}.md`,
      );
      const log: AgentRunLog = {
        startedAt,
        question: args.question,
        preset: args.preset,
        model: args.model,
        municipalityCode: args.municipalityCode,
        iterations,
        usage: {
          inputTokens: totalInputTokens,
          outputTokens: totalOutputTokens,
          totalApiCalls,
        },
        endReason,
        errorMessage,
      };
      await saveRunLog(runPath, log);
      console.error(`[ask] saved run log: ${runPath}`);
    }
  }

  if (endReason === "error") process.exit(1);
}

async function executeFunction(
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
            municipalityCode:
              (a.municipality_code as string | undefined) ?? defaultMunicipality,
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
            municipalityCode:
              (a.municipality_code as string | undefined) ?? defaultMunicipality,
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

function summarizeResult(result: unknown): string {
  if (typeof result !== "object" || result === null) return String(result);
  const r = result as Record<string, unknown>;
  if (Array.isArray(r.rows)) return `rows=${r.rows.length}`;
  if (r.error) return `error: ${String(r.error)}`;
  if (r.meetingId) return `meeting=${r.title ?? ""} (${r.heldOn ?? ""}) topics=${Array.isArray(r.topicDigests) ? r.topicDigests.length : 0}`;
  return JSON.stringify(r).slice(0, 120);
}

type ParsedArgs = {
  question: string;
  municipalityCode?: string;
  model: string;
  preset: AgentPresetName;
  save: boolean;
};

function parseArgs(argv: string[]): ParsedArgs {
  let municipality: string | undefined;
  let model = DEFAULT_MODEL;
  let preset: AgentPresetName = DEFAULT_PRESET;
  let save = true;
  const rest: string[] = [];
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--municipality") municipality = argv[++i];
    else if (a === "--model") model = argv[++i]!;
    else if (a === "--preset") {
      const value = argv[++i];
      if (!value || !isAgentPresetName(value)) {
        throw new Error(
          `--preset must be one of: ${AGENT_PRESET_NAMES.join(", ")} (got: ${value ?? "(empty)"})`,
        );
      }
      preset = value;
    } else if (a === "--save") save = true;
    else if (a === "--no-save") save = false;
    else rest.push(a!);
  }
  const question = rest.join(" ").trim();
  if (!question) throw new Error("question is required (pass as positional arg)");
  return { question, municipalityCode: municipality, model, preset, save };
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
