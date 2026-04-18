/**
 * ask.ts の 1 回の実行を Markdown ファイルとして永続化する。
 *
 * フィードバックループ（プロンプト調整、ツール呼び出し分析、コスト把握）のため、
 * 質問・各イテレーションのツール呼び出しと結果・最終応答・トークン使用量を記録する。
 */

import { mkdir, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import type { FunctionCall } from "@google/genai";
import type { AgentPresetName } from "./agent-presets";

export type AgentIteration =
  | {
      kind: "tool_calls";
      index: number;
      calls: Array<{ name: string; args: unknown; result: unknown }>;
    }
  | {
      kind: "final";
      index: number;
      text: string;
    };

export type AgentRunLog = {
  startedAt: Date;
  question: string;
  preset: AgentPresetName;
  model: string;
  municipalityCode?: string;
  iterations: AgentIteration[];
  usage: {
    inputTokens: number;
    outputTokens: number;
    totalApiCalls: number;
  };
  /** 終了理由。final = 通常終了 / max_iterations = 打ち切り / error = 例外 */
  endReason: "final" | "max_iterations" | "error";
  errorMessage?: string;
};

/**
 * モデルごとの料金（USD per 1M tokens）。2026-04 時点。
 * 不明モデルは null を返す。
 */
function pricingFor(model: string): { input: number; output: number } | null {
  if (model === "gemini-2.5-flash-lite") return { input: 0.1, output: 0.4 };
  if (model === "gemini-2.5-flash") return { input: 0.3, output: 2.5 };
  return null;
}

export function estimateCostUsd(
  model: string,
  inputTokens: number,
  outputTokens: number,
): number | null {
  const p = pricingFor(model);
  if (!p) return null;
  return (inputTokens / 1_000_000) * p.input + (outputTokens / 1_000_000) * p.output;
}

/** YYYYMMDD-HHMMSS (ローカルタイム) */
export function formatRunTimestamp(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  const y = d.getFullYear();
  const m = pad(d.getMonth() + 1);
  const day = pad(d.getDate());
  const h = pad(d.getHours());
  const min = pad(d.getMinutes());
  const s = pad(d.getSeconds());
  return `${y}${m}${day}-${h}${min}${s}`;
}

function jsonBlock(value: unknown): string {
  return ["```json", JSON.stringify(value, null, 2), "```"].join("\n");
}

export function renderRunLogMarkdown(log: AgentRunLog): string {
  const lines: string[] = [];
  lines.push(`# Agent Run — ${log.startedAt.toISOString()}`);
  lines.push("");
  lines.push(`- **Preset**: ${log.preset}`);
  lines.push(`- **Model**: ${log.model}`);
  lines.push(`- **Municipality**: ${log.municipalityCode ?? "(unspecified)"}`);
  lines.push(`- **End reason**: ${log.endReason}`);
  if (log.errorMessage) lines.push(`- **Error**: ${log.errorMessage}`);
  lines.push("");
  lines.push("## Question");
  lines.push("");
  lines.push(log.question);
  lines.push("");

  for (const it of log.iterations) {
    if (it.kind === "tool_calls") {
      lines.push(`## Iteration ${it.index} — tool calls`);
      lines.push("");
      for (const call of it.calls) {
        lines.push(`### ${call.name}`);
        lines.push("");
        lines.push("**Args**");
        lines.push("");
        lines.push(jsonBlock(call.args));
        lines.push("");
        lines.push("**Result**");
        lines.push("");
        lines.push(jsonBlock(call.result));
        lines.push("");
      }
    } else {
      lines.push(`## Iteration ${it.index} — final answer`);
      lines.push("");
      lines.push(it.text);
      lines.push("");
    }
  }

  lines.push("## Usage");
  lines.push("");
  lines.push(`- Input tokens: ${log.usage.inputTokens}`);
  lines.push(`- Output tokens: ${log.usage.outputTokens}`);
  lines.push(`- API calls: ${log.usage.totalApiCalls}`);
  const cost = estimateCostUsd(log.model, log.usage.inputTokens, log.usage.outputTokens);
  if (cost !== null) {
    lines.push(`- Estimated cost: $${cost.toFixed(6)} (${log.model} pricing, 2026-04)`);
  } else {
    lines.push(`- Estimated cost: n/a (unknown pricing for ${log.model})`);
  }
  lines.push("");

  return lines.join("\n");
}

export async function saveRunLog(filePath: string, log: AgentRunLog): Promise<void> {
  await mkdir(dirname(filePath), { recursive: true });
  await writeFile(filePath, renderRunLogMarkdown(log), "utf-8");
}

/** エージェントが返した function call の生データを iteration として記録用に整形する。 */
export function buildToolCallIteration(
  index: number,
  calls: FunctionCall[],
  results: unknown[],
): AgentIteration {
  return {
    kind: "tool_calls",
    index,
    calls: calls.map((c, i) => ({
      name: c.name ?? "(unnamed)",
      args: c.args ?? {},
      result: results[i],
    })),
  };
}
