import { describe, it, expect } from "vitest";
import { parseSpeaker, classifyKind, parseStatements } from "./detail";

describe("parseSpeaker", () => {
  it("議長（名前君）パターンを解析する", () => {
    const result = parseSpeaker(
      "○議長（中原 信男君）　それでは、ただいまから会議を開きます。",
    );
    expect(result.speakerName).toBe("中原信男");
    expect(result.speakerRole).toBe("議長");
    expect(result.content).toBe("それでは、ただいまから会議を開きます。");
  });

  it("町長（名前君）パターンを解析する", () => {
    const result = parseSpeaker(
      "○町長（﨏田 淳一君）　お答えいたします。",
    );
    expect(result.speakerName).toBe("﨏田淳一");
    expect(result.speakerRole).toBe("町長");
    expect(result.content).toBe("お答えいたします。");
  });

  it("議員（番号 名前君）パターンを解析する", () => {
    const result = parseSpeaker(
      "○議員（８番 安達 幸博君）　質問いたします。",
    );
    expect(result.speakerName).toBe("安達幸博");
    expect(result.speakerRole).toBe("議員");
    expect(result.content).toBe("質問いたします。");
  });

  it("議員（番号 名前君）半角数字パターンを解析する", () => {
    const result = parseSpeaker(
      "○議員（3番 坪倉 敏君）　質問いたします。",
    );
    expect(result.speakerName).toBe("坪倉敏");
    expect(result.speakerRole).toBe("議員");
    expect(result.content).toBe("質問いたします。");
  });

  it("課長パターンを解析する", () => {
    const result = parseSpeaker(
      "○総務課長（景山 政之君）　ご説明いたします。",
    );
    expect(result.speakerName).toBe("景山政之");
    expect(result.speakerRole).toBe("課長");
    expect(result.content).toBe("ご説明いたします。");
  });

  it("企画政策課長パターンを解析する", () => {
    const result = parseSpeaker(
      "○企画政策課長（神崎 猛君）　ご報告いたします。",
    );
    expect(result.speakerName).toBe("神崎猛");
    expect(result.speakerRole).toBe("課長");
    expect(result.content).toBe("ご報告いたします。");
  });

  it("教育課長パターンを解析する", () => {
    const result = parseSpeaker(
      "○教育課長（三好 太郎君）　ご説明いたします。",
    );
    expect(result.speakerName).toBe("三好太郎");
    expect(result.speakerRole).toBe("課長");
    expect(result.content).toBe("ご説明いたします。");
  });

  it("副町長パターンを解析する", () => {
    const result = parseSpeaker(
      "○副町長（田中 一郎君）　答弁します。",
    );
    expect(result.speakerName).toBe("田中一郎");
    expect(result.speakerRole).toBe("副町長");
    expect(result.content).toBe("答弁します。");
  });

  it("名前の空白が除去される", () => {
    const result = parseSpeaker(
      "○町長（﨏田　淳一君）　答弁します。",
    );
    expect(result.speakerName).toBe("﨏田淳一");
  });

  it("○ マーカーなしのテキスト", () => {
    const result = parseSpeaker("午後１時開議");
    expect(result.speakerName).toBeNull();
    expect(result.speakerRole).toBeNull();
    expect(result.content).toBe("午後１時開議");
  });
});

describe("classifyKind", () => {
  it("議長は remark", () => {
    expect(classifyKind("議長")).toBe("remark");
  });

  it("副議長は remark", () => {
    expect(classifyKind("副議長")).toBe("remark");
  });

  it("町長は answer", () => {
    expect(classifyKind("町長")).toBe("answer");
  });

  it("副町長は answer", () => {
    expect(classifyKind("副町長")).toBe("answer");
  });

  it("教育長は answer", () => {
    expect(classifyKind("教育長")).toBe("answer");
  });

  it("課長は answer", () => {
    expect(classifyKind("課長")).toBe("answer");
  });

  it("議員は question", () => {
    expect(classifyKind("議員")).toBe("question");
  });

  it("null は remark", () => {
    expect(classifyKind(null)).toBe("remark");
  });
});

describe("parseStatements", () => {
  it("○ マーカーでテキストを分割する", () => {
    const text = `
○議長（中原 信男君）　ただいまから本日の会議を開きます。
○議員（８番 安達 幸博君）　質問があります。
○町長（﨏田 淳一君）　お答えします。
`;
    const statements = parseStatements(text);

    expect(statements).toHaveLength(3);

    expect(statements[0]!.kind).toBe("remark");
    expect(statements[0]!.speakerName).toBe("中原信男");
    expect(statements[0]!.speakerRole).toBe("議長");

    expect(statements[1]!.kind).toBe("question");
    expect(statements[1]!.speakerName).toBe("安達幸博");
    expect(statements[1]!.speakerRole).toBe("議員");

    expect(statements[2]!.kind).toBe("answer");
    expect(statements[2]!.speakerName).toBe("﨏田淳一");
    expect(statements[2]!.speakerRole).toBe("町長");
  });

  it("各 statement に contentHash が付与される", () => {
    const statements = parseStatements(
      "○議長（中原 信男君）　テスト発言。",
    );
    expect(statements[0]!.contentHash).toMatch(/^[a-f0-9]{64}$/);
  });

  it("offset が正しく計算される", () => {
    const text = `○議長（中原 信男君）　ただいま。
○議員（３番 坪倉 敏君）　質問です。`;

    const statements = parseStatements(text);

    expect(statements[0]!.startOffset).toBe(0);
    expect(statements[0]!.endOffset).toBe("ただいま。".length);
    expect(statements[1]!.startOffset).toBe("ただいま。".length + 1);
  });

  it("ページ番号（－1－）が除去される", () => {
    const text = `○議長（中原 信男君）　ただいまから会議を開きます。
－1－
○議員（８番 安達 幸博君）　質問があります。`;

    const statements = parseStatements(text);
    expect(statements).toHaveLength(2);
    expect(statements[0]!.content).not.toContain("－1－");
  });

  it("空テキストは空配列を返す", () => {
    expect(parseStatements("")).toEqual([]);
  });

  it("課長の発言が answer に分類される", () => {
    const text = "○総務課長（景山 政之君）　ご説明いたします。";
    const statements = parseStatements(text);

    expect(statements).toHaveLength(1);
    expect(statements[0]!.kind).toBe("answer");
    expect(statements[0]!.speakerRole).toBe("課長");
  });
});
