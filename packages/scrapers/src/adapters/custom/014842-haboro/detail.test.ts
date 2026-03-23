import { describe, expect, it } from "vitest";
import { classifyKind, parseSpeaker, parseStatements } from "./detail";

describe("parseSpeaker", () => {
  it("議長（名前君）パターンを解析する", () => {
    const result = parseSpeaker(
      "〇議長（森　淳君）　ただいまから本日の会議を開きます。"
    );
    expect(result.speakerName).toBe("森淳");
    expect(result.speakerRole).toBe("議長");
    expect(result.content).toBe("ただいまから本日の会議を開きます。");
  });

  it("町長（名前君）パターンを解析する", () => {
    const result = parseSpeaker(
      "〇町長（舟橋泰博君）　お答えいたします。"
    );
    expect(result.speakerName).toBe("舟橋泰博");
    expect(result.speakerRole).toBe("町長");
    expect(result.content).toBe("お答えいたします。");
  });

  it("番号議員パターンを解析する", () => {
    const result = parseSpeaker(
      "〇11番（磯野直君）　質問いたします。"
    );
    expect(result.speakerName).toBe("磯野直");
    expect(result.speakerRole).toBe("議員");
    expect(result.content).toBe("質問いたします。");
  });

  it("副町長パターンを解析する", () => {
    const result = parseSpeaker(
      "〇副町長（田中一郎君）　ご説明いたします。"
    );
    expect(result.speakerName).toBe("田中一郎");
    expect(result.speakerRole).toBe("副町長");
    expect(result.content).toBe("ご説明いたします。");
  });

  it("課長パターンを解析する", () => {
    const result = parseSpeaker(
      "〇総務課長（佐藤太郎君）　ご報告いたします。"
    );
    expect(result.speakerName).toBe("佐藤太郎");
    expect(result.speakerRole).toBe("課長");
    expect(result.content).toBe("ご報告いたします。");
  });

  it("委員長パターンを解析する", () => {
    const result = parseSpeaker(
      "〇予算特別委員会委員長（山田花子君）　ご報告いたします。"
    );
    expect(result.speakerName).toBe("山田花子");
    expect(result.speakerRole).toBe("委員長");
    expect(result.content).toBe("ご報告いたします。");
  });

  it("副委員長が委員長として誤マッチしない", () => {
    const result = parseSpeaker(
      "〇副委員長（高橋次郎君）　進行いたします。"
    );
    expect(result.speakerRole).toBe("副委員長");
  });

  it("名前に空白を含む場合は除去される", () => {
    const result = parseSpeaker(
      "〇町長（舟橋　泰博君）　答弁します。"
    );
    expect(result.speakerName).toBe("舟橋泰博");
  });

  it("○ マーカーでも解析できる", () => {
    const result = parseSpeaker(
      "○議長（森　淳君）　開会します。"
    );
    expect(result.speakerName).toBe("森淳");
    expect(result.speakerRole).toBe("議長");
    expect(result.content).toBe("開会します。");
  });

  it("マーカーなしのテキスト", () => {
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

  it("議員は question", () => {
    expect(classifyKind("議員")).toBe("question");
  });

  it("null は remark", () => {
    expect(classifyKind(null)).toBe("remark");
  });
});

describe("parseStatements", () => {
  it("〇 マーカーでテキストを分割する", () => {
    const text = `
〇議長（森　淳君）　ただいまから本日の会議を開きます。
〇11番（磯野直君）　質問があります。
〇町長（舟橋泰博君）　お答えします。
`;
    const statements = parseStatements(text);

    expect(statements).toHaveLength(3);

    expect(statements[0]!.kind).toBe("remark");
    expect(statements[0]!.speakerName).toBe("森淳");
    expect(statements[0]!.speakerRole).toBe("議長");

    expect(statements[1]!.kind).toBe("question");
    expect(statements[1]!.speakerName).toBe("磯野直");
    expect(statements[1]!.speakerRole).toBe("議員");

    expect(statements[2]!.kind).toBe("answer");
    expect(statements[2]!.speakerName).toBe("舟橋泰博");
    expect(statements[2]!.speakerRole).toBe("町長");
  });

  it("○ マーカー（PDF 由来）でも分割する", () => {
    const text = `
○議長（森　淳君）　ただいまから会議を開きます。
○町長（舟橋泰博君）　答弁します。
`;
    const statements = parseStatements(text);
    expect(statements).toHaveLength(2);
  });

  it("◎ 議事進行見出しはスキップする", () => {
    const text = `
◎開議の宣告
〇議長（森　淳君）　ただいまから会議を開きます。
◎町長あいさつ
〇町長（舟橋泰博君）　ご挨拶申し上げます。
`;
    const statements = parseStatements(text);
    expect(statements).toHaveLength(2);
    expect(statements[0]!.speakerRole).toBe("議長");
    expect(statements[1]!.speakerRole).toBe("町長");
  });

  it("各 statement に contentHash が付与される", () => {
    const statements = parseStatements(
      "〇議長（森　淳君）　テスト発言。"
    );
    expect(statements[0]!.contentHash).toMatch(/^[a-f0-9]{64}$/);
  });

  it("offset が正しく計算される", () => {
    const text = `〇議長（森　淳君）　ただいま。
〇11番（磯野直君）　質問です。`;

    const statements = parseStatements(text);

    expect(statements[0]!.startOffset).toBe(0);
    expect(statements[0]!.endOffset).toBe("ただいま。".length);
    expect(statements[1]!.startOffset).toBe("ただいま。".length + 1);
  });

  it("ト書き（登壇）はスキップする", () => {
    const text = `〇議長（森　淳君）　ただいまから会議を開きます。
（11番　磯野直君登壇）
〇11番（磯野直君）　質問があります。`;

    const statements = parseStatements(text);
    expect(statements).toHaveLength(2);
    expect(statements[0]!.speakerRole).toBe("議長");
    expect(statements[1]!.speakerRole).toBe("議員");
  });

  it("空テキストは空配列を返す", () => {
    expect(parseStatements("")).toEqual([]);
  });
});
