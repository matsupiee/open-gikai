import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  estimateCostUsd,
  formatRunTimestamp,
  renderRunLogMarkdown,
  saveRunLog,
  type AgentRunLog,
} from "./run-log";

describe("formatRunTimestamp", () => {
  it("Date をゼロパディングした YYYYMMDD-HHMMSS に変換する", () => {
    const d = new Date(2026, 3, 1, 9, 5, 3);
    expect(formatRunTimestamp(d)).toBe("20260401-090503");
  });
});

describe("estimateCostUsd", () => {
  it("gemini-2.5-flash の料金を計算する", () => {
    const cost = estimateCostUsd("gemini-2.5-flash", 1_000_000, 1_000_000);
    expect(cost).toBeCloseTo(0.3 + 2.5, 10);
  });

  it("gemini-2.5-flash-lite の料金を計算する", () => {
    const cost = estimateCostUsd("gemini-2.5-flash-lite", 1_000_000, 1_000_000);
    expect(cost).toBeCloseTo(0.1 + 0.4, 10);
  });

  it("未知モデルは null を返す", () => {
    expect(estimateCostUsd("gpt-4", 100, 100)).toBe(null);
  });
});

describe("renderRunLogMarkdown", () => {
  it("tool call iteration と final answer を両方レンダリングする", () => {
    const md = renderRunLogMarkdown({
      startedAt: new Date("2026-04-18T00:00:00.000Z"),
      question: "市バス事業について調べて",
      preset: "default",
      model: "gemini-2.5-flash-lite",
      municipalityCode: "462012",
      iterations: [
        {
          kind: "tool_calls",
          index: 1,
          calls: [
            {
              name: "search_topics",
              args: { query: "市バス" },
              result: { rows: [{ meetingId: "m1", title: "本会議" }] },
            },
          ],
        },
        { kind: "final", index: 2, text: "## 回答\n- まとめ" },
      ],
      usage: { inputTokens: 1200, outputTokens: 300, totalApiCalls: 2 },
      endReason: "final",
    });

    expect(md).toContain("# Agent Run — 2026-04-18T00:00:00.000Z");
    expect(md).toContain("**Preset**: default");
    expect(md).toContain("**Municipality**: 462012");
    expect(md).toContain("## Question");
    expect(md).toContain("市バス事業について調べて");
    expect(md).toContain("## Iteration 1 — tool calls");
    expect(md).toContain("### search_topics");
    expect(md).toContain('"query": "市バス"');
    expect(md).toContain('"meetingId": "m1"');
    expect(md).toContain("## Iteration 2 — final answer");
    expect(md).toContain("## 回答");
    expect(md).toContain("- Input tokens: 1200");
    expect(md).toContain("- Output tokens: 300");
    expect(md).toContain("- API calls: 2");
    expect(md).toMatch(/\$0\.0[0-9]+/);
  });

  it("municipality 未指定・未知モデルでもレンダリングできる", () => {
    const md = renderRunLogMarkdown({
      startedAt: new Date("2026-04-18T00:00:00.000Z"),
      question: "test",
      preset: "compare",
      model: "unknown-model",
      iterations: [{ kind: "final", index: 1, text: "answer" }],
      usage: { inputTokens: 0, outputTokens: 0, totalApiCalls: 1 },
      endReason: "final",
    });
    expect(md).toContain("**Municipality**: (unspecified)");
    expect(md).toContain("Estimated cost: n/a");
  });

  it("エラー終了時はエラーメッセージを含める", () => {
    const md = renderRunLogMarkdown({
      startedAt: new Date("2026-04-18T00:00:00.000Z"),
      question: "test",
      preset: "default",
      model: "gemini-2.5-flash-lite",
      iterations: [],
      usage: { inputTokens: 0, outputTokens: 0, totalApiCalls: 0 },
      endReason: "error",
      errorMessage: "rate limit exceeded",
    });
    expect(md).toContain("**End reason**: error");
    expect(md).toContain("**Error**: rate limit exceeded");
  });
});

describe("saveRunLog", () => {
  let tempDir: string;

  beforeEach(async () => {
    tempDir = await mkdtemp(join(tmpdir(), "run-log-test-"));
  });

  afterEach(async () => {
    await rm(tempDir, { recursive: true, force: true });
  });

  it("親ディレクトリが無くても作成する", async () => {
    const filePath = join(tempDir, "nested/dir/run.md");
    const log: AgentRunLog = {
      startedAt: new Date("2026-04-18T00:00:00.000Z"),
      question: "q",
      preset: "default",
      model: "gemini-2.5-flash-lite",
      iterations: [{ kind: "final", index: 1, text: "a" }],
      usage: { inputTokens: 0, outputTokens: 0, totalApiCalls: 1 },
      endReason: "final",
    };
    await saveRunLog(filePath, log);
    const content = await readFile(filePath, "utf-8");
    expect(content).toContain("# Agent Run");
    expect(content).toContain("## Question");
  });
});
