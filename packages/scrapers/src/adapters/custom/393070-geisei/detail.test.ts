import { describe, it, expect } from "vitest";
import { parseSpeaker, classifyKind, parseStatements } from "./detail";

describe("parseSpeaker", () => {
  it("スペース区切り形式: 議長を解析する", () => {
    const result = parseSpeaker(
      "○ 岡村 俊彰 議長 ただいまの出席議員は 10 名です。"
    );
    expect(result.speakerName).toBe("岡村俊彰");
    expect(result.speakerRole).toBe("議長");
    expect(result.content).toBe("ただいまの出席議員は 10 名です。");
  });

  it("スペース区切り形式: 村長を解析する", () => {
    const result = parseSpeaker(
      "○ 溝渕 孝 村長 おはようございます。"
    );
    expect(result.speakerName).toBe("溝渕孝");
    expect(result.speakerRole).toBe("村長");
    expect(result.content).toBe("おはようございます。");
  });

  it("スペース区切り形式: 議員を解析する", () => {
    const result = parseSpeaker(
      "○ 西笛 千代子 議員 おはようございます。議会運営委員会報告をいたします。"
    );
    expect(result.speakerName).toBe("西笛千代子");
    expect(result.speakerRole).toBe("議員");
    expect(result.content).toBe(
      "おはようございます。議会運営委員会報告をいたします。"
    );
  });

  it("スペース区切り形式: 総務課長を解析する", () => {
    const result = parseSpeaker(
      "○ 池田 加奈 総務課長 ご説明いたします。"
    );
    expect(result.speakerName).toBe("池田加奈");
    expect(result.speakerRole).toBe("課長");
    expect(result.content).toBe("ご説明いたします。");
  });

  it("スペース区切り形式: 教育次長を解析する", () => {
    const result = parseSpeaker(
      "○ 佐藤 大輔 教育次長 ご報告いたします。"
    );
    expect(result.speakerName).toBe("佐藤大輔");
    expect(result.speakerRole).toBe("教育次長");
    expect(result.content).toBe("ご報告いたします。");
  });

  it("スペース区切り形式: 課長補佐を解析する", () => {
    const result = parseSpeaker(
      "○ 常光 紘正 産業振興課長補佐 ご説明いたします。"
    );
    expect(result.speakerName).toBe("常光紘正");
    expect(result.speakerRole).toBe("課長補佐");
    expect(result.content).toBe("ご説明いたします。");
  });

  it("カッコ形式: 議長（名前君）パターンを解析する", () => {
    const result = parseSpeaker(
      "○議長（山本松一君）　それでは、ただいまから会議を開きます。"
    );
    expect(result.speakerName).toBe("山本松一");
    expect(result.speakerRole).toBe("議長");
    expect(result.content).toBe("それでは、ただいまから会議を開きます。");
  });

  it("カッコ形式: 村長（名前君）パターンを解析する", () => {
    const result = parseSpeaker(
      "○村長（竹内嘉章君）　お答えいたします。"
    );
    expect(result.speakerName).toBe("竹内嘉章");
    expect(result.speakerRole).toBe("村長");
    expect(result.content).toBe("お答えいたします。");
  });

  it("カッコ形式: 番号議員パターンを解析する", () => {
    const result = parseSpeaker(
      "○３番（有澤由美子君）　質問いたします。"
    );
    expect(result.speakerName).toBe("有澤由美子");
    expect(result.speakerRole).toBe("議員");
    expect(result.content).toBe("質問いたします。");
  });

  it("副委員長が委員長より優先される", () => {
    const result = parseSpeaker(
      "○ 佐藤 花子 副委員長 ご報告いたします。"
    );
    expect(result.speakerName).toBe("佐藤花子");
    expect(result.speakerRole).toBe("副委員長");
  });

  it("名前に空白を含む場合は除去される", () => {
    const result = parseSpeaker(
      "○村長（竹内　嘉章君）　答弁します。"
    );
    expect(result.speakerName).toBe("竹内嘉章");
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

  it("村長は answer", () => {
    expect(classifyKind("村長")).toBe("answer");
  });

  it("副村長は answer", () => {
    expect(classifyKind("副村長")).toBe("answer");
  });

  it("教育長は answer", () => {
    expect(classifyKind("教育長")).toBe("answer");
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
});

describe("parseStatements", () => {
  it("スペース区切り形式の発言を分割する", () => {
    const text = `
○ 岡村 俊彰 議長 ただいまから本日の会議を開きます。
○ 西笛 千代子 議員 質問があります。
○ 溝渕 孝 村長 お答えします。
`;
    const statements = parseStatements(text);

    expect(statements).toHaveLength(3);

    expect(statements[0]!.kind).toBe("remark");
    expect(statements[0]!.speakerName).toBe("岡村俊彰");
    expect(statements[0]!.speakerRole).toBe("議長");

    expect(statements[1]!.kind).toBe("question");
    expect(statements[1]!.speakerName).toBe("西笛千代子");
    expect(statements[1]!.speakerRole).toBe("議員");

    expect(statements[2]!.kind).toBe("answer");
    expect(statements[2]!.speakerName).toBe("溝渕孝");
    expect(statements[2]!.speakerRole).toBe("村長");
  });

  it("出席表の出欠マーカーをスキップする", () => {
    const text = `1 ○ 2 ○ 3 ○ 4 ○ 5 ○ 6 ○ 7 ○ 8 ○ 9 ○ 10 ○
○ 岡村 俊彰 議長 ただいまから会議を開きます。`;

    const statements = parseStatements(text);
    // 出欠マーカー（短いテキスト）はスキップされ、発言のみ残る
    expect(statements).toHaveLength(1);
    expect(statements[0]!.speakerRole).toBe("議長");
  });

  it("各 statement に contentHash が付与される", () => {
    const statements = parseStatements(
      "○ 岡村 俊彰 議長 テスト発言。"
    );
    expect(statements[0]!.contentHash).toMatch(/^[a-f0-9]{64}$/);
  });

  it("offset が正しく計算される", () => {
    const text = `○ 岡村 俊彰 議長 ただいま。
○ 西笛 千代子 議員 質問です。`;

    const statements = parseStatements(text);

    expect(statements[0]!.startOffset).toBe(0);
    expect(statements[0]!.endOffset).toBe("ただいま。".length);
    expect(statements[1]!.startOffset).toBe("ただいま。".length + 1);
  });

  it("ト書き（登壇）はスキップする", () => {
    const text = `○ 岡村 俊彰 議長 ただいまから会議を開きます。
（３番　有澤由美子君登壇）
○ 西笛 千代子 議員 質問があります。`;

    const statements = parseStatements(text);
    expect(statements).toHaveLength(2);
    expect(statements[0]!.speakerRole).toBe("議長");
    expect(statements[1]!.speakerRole).toBe("議員");
  });

  it("空テキストは空配列を返す", () => {
    expect(parseStatements("")).toEqual([]);
  });
});
