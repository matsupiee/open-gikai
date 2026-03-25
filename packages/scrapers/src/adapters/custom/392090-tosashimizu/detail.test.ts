import { describe, it, expect } from "vitest";
import { parseSpeaker, classifyKind, parseStatements } from "./detail";

describe("parseSpeaker", () => {
  it("カッコ形式: 議長（名前君）を解析する", () => {
    const result = parseSpeaker("○議長（山田太郎君） ただいまから会議を開きます。");
    expect(result.speakerName).toBe("山田太郎");
    expect(result.speakerRole).toBe("議長");
    expect(result.content).toBe("ただいまから会議を開きます。");
  });

  it("カッコ形式: 市長（名前君）を解析する", () => {
    const result = parseSpeaker("○市長（鈴木一郎君） お答えいたします。");
    expect(result.speakerName).toBe("鈴木一郎");
    expect(result.speakerRole).toBe("市長");
    expect(result.content).toBe("お答えいたします。");
  });

  it("カッコ形式: 副市長を解析する", () => {
    const result = parseSpeaker("○副市長（佐藤次郎君） ご説明いたします。");
    expect(result.speakerName).toBe("佐藤次郎");
    expect(result.speakerRole).toBe("副市長");
    expect(result.content).toBe("ご説明いたします。");
  });

  it("カッコ形式: 教育長を解析する", () => {
    const result = parseSpeaker("○教育長（中村三郎君） 答弁いたします。");
    expect(result.speakerName).toBe("中村三郎");
    expect(result.speakerRole).toBe("教育長");
    expect(result.content).toBe("答弁いたします。");
  });

  it("カッコ形式: 番号議員パターンを解析する", () => {
    const result = parseSpeaker("○1番（田中花子君） 質問いたします。");
    expect(result.speakerName).toBe("田中花子");
    expect(result.speakerRole).toBe("議員");
    expect(result.content).toBe("質問いたします。");
  });

  it("カッコ形式: 部長職を解析する", () => {
    const result = parseSpeaker("○総務部長（木村勇君） ご説明します。");
    expect(result.speakerName).toBe("木村勇");
    expect(result.speakerRole).toBe("部長");
    expect(result.content).toBe("ご説明します。");
  });

  it("副委員長が委員長より優先される", () => {
    const result = parseSpeaker("○副委員長（佐藤花子君） ご報告いたします。");
    expect(result.speakerRole).toBe("副委員長");
  });

  it("副市長が市長より優先される", () => {
    const result = parseSpeaker("○副市長（高橋一郎君） 答弁します。");
    expect(result.speakerRole).toBe("副市長");
  });

  it("スペース区切り形式: 議長を解析する", () => {
    const result = parseSpeaker("○ 山田 議長 ただいまから会議を開きます。");
    expect(result.speakerName).toBe("山田");
    expect(result.speakerRole).toBe("議長");
    expect(result.content).toBe("ただいまから会議を開きます。");
  });

  it("名前のスペースが除去される", () => {
    const result = parseSpeaker("○市長（田中　一郎君） お答えします。");
    expect(result.speakerName).toBe("田中一郎");
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

  it("委員長は remark", () => {
    expect(classifyKind("委員長")).toBe("remark");
  });

  it("副委員長は remark", () => {
    expect(classifyKind("副委員長")).toBe("remark");
  });

  it("市長は answer", () => {
    expect(classifyKind("市長")).toBe("answer");
  });

  it("副市長は answer", () => {
    expect(classifyKind("副市長")).toBe("answer");
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

  it("教育次長は answer", () => {
    expect(classifyKind("教育次長")).toBe("answer");
  });

  it("課長補佐は answer", () => {
    expect(classifyKind("課長補佐")).toBe("answer");
  });

  it("議員は question", () => {
    expect(classifyKind("議員")).toBe("question");
  });

  it("null は remark", () => {
    expect(classifyKind(null)).toBe("remark");
  });

  it("部長で終わる役職は answer", () => {
    expect(classifyKind("総務部長")).toBe("answer");
  });

  it("課長で終わる役職は answer", () => {
    expect(classifyKind("総務課長")).toBe("answer");
  });
});

describe("parseStatements", () => {
  it("カッコ形式の発言を分割する", () => {
    const text = `○議長（山田太郎君） ただいまから会議を開きます。○1番（田中花子君） 質問があります。○市長（鈴木一郎君） お答えします。`;
    const statements = parseStatements(text);

    expect(statements).toHaveLength(3);

    expect(statements[0]!.kind).toBe("remark");
    expect(statements[0]!.speakerName).toBe("山田太郎");
    expect(statements[0]!.speakerRole).toBe("議長");

    expect(statements[1]!.kind).toBe("question");
    expect(statements[1]!.speakerName).toBe("田中花子");
    expect(statements[1]!.speakerRole).toBe("議員");

    expect(statements[2]!.kind).toBe("answer");
    expect(statements[2]!.speakerName).toBe("鈴木一郎");
    expect(statements[2]!.speakerRole).toBe("市長");
  });

  it("出席表の出欠マーカーをスキップする", () => {
    const text = `1 ○ 2 ○ 3 ○ 4 ○ 5 ○
○議長（山田太郎君） ただいまから会議を開きます。`;

    const statements = parseStatements(text);
    expect(statements).toHaveLength(1);
    expect(statements[0]!.speakerRole).toBe("議長");
  });

  it("ト書き（登壇）はスキップする", () => {
    const text = `○議長（山田太郎君） ただいまから会議を開きます。
○（田中花子君登壇）
○1番（田中花子君） 質問があります。`;

    const statements = parseStatements(text);
    expect(statements).toHaveLength(2);
    expect(statements[0]!.speakerRole).toBe("議長");
    expect(statements[1]!.speakerRole).toBe("議員");
  });

  it("各 statement に contentHash が付与される", () => {
    const statements = parseStatements("○議長（山田太郎君） テスト発言。");
    expect(statements[0]!.contentHash).toMatch(/^[a-f0-9]{64}$/);
  });

  it("offset が正しく計算される", () => {
    const text = `○議長（山田太郎君） ただいま。○1番（田中花子君） 質問です。`;

    const statements = parseStatements(text);

    expect(statements[0]!.startOffset).toBe(0);
    expect(statements[0]!.endOffset).toBe("ただいま。".length);
    expect(statements[1]!.startOffset).toBe("ただいま。".length + 1);
  });

  it("空テキストは空配列を返す", () => {
    expect(parseStatements("")).toEqual([]);
  });
});
