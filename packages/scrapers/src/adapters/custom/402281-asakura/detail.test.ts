import { describe, expect, it } from "vitest";
import { classifyKind, parseSpeaker, parseStatements } from "./detail";

describe("parseSpeaker", () => {
  it("議長パターンを解析する", () => {
    const result = parseSpeaker(
      "○議長（山田太郎君）　ただいまから本日の会議を開きます。",
    );

    expect(result).toEqual({
      speakerName: "山田太郎",
      speakerRole: "議長",
      content: "ただいまから本日の会議を開きます。",
    });
  });

  it("番号議員パターンを議員として解析する", () => {
    const result = parseSpeaker(
      "○５番（田中花子君）　質問いたします。",
    );

    expect(result).toEqual({
      speakerName: "田中花子",
      speakerRole: "議員",
      content: "質問いたします。",
    });
  });

  it("副委員長を委員長に誤マッチさせない", () => {
    const result = parseSpeaker(
      "○副委員長（佐藤次郎君）　報告いたします。",
    );

    expect(result.speakerRole).toBe("副委員長");
  });

  it("臨時議長を議長として扱う", () => {
    const result = parseSpeaker(
      "○臨時議長（中村三郎君）　ただいまから開会いたします。",
    );

    expect(result.speakerRole).toBe("議長");
  });
});

describe("classifyKind", () => {
  it("議長は remark", () => {
    expect(classifyKind("議長")).toBe("remark");
  });

  it("副委員長は remark", () => {
    expect(classifyKind("副委員長")).toBe("remark");
  });

  it("市長は answer", () => {
    expect(classifyKind("市長")).toBe("answer");
  });

  it("課長は answer", () => {
    expect(classifyKind("課長")).toBe("answer");
  });

  it("議員は question", () => {
    expect(classifyKind("議員")).toBe("question");
  });
});

describe("parseStatements", () => {
  it("丸マーカーで発言を分割する", () => {
    const text = `
○議長（山田太郎君）　ただいまから本日の会議を開きます。
○５番（田中花子君）　質問いたします。
○市長（佐藤次郎君）　お答えいたします。
`;

    const result = parseStatements(text);

    expect(result).toHaveLength(3);
    expect(result[0]?.kind).toBe("remark");
    expect(result[1]?.kind).toBe("question");
    expect(result[2]?.kind).toBe("answer");
  });

  it("contentHash と offset を付与する", () => {
    const result = parseStatements("○議長（山田太郎君）　テスト発言です。");

    expect(result).toHaveLength(1);
    expect(result[0]?.contentHash).toMatch(/^[a-f0-9]{64}$/);
    expect(result[0]?.startOffset).toBe(0);
    expect(result[0]?.endOffset).toBe("テスト発言です。".length);
  });

  it("ト書きをスキップする", () => {
    const text = `
○議長（山田太郎君）　開議します。
○（田中花子君登壇）
○５番（田中花子君）　質問いたします。
`;

    const result = parseStatements(text);

    expect(result).toHaveLength(2);
    expect(result[0]?.speakerRole).toBe("議長");
    expect(result[1]?.speakerRole).toBe("議員");
  });
});
