import { describe, it, expect } from "vitest";
import { parseSpeaker, classifyKind, parseStatements } from "./detail";

describe("parseSpeaker", () => {
  it("議長パターンを解析する（名前＋議長）", () => {
    const result = parseSpeaker("○菅野明議長　ただいまより本日の会議を開きます。");
    expect(result.speakerName).toBe("菅野明");
    expect(result.speakerRole).toBe("議長");
    expect(result.content).toBe("ただいまより本日の会議を開きます。");
  });

  it("市長パターンを解析する", () => {
    const result = parseSpeaker("○内谷重治市長　お答えいたします。");
    expect(result.speakerName).toBe("内谷重治");
    expect(result.speakerRole).toBe("市長");
    expect(result.content).toBe("お答えいたします。");
  });

  it("番号＋括弧付き議員パターンを解析する", () => {
    const result = parseSpeaker("○５番（鈴木 浩議員）　質問します。");
    expect(result.speakerName).toBe("鈴木浩");
    expect(result.speakerRole).toBe("議員");
    expect(result.content).toBe("質問します。");
  });

  it("半角番号の議員パターンを解析する", () => {
    const result = parseSpeaker("○12番（山田太郎議員）　一般質問を行います。");
    expect(result.speakerName).toBe("山田太郎");
    expect(result.speakerRole).toBe("議員");
    expect(result.content).toBe("一般質問を行います。");
  });

  it("課長パターンを解析する（名前＋部署名＋課長）", () => {
    const result = parseSpeaker("○高橋俊樹建設課長　お答えいたします。");
    expect(result.speakerName).toBe("高橋俊樹建設");
    expect(result.speakerRole).toBe("課長");
    expect(result.content).toBe("お答えいたします。");
  });

  it("副市長パターンを解析する", () => {
    const result = parseSpeaker("○佐藤一郎副市長　御説明いたします。");
    expect(result.speakerName).toBe("佐藤一郎");
    expect(result.speakerRole).toBe("副市長");
    expect(result.content).toBe("御説明いたします。");
  });

  it("事務局長パターンを解析する", () => {
    const result = parseSpeaker("○田中幸雄事務局長　お名前をお呼びいたします。");
    expect(result.speakerName).toBe("田中幸雄");
    expect(result.speakerRole).toBe("事務局長");
    expect(result.content).toBe("お名前をお呼びいたします。");
  });

  it("マーカーなしの場合は content のみ", () => {
    const result = parseSpeaker("議事日程第１号が配布されております。");
    expect(result.speakerName).toBeNull();
    expect(result.speakerRole).toBeNull();
    expect(result.content).toBe("議事日程第１号が配布されております。");
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

  it("議員は question", () => {
    expect(classifyKind("議員")).toBe("question");
  });

  it("市長は answer", () => {
    expect(classifyKind("市長")).toBe("answer");
  });

  it("副市長は answer", () => {
    expect(classifyKind("副市長")).toBe("answer");
  });

  it("課長は answer", () => {
    expect(classifyKind("課長")).toBe("answer");
  });

  it("事務局長は answer", () => {
    expect(classifyKind("事務局長")).toBe("answer");
  });

  it("null は remark", () => {
    expect(classifyKind(null)).toBe("remark");
  });
});

describe("parseStatements", () => {
  it("○ マーカーでテキストを分割する", () => {
    const text = `
○菅野明議長　ただいまより本日の会議を開きます。
○５番（鈴木 浩議員）　質問があります。
○内谷重治市長　お答えします。
`;
    const statements = parseStatements(text);

    expect(statements.length).toBe(3);

    expect(statements[0]!.kind).toBe("remark");
    expect(statements[0]!.speakerName).toBe("菅野明");
    expect(statements[0]!.speakerRole).toBe("議長");

    expect(statements[1]!.kind).toBe("question");
    expect(statements[1]!.speakerName).toBe("鈴木浩");
    expect(statements[1]!.speakerRole).toBe("議員");

    expect(statements[2]!.kind).toBe("answer");
    expect(statements[2]!.speakerName).toBe("内谷重治");
    expect(statements[2]!.speakerRole).toBe("市長");
  });

  it("各 statement に contentHash が付与される", () => {
    const statements = parseStatements("○菅野明議長　テスト発言。");
    expect(statements[0]!.contentHash).toMatch(/^[a-f0-9]{64}$/);
  });

  it("offset が正しく計算される", () => {
    const statements = parseStatements(
      "○菅野明議長　開会。\n○内谷重治市長　答弁。",
    );
    expect(statements[0]!.startOffset).toBe(0);
    expect(statements[0]!.endOffset).toBe(3);
    expect(statements[1]!.startOffset).toBe(4);
    expect(statements[1]!.endOffset).toBe(7);
  });

  it("空テキストは空配列を返す", () => {
    expect(parseStatements("")).toEqual([]);
  });

  it("○ マーカーがないテキストはスキップする", () => {
    const statements = parseStatements("議事日程が配布されました。");
    expect(statements.length).toBe(0);
  });
});
