import { describe, it, expect } from "vitest";
import { parseSpeaker, classifyKind, parseStatements } from "./detail";

describe("parseSpeaker", () => {
  it("議長（名前）パターンを解析する", () => {
    const result = parseSpeaker(
      "○議長（渋谷正文） これより、本日をもって招集されました定例会を開会いたします。"
    );
    expect(result.speakerName).toBe("渋谷正文");
    expect(result.speakerRole).toBe("議長");
    expect(result.content).toBe(
      "これより、本日をもって招集されました定例会を開会いたします。"
    );
  });

  it("市長（名前）パターンを解析する", () => {
    const result = parseSpeaker("○市長（北猛俊） お答えいたします。");
    expect(result.speakerName).toBe("北猛俊");
    expect(result.speakerRole).toBe("市長");
    expect(result.content).toBe("お答えいたします。");
  });

  it("番号議員パターンを解析する", () => {
    const result = parseSpeaker("○３番（橋詰亜咲美） 質問いたします。");
    expect(result.speakerName).toBe("橋詰亜咲美");
    expect(result.speakerRole).toBe("議員");
    expect(result.content).toBe("質問いたします。");
  });

  it("事務局長パターンを解析する", () => {
    const result = parseSpeaker(
      "○事務局長（今井顕一） 御報告いたします。"
    );
    expect(result.speakerName).toBe("今井顕一");
    expect(result.speakerRole).toBe("事務局長");
    expect(result.content).toBe("御報告いたします。");
  });

  it("教育委員会教育部長パターンを解析する", () => {
    const result = parseSpeaker(
      "○教育委員会教育部長（佐藤保） 御説明いたします。"
    );
    expect(result.speakerName).toBe("佐藤保");
    expect(result.speakerRole).toBe("部長");
    expect(result.content).toBe("御説明いたします。");
  });

  it("副市長パターンを解析する", () => {
    const result = parseSpeaker(
      "○副市長（稲葉武則） 御説明いたします。"
    );
    expect(result.speakerName).toBe("稲葉武則");
    expect(result.speakerRole).toBe("副市長");
    expect(result.content).toBe("御説明いたします。");
  });

  it("教育長パターンを解析する", () => {
    const result = parseSpeaker(
      "○教育長（近内栄一） お答えいたします。"
    );
    expect(result.speakerName).toBe("近内栄一");
    expect(result.speakerRole).toBe("教育長");
    expect(result.content).toBe("お答えいたします。");
  });

  it("名前に空白を含む場合は除去される", () => {
    const result = parseSpeaker(
      "○市長（北　猛俊） 答弁します。"
    );
    expect(result.speakerName).toBe("北猛俊");
  });

  it("敬称「君」付きのパターンを解析する", () => {
    const result = parseSpeaker(
      "○議長（渋谷正文君） ただいまから会議を開きます。"
    );
    expect(result.speakerName).toBe("渋谷正文");
    expect(result.speakerRole).toBe("議長");
  });

  it("○ マーカーなしのテキスト", () => {
    const result = parseSpeaker("午前１０時開議");
    expect(result.speakerName).toBeNull();
    expect(result.speakerRole).toBeNull();
    expect(result.content).toBe("午前１０時開議");
  });
});

describe("classifyKind", () => {
  it("議長は remark", () => {
    expect(classifyKind("議長")).toBe("remark");
  });

  it("副議長は remark", () => {
    expect(classifyKind("副議長")).toBe("remark");
  });

  it("事務局長は remark", () => {
    expect(classifyKind("事務局長")).toBe("remark");
  });

  it("市長は answer", () => {
    expect(classifyKind("市長")).toBe("answer");
  });

  it("教育長は answer", () => {
    expect(classifyKind("教育長")).toBe("answer");
  });

  it("部長は answer", () => {
    expect(classifyKind("部長")).toBe("answer");
  });

  it("課長は answer", () => {
    expect(classifyKind("課長")).toBe("answer");
  });

  it("所長は answer", () => {
    expect(classifyKind("所長")).toBe("answer");
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
○議長（渋谷正文） ただいまから本日の会議を開きます。
○３番（橋詰亜咲美） 質問があります。
○市長（北猛俊） お答えします。
`;
    const statements = parseStatements(text);

    expect(statements).toHaveLength(3);

    expect(statements[0]!.kind).toBe("remark");
    expect(statements[0]!.speakerName).toBe("渋谷正文");
    expect(statements[0]!.speakerRole).toBe("議長");

    expect(statements[1]!.kind).toBe("question");
    expect(statements[1]!.speakerName).toBe("橋詰亜咲美");
    expect(statements[1]!.speakerRole).toBe("議員");

    expect(statements[2]!.kind).toBe("answer");
    expect(statements[2]!.speakerName).toBe("北猛俊");
    expect(statements[2]!.speakerRole).toBe("市長");
  });

  it("各 statement に contentHash が付与される", () => {
    const statements = parseStatements(
      "○議長（渋谷正文） テスト発言。"
    );
    expect(statements[0]!.contentHash).toMatch(/^[a-f0-9]{64}$/);
  });

  it("offset が正しく計算される", () => {
    const text = `○議長（渋谷正文） ただいま。
○３番（橋詰亜咲美） 質問です。`;

    const statements = parseStatements(text);

    expect(statements[0]!.startOffset).toBe(0);
    expect(statements[0]!.endOffset).toBe("ただいま。".length);
    expect(statements[1]!.startOffset).toBe("ただいま。".length + 1);
  });

  it("-登壇- のみのブロックはスキップする", () => {
    const text = `○議長（渋谷正文） ただいまから会議を開きます。
○市長（北猛俊） -登壇-
○市長（北猛俊） お答えいたします。`;

    const statements = parseStatements(text);
    expect(statements).toHaveLength(2);
    expect(statements[0]!.speakerRole).toBe("議長");
    expect(statements[1]!.speakerRole).toBe("市長");
    expect(statements[1]!.content).toBe("お答えいたします。");
  });

  it("-登壇- の後に発言が続く場合は登壇部分を除去する", () => {
    const text = `○市長（北猛俊） -登壇- おはようございます。`;

    const statements = parseStatements(text);
    expect(statements).toHaveLength(1);
    expect(statements[0]!.content).toBe("おはようございます。");
  });

  it("空テキストは空配列を返す", () => {
    expect(parseStatements("")).toEqual([]);
  });
});
