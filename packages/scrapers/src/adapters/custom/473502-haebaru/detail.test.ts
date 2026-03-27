import { describe, expect, it } from "vitest";
import { classifyKind, parseSpeaker, parseStatements } from "./detail";

describe("parseSpeaker", () => {
  it("議長の発言ヘッダーを解析する", () => {
    expect(
      parseSpeaker("○議長 赤嶺奈津江さん これから本日の会議を開きます。")
    ).toEqual({
      speakerName: "赤嶺奈津江",
      speakerRole: "議長",
      content: "これから本日の会議を開きます。",
    });
  });

  it("番号付き議員の発言ヘッダーを解析する", () => {
    expect(
      parseSpeaker("○16番 赤嶺奈津江さん 皆さん、おはようございます。")
    ).toEqual({
      speakerName: "赤嶺奈津江",
      speakerRole: "議員",
      content: "皆さん、おはようございます。",
    });
  });

  it("課長答弁の発言ヘッダーを解析する", () => {
    expect(
      parseSpeaker("○まちづくり振興課長 野原義幸君 ただいまの質問にお答えします。")
    ).toEqual({
      speakerName: "野原義幸",
      speakerRole: "課長",
      content: "ただいまの質問にお答えします。",
    });
  });
});

describe("classifyKind", () => {
  it("役職から発言種別を分類する", () => {
    expect(classifyKind("議長")).toBe("remark");
    expect(classifyKind("議員")).toBe("question");
    expect(classifyKind("副町長")).toBe("answer");
    expect(classifyKind("課長")).toBe("answer");
    expect(classifyKind(null)).toBe("remark");
  });
});

describe("parseStatements", () => {
  it("発言マーカーごとに statements を組み立てる", () => {
    const text = `
○議長 赤嶺奈津江さん これから本日の会議を開きます。
○16番 赤嶺奈津江さん 皆さん、おはようございます。〔赤嶺奈津江議員 登壇〕
○副町長 新垣吉紀君 おはようございます。
    `;

    const statements = parseStatements(text);

    expect(statements).toHaveLength(3);
    expect(statements[0]?.kind).toBe("remark");
    expect(statements[0]?.speakerRole).toBe("議長");
    expect(statements[1]?.kind).toBe("question");
    expect(statements[1]?.speakerRole).toBe("議員");
    expect(statements[1]?.content).toBe("皆さん、おはようございます。");
    expect(statements[2]?.kind).toBe("answer");
    expect(statements[2]?.speakerRole).toBe("副町長");
    expect(statements[2]?.contentHash).toMatch(/^[a-f0-9]{64}$/);
  });

  it("空の content はスキップする", () => {
    const text = `
○16番 赤嶺奈津江さん 〔赤嶺奈津江議員 登壇〕
○副町長 新垣吉紀君 おはようございます。
    `;

    const statements = parseStatements(text);

    expect(statements).toHaveLength(1);
    expect(statements[0]?.speakerRole).toBe("副町長");
    expect(statements[0]?.startOffset).toBe(0);
  });
});
