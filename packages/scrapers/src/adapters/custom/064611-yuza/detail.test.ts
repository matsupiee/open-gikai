import { describe, expect, it } from "vitest";
import { classifyKind, parseSpeaker, parseStatements } from "./detail";

describe("parseSpeaker", () => {
  it("議長（名前君）パターンを解析する", () => {
    const result = parseSpeaker(
      "○議長（後藤幸平君）　ただいまから本日の会議を開きます。",
    );
    expect(result.speakerName).toBe("後藤幸平");
    expect(result.speakerRole).toBe("議長");
    expect(result.content).toBe("ただいまから本日の会議を開きます。");
  });

  it("町長（名前君）パターンを解析する", () => {
    const result = parseSpeaker(
      "○町長（時田博機君）　お答えいたします。",
    );
    expect(result.speakerName).toBe("時田博機");
    expect(result.speakerRole).toBe("町長");
    expect(result.content).toBe("お答えいたします。");
  });

  it("副町長パターンを解析する", () => {
    const result = parseSpeaker(
      "○副町長（佐藤太郎君）　ご説明いたします。",
    );
    expect(result.speakerName).toBe("佐藤太郎");
    expect(result.speakerRole).toBe("副町長");
    expect(result.content).toBe("ご説明いたします。");
  });

  it("番号議員パターンを解析する（全角数字）", () => {
    const result = parseSpeaker(
      "○３番（佐藤彦一君）　質問いたします。",
    );
    expect(result.speakerName).toBe("佐藤彦一");
    expect(result.speakerRole).toBe("議員");
    expect(result.content).toBe("質問いたします。");
  });

  it("教育長パターンを解析する", () => {
    const result = parseSpeaker(
      "○教育長（田中太郎君）　お答えいたします。",
    );
    expect(result.speakerName).toBe("田中太郎");
    expect(result.speakerRole).toBe("教育長");
    expect(result.content).toBe("お答えいたします。");
  });

  it("課長パターンを解析する（役職名プレフィックスあり）", () => {
    const result = parseSpeaker(
      "○総務課長（山田一郎君）　ご説明いたします。",
    );
    expect(result.speakerName).toBe("山田一郎");
    expect(result.speakerRole).toBe("課長");
    expect(result.content).toBe("ご説明いたします。");
  });

  it("委員長パターンを解析する", () => {
    const result = parseSpeaker(
      "○総務文教常任委員会委員長（鈴木太郎君）　ご報告いたします。",
    );
    expect(result.speakerName).toBe("鈴木太郎");
    expect(result.speakerRole).toBe("委員長");
    expect(result.content).toBe("ご報告いたします。");
  });

  it("副委員長パターンを解析する", () => {
    const result = parseSpeaker(
      "○副委員長（田中次郎君）　ご報告いたします。",
    );
    expect(result.speakerName).toBe("田中次郎");
    expect(result.speakerRole).toBe("副委員長");
    expect(result.content).toBe("ご報告いたします。");
  });

  it("名前に空白を含む場合は除去される", () => {
    const result = parseSpeaker(
      "○町長（時田　博機君）　答弁します。",
    );
    expect(result.speakerName).toBe("時田博機");
  });

  it("○ マーカーなしのテキスト", () => {
    const result = parseSpeaker("午前10時開議");
    expect(result.speakerName).toBeNull();
    expect(result.speakerRole).toBeNull();
    expect(result.content).toBe("午前10時開議");
  });

  it("事務局長パターンを解析する", () => {
    const result = parseSpeaker(
      "○事務局長（高橋次郎君）　出席議員を報告します。",
    );
    expect(result.speakerName).toBe("高橋次郎");
    expect(result.speakerRole).toBe("事務局長");
    expect(result.content).toBe("出席議員を報告します。");
  });
});

describe("classifyKind", () => {
  it("議長は remark", () => {
    expect(classifyKind("議長")).toBe("remark");
  });

  it("副議長は remark", () => {
    expect(classifyKind("副議長")).toBe("remark");
  });

  it("委員長は remark", () => {
    expect(classifyKind("委員長")).toBe("remark");
  });

  it("副委員長は remark", () => {
    expect(classifyKind("副委員長")).toBe("remark");
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

  it("部長は answer", () => {
    expect(classifyKind("部長")).toBe("answer");
  });

  it("議員は question", () => {
    expect(classifyKind("議員")).toBe("question");
  });

  it("null は remark", () => {
    expect(classifyKind(null)).toBe("remark");
  });

  it("事務局長は answer", () => {
    expect(classifyKind("事務局長")).toBe("answer");
  });
});

describe("parseStatements", () => {
  it("○ マーカーでテキストを分割する", () => {
    const text = `
○議長（後藤幸平君）　ただいまから本日の会議を開きます。
○３番（佐藤彦一君）　質問があります。
○町長（時田博機君）　お答えします。
`;
    const statements = parseStatements(text);

    expect(statements).toHaveLength(3);

    expect(statements[0]!.kind).toBe("remark");
    expect(statements[0]!.speakerName).toBe("後藤幸平");
    expect(statements[0]!.speakerRole).toBe("議長");

    expect(statements[1]!.kind).toBe("question");
    expect(statements[1]!.speakerName).toBe("佐藤彦一");
    expect(statements[1]!.speakerRole).toBe("議員");

    expect(statements[2]!.kind).toBe("answer");
    expect(statements[2]!.speakerName).toBe("時田博機");
    expect(statements[2]!.speakerRole).toBe("町長");
  });

  it("各 statement に contentHash が付与される", () => {
    const statements = parseStatements(
      "○議長（後藤幸平君）　テスト発言。",
    );
    expect(statements[0]!.contentHash).toMatch(/^[a-f0-9]{64}$/);
  });

  it("offset が正しく計算される", () => {
    const text = `○議長（後藤幸平君）　ただいま。
○３番（佐藤彦一君）　質問です。`;

    const statements = parseStatements(text);

    expect(statements[0]!.startOffset).toBe(0);
    expect(statements[0]!.endOffset).toBe("ただいま。".length);
    expect(statements[1]!.startOffset).toBe("ただいま。".length + 1);
  });

  it("ト書き（登壇）はスキップする", () => {
    const text = `○議長（後藤幸平君）　ただいまから会議を開きます。
（３番　佐藤彦一君登壇）
○３番（佐藤彦一君）　質問があります。`;

    const statements = parseStatements(text);
    expect(statements).toHaveLength(2);
    expect(statements[0]!.speakerRole).toBe("議長");
    expect(statements[1]!.speakerRole).toBe("議員");
  });

  it("空テキストは空配列を返す", () => {
    expect(parseStatements("")).toEqual([]);
  });

  it("contentHash は SHA-256 の hex 文字列（64 文字）", () => {
    const statements = parseStatements(
      "○議長（後藤幸平君）　テスト発言内容です。",
    );
    expect(statements[0]!.contentHash).toHaveLength(64);
    expect(statements[0]!.contentHash).toMatch(/^[a-f0-9]+$/);
  });
});
