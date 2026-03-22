import { describe, it, expect } from "vitest";
import { parseSpeaker, classifyKind, parseStatements } from "./detail";

describe("parseSpeaker", () => {
  it("議長（名前議員）パターンを解析する", () => {
    const result = parseSpeaker(
      "○議長（小町明夫議員）　ただいまより本日の会議を開きます。"
    );
    expect(result.speakerName).toBe("小町明夫");
    expect(result.speakerRole).toBe("議長");
    expect(result.content).toBe("ただいまより本日の会議を開きます。");
  });

  it("市長（名前君）パターンを解析する", () => {
    const result = parseSpeaker(
      "○市長（渡部尚君）　おはようございます。"
    );
    expect(result.speakerName).toBe("渡部尚");
    expect(result.speakerRole).toBe("市長");
    expect(result.content).toBe("おはようございます。");
  });

  it("番号議員パターンを解析する", () => {
    const result = parseSpeaker(
      "○１２番（浅見みどり議員）　質問します。"
    );
    expect(result.speakerName).toBe("浅見みどり");
    expect(result.speakerRole).toBe("議員");
    expect(result.content).toBe("質問します。");
  });

  it("委員長パターンを解析する", () => {
    const result = parseSpeaker(
      "○政策総務委員長（横尾たかお議員）　報告します。"
    );
    expect(result.speakerName).toBe("横尾たかお");
    expect(result.speakerRole).toBe("委員長");
    expect(result.content).toBe("報告します。");
  });

  it("部長パターンを解析する", () => {
    const result = parseSpeaker(
      "○経営政策部長（東村浩二君）　お答えいたします。"
    );
    expect(result.speakerName).toBe("東村浩二");
    expect(result.speakerRole).toBe("部長");
    expect(result.content).toBe("お答えいたします。");
  });
});

describe("classifyKind", () => {
  it("議長は remark", () => {
    expect(classifyKind("議長")).toBe("remark");
  });

  it("委員長は remark", () => {
    expect(classifyKind("委員長")).toBe("remark");
  });

  it("議員は question", () => {
    expect(classifyKind("議員")).toBe("question");
  });

  it("市長は answer", () => {
    expect(classifyKind("市長")).toBe("answer");
  });

  it("部長は answer", () => {
    expect(classifyKind("部長")).toBe("answer");
  });

  it("null は remark", () => {
    expect(classifyKind(null)).toBe("remark");
  });
});

describe("parseStatements", () => {
  it("○ マーカーでテキストを分割する", () => {
    const text = `
○議長（小町明夫議員）　ただいまより本日の会議を開きます。
○１番（小町明夫議員）　質問があります。
○市長（渡部尚君）　お答えします。
`;
    const statements = parseStatements(text);

    expect(statements.length).toBe(3);

    expect(statements[0]!.kind).toBe("remark");
    expect(statements[0]!.speakerName).toBe("小町明夫");
    expect(statements[0]!.speakerRole).toBe("議長");

    expect(statements[1]!.kind).toBe("question");
    expect(statements[1]!.speakerRole).toBe("議員");

    expect(statements[2]!.kind).toBe("answer");
    expect(statements[2]!.speakerName).toBe("渡部尚");
    expect(statements[2]!.speakerRole).toBe("市長");
  });

  it("各 statement に contentHash が付与される", () => {
    const statements = parseStatements(
      "○議長（小町明夫議員）　テスト発言。"
    );
    expect(statements[0]!.contentHash).toMatch(/^[a-f0-9]{64}$/);
  });

  it("空テキストは空配列を返す", () => {
    expect(parseStatements("")).toEqual([]);
  });
});
