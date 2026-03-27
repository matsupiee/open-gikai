import { describe, expect, it } from "vitest";
import { classifyKind, parseSpeaker, parseStatements } from "./detail";

describe("parseSpeaker", () => {
  it("議長を解析する", () => {
    const result = parseSpeaker(
      "○議長（塩田 文男君） 皆さん、おはようございます。",
    );

    expect(result.speakerName).toBe("塩田文男");
    expect(result.speakerRole).toBe("議長");
    expect(result.content).toBe("皆さん、おはようございます。");
  });

  it("議員ロール + 番号付き氏名を解析する", () => {
    const result = parseSpeaker(
      "○議員（２番 江本 守君） ２番、厚生文教常任委員会、江本守です。",
    );

    expect(result.speakerName).toBe("江本守");
    expect(result.speakerRole).toBe("議員");
    expect(result.content).toBe("２番、厚生文教常任委員会、江本守です。");
  });

  it("番号議員を解析する", () => {
    const result = parseSpeaker("○２番（江本 守君） 質問します。");

    expect(result.speakerName).toBe("江本守");
    expect(result.speakerRole).toBe("議員");
    expect(result.content).toBe("質問します。");
  });

  it("課長を解析する", () => {
    const result = parseSpeaker(
      "○総務課長（椎野 満博君） お答えいたします。",
    );

    expect(result.speakerName).toBe("椎野満博");
    expect(result.speakerRole).toBe("課長");
    expect(result.content).toBe("お答えいたします。");
  });
});

describe("classifyKind", () => {
  it("議長は remark", () => {
    expect(classifyKind("議長")).toBe("remark");
  });

  it("町長は answer", () => {
    expect(classifyKind("町長")).toBe("answer");
  });

  it("課長は answer", () => {
    expect(classifyKind("課長")).toBe("answer");
  });

  it("議員は question", () => {
    expect(classifyKind("議員")).toBe("question");
  });
});

describe("parseStatements", () => {
  it("○ マーカーで発言を分割する", () => {
    const text = `
○議長（塩田 文男君） 皆さん、おはようございます。
○議員（２番 江本 守君） 質問します。
○町長（新川 久三君） お答えします。
    `;

    const statements = parseStatements(text);

    expect(statements).toHaveLength(3);
    expect(statements[0]!.kind).toBe("remark");
    expect(statements[0]!.speakerName).toBe("塩田文男");
    expect(statements[1]!.kind).toBe("question");
    expect(statements[1]!.speakerName).toBe("江本守");
    expect(statements[2]!.kind).toBe("answer");
    expect(statements[2]!.speakerName).toBe("新川久三");
  });

  it("ト書きをスキップする", () => {
    const text = `
○議長（塩田 文男君） ただいまから会議を開きます。
○（２番 江本 守君登壇）
○議員（２番 江本 守君） 質問します。
    `;

    const statements = parseStatements(text);

    expect(statements).toHaveLength(2);
    expect(statements[0]!.speakerRole).toBe("議長");
    expect(statements[1]!.speakerRole).toBe("議員");
  });

  it("contentHash と offset を設定する", () => {
    const statements = parseStatements("○議長（塩田 文男君） テスト発言。");

    expect(statements[0]!.contentHash).toMatch(/^[a-f0-9]{64}$/);
    expect(statements[0]!.startOffset).toBe(0);
    expect(statements[0]!.endOffset).toBe("テスト発言。".length);
  });
});
