import { describe, expect, it } from "vitest";
import {
  AGENT_PRESET_NAMES,
  getAgentSystemPrompt,
  isAgentPresetName,
} from "./agent-presets";

describe("getAgentSystemPrompt", () => {
  it("全プリセットで maxToolCalls を本文に埋め込む", () => {
    for (const preset of AGENT_PRESET_NAMES) {
      const prompt = getAgentSystemPrompt(preset, { maxToolCalls: 14 });
      expect(prompt).toContain("ツールを最大 14 回まで呼べる");
    }
  });

  it("default プリセットには時系列整理のフォーマット指示が入る", () => {
    const prompt = getAgentSystemPrompt("default", { maxToolCalls: 5 });
    expect(prompt).toContain("議論の流れ");
    expect(prompt).toContain("時系列");
  });

  it("member プリセットには議員視点の指示が入る", () => {
    const prompt = getAgentSystemPrompt("member", { maxToolCalls: 5 });
    expect(prompt).toContain("議員");
    expect(prompt).toContain("トピックごとの発言の変遷");
  });

  it("policy プリセットには政策変遷のフェーズ指示が入る", () => {
    const prompt = getAgentSystemPrompt("policy", { maxToolCalls: 5 });
    expect(prompt).toContain("フェーズ");
    expect(prompt).toContain("政策");
  });

  it("compare プリセットには find_meetings_with_topics の使用推奨が入る", () => {
    const prompt = getAgentSystemPrompt("compare", { maxToolCalls: 5 });
    expect(prompt).toContain("find_meetings_with_topics");
    expect(prompt).toContain("同時に扱っている会議");
  });
});

describe("isAgentPresetName", () => {
  it("既知のプリセット名を受理する", () => {
    expect(isAgentPresetName("default")).toBe(true);
    expect(isAgentPresetName("member")).toBe(true);
    expect(isAgentPresetName("policy")).toBe(true);
    expect(isAgentPresetName("compare")).toBe(true);
  });

  it("未知のプリセット名を拒否する", () => {
    expect(isAgentPresetName("unknown")).toBe(false);
    expect(isAgentPresetName("")).toBe(false);
  });
});
