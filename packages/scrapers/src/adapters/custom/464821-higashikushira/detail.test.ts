import { describe, expect, it } from "vitest";
import { classifyKind, parseSpeaker, parseStatements } from "./detail";

describe("parseSpeaker", () => {
  it("議長のヘッダーを解析する", () => {
    const result = parseSpeaker("議 長（田之畑）");
    expect(result.speakerName).toBe("田之畑");
    expect(result.speakerRole).toBe("議長");
    expect(result.content).toBe("");
  });

  it("番号付き議員のヘッダーを解析する", () => {
    const result = parseSpeaker("２ 番（小 川） 質問します。");
    expect(result.speakerName).toBe("小川");
    expect(result.speakerRole).toBe("議員");
    expect(result.content).toBe("質問します。");
  });

  it("議会事務局長のヘッダーを解析する", () => {
    const result = parseSpeaker("議会事務局長（浜 屋） 御起立ください。");
    expect(result.speakerName).toBe("浜屋");
    expect(result.speakerRole).toBe("議会事務局長");
    expect(result.content).toBe("御起立ください。");
  });

  it("課長職を suffix で解析する", () => {
    const result = parseSpeaker("総務課長（江 口） 説明します。");
    expect(result.speakerName).toBe("江口");
    expect(result.speakerRole).toBe("課長");
    expect(result.content).toBe("説明します。");
  });

  it("話者ヘッダーでない行は null 扱いにする", () => {
    const result = parseSpeaker("会議録署名議員（会議規則第１２７条）");
    expect(result.speakerName).toBeNull();
    expect(result.speakerRole).toBeNull();
    expect(result.content).toBe("会議録署名議員（会議規則第127条）");
  });
});

describe("classifyKind", () => {
  it("議長は remark", () => {
    expect(classifyKind("議長")).toBe("remark");
  });

  it("議員は question", () => {
    expect(classifyKind("議員")).toBe("question");
  });

  it("町長は answer", () => {
    expect(classifyKind("町長")).toBe("answer");
  });

  it("課長は answer", () => {
    expect(classifyKind("課長")).toBe("answer");
  });

  it("議会事務局長は remark", () => {
    expect(classifyKind("議会事務局長")).toBe("remark");
  });
});

describe("parseStatements", () => {
  it("話者ヘッダーごとに発言をまとめる", () => {
    const text = `
会 議 の 経 過
議 長（田之畑）
  ただいまから会議を開きます。
  本日の会議を開きます。
（「異議なし」と呼ぶ者あり）
２ 番（小 川）
  質問します。
-1-
会 議 の 経 過
町 長（宮 原）
  お答えします。
    `.trim();

    const statements = parseStatements(text);

    expect(statements).toHaveLength(3);

    expect(statements[0]!.speakerName).toBe("田之畑");
    expect(statements[0]!.speakerRole).toBe("議長");
    expect(statements[0]!.kind).toBe("remark");
    expect(statements[0]!.content).toBe(
      "ただいまから会議を開きます。 本日の会議を開きます。",
    );

    expect(statements[1]!.speakerName).toBe("小川");
    expect(statements[1]!.speakerRole).toBe("議員");
    expect(statements[1]!.kind).toBe("question");
    expect(statements[1]!.content).toBe("質問します。");

    expect(statements[2]!.speakerName).toBe("宮原");
    expect(statements[2]!.speakerRole).toBe("町長");
    expect(statements[2]!.kind).toBe("answer");
    expect(statements[2]!.content).toBe("お答えします。");
  });

  it("offset を連番で付与する", () => {
    const text = `
議 長（田之畑）
  開会します。
町 長（宮 原）
  説明します。
    `.trim();

    const statements = parseStatements(text);

    expect(statements[0]!.startOffset).toBe(0);
    expect(statements[0]!.endOffset).toBe("開会します。".length);
    expect(statements[1]!.startOffset).toBe("開会します。".length + 1);
  });

  it("話者がいないテキストは空配列を返す", () => {
    const text = `
議事日程
会議に付した事件
ただの説明文です。
    `.trim();

    expect(parseStatements(text)).toEqual([]);
  });
});
