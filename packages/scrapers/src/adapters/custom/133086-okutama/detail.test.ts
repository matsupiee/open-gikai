import { describe, it, expect } from "vitest";
import { parseSpeaker, classifyKind, parseStatements } from "./detail";

describe("parseSpeaker", () => {
  it("議長パターンを解析する", () => {
    const result = parseSpeaker("〇議長（田中一郎君）　ただいまから本日の会議を開きます。");
    expect(result.speakerName).toBe("田中一郎");
    expect(result.speakerRole).toBe("議長");
    expect(result.content).toBe("ただいまから本日の会議を開きます。");
  });

  it("町長パターンを解析する", () => {
    const result = parseSpeaker("〇町長（鈴木次郎君）　お答えいたします。");
    expect(result.speakerName).toBe("鈴木次郎");
    expect(result.speakerRole).toBe("町長");
    expect(result.content).toBe("お答えいたします。");
  });

  it("副町長パターンを解析する", () => {
    const result = parseSpeaker("〇副町長（山田太郎君）　ご報告いたします。");
    expect(result.speakerName).toBe("山田太郎");
    expect(result.speakerRole).toBe("副町長");
    expect(result.content).toBe("ご報告いたします。");
  });

  it("教育長パターンを解析する", () => {
    const result = parseSpeaker("〇教育長（佐藤花子君）　お答えします。");
    expect(result.speakerName).toBe("佐藤花子");
    expect(result.speakerRole).toBe("教育長");
    expect(result.content).toBe("お答えします。");
  });

  it("課長パターンを解析する（総務課長 → 課長）", () => {
    const result = parseSpeaker("〇総務課長（高橋五郎君）　ご説明いたします。");
    expect(result.speakerName).toBe("高橋五郎");
    expect(result.speakerRole).toBe("課長");
    expect(result.content).toBe("ご説明いたします。");
  });

  it("番号付き議員パターンを解析する", () => {
    const result = parseSpeaker("〇3番（佐藤花子君）　質問があります。");
    expect(result.speakerName).toBe("佐藤花子");
    expect(result.speakerRole).toBe("議員");
    expect(result.content).toBe("質問があります。");
  });

  it("副委員長は委員長と区別される", () => {
    const result = parseSpeaker("〇副委員長（鈴木一君）　ご報告いたします。");
    expect(result.speakerName).toBe("鈴木一");
    expect(result.speakerRole).toBe("副委員長");
    expect(result.content).toBe("ご報告いたします。");
  });

  it("委員長パターンを解析する", () => {
    const result = parseSpeaker("〇予算特別委員会委員長（田中二郎君）　報告いたします。");
    expect(result.speakerName).toBe("田中二郎");
    expect(result.speakerRole).toBe("委員長");
    expect(result.content).toBe("報告いたします。");
  });

  it("名前の全角スペースを除去する", () => {
    const result = parseSpeaker("〇議長（田中　一郎君）　開会します。");
    expect(result.speakerName).toBe("田中一郎");
  });

  it("事務局長パターンを解析する", () => {
    const result = parseSpeaker("〇事務局長（木村三郎君）　ご案内いたします。");
    expect(result.speakerName).toBe("木村三郎");
    expect(result.speakerRole).toBe("事務局長");
    expect(result.content).toBe("ご案内いたします。");
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

  it("事務局長は answer", () => {
    expect(classifyKind("事務局長")).toBe("answer");
  });

  it("議員は question", () => {
    expect(classifyKind("議員")).toBe("question");
  });

  it("null は remark", () => {
    expect(classifyKind(null)).toBe("remark");
  });
});

describe("parseStatements", () => {
  it("発言者パターンでテキストを分割する", () => {
    const text = [
      "〇議長（田中一郎君）　ただいまから本日の会議を開きます。",
      "〇3番（佐藤花子君）　質問があります。",
      "〇町長（鈴木次郎君）　お答えいたします。",
    ].join("\n");

    const statements = parseStatements(text);

    expect(statements).toHaveLength(3);

    expect(statements[0]!.kind).toBe("remark");
    expect(statements[0]!.speakerName).toBe("田中一郎");
    expect(statements[0]!.speakerRole).toBe("議長");
    expect(statements[0]!.content).toBe("ただいまから本日の会議を開きます。");

    expect(statements[1]!.kind).toBe("question");
    expect(statements[1]!.speakerName).toBe("佐藤花子");
    expect(statements[1]!.speakerRole).toBe("議員");

    expect(statements[2]!.kind).toBe("answer");
    expect(statements[2]!.speakerName).toBe("鈴木次郎");
    expect(statements[2]!.speakerRole).toBe("町長");
  });

  it("各 statement に contentHash が付与される", () => {
    const statements = parseStatements(
      "〇議長（田中一郎君）　テスト発言。",
    );
    expect(statements[0]!.contentHash).toMatch(/^[a-f0-9]{64}$/);
  });

  it("offset が正しく計算される", () => {
    const text = [
      "〇議長（田中一郎君）　ただいま。",
      "〇3番（佐藤花子君）　質問です。",
    ].join("\n");

    const statements = parseStatements(text);

    expect(statements[0]!.startOffset).toBe(0);
    expect(statements[0]!.endOffset).toBe("ただいま。".length);
    expect(statements[1]!.startOffset).toBe("ただいま。".length + 1);
  });

  it("議事日程見出しはスキップする", () => {
    const text = [
      "〇議事日程 第1 開会",
      "〇議長（田中一郎君）　ただいまから会議を開きます。",
    ].join("\n");

    const statements = parseStatements(text);
    expect(statements).toHaveLength(1);
    expect(statements[0]!.speakerRole).toBe("議長");
  });

  it("出席議員リストはスキップする", () => {
    const text = [
      "〇出席議員（8名）",
      "〇議長（田中一郎君）　開会します。",
    ].join("\n");

    const statements = parseStatements(text);
    expect(statements).toHaveLength(1);
    expect(statements[0]!.speakerRole).toBe("議長");
  });

  it("登壇のト書きはスキップする", () => {
    const text = [
      "〇議長（田中一郎君）　ただいまから会議を開きます。",
      "〇（町長　鈴木次郎君登壇）",
      "〇町長（鈴木次郎君）　お答えします。",
    ].join("\n");

    const statements = parseStatements(text);
    // 登壇ト書きがスキップされ、content が空なブロックは除外
    expect(statements.some((s) => s.speakerRole === "議長")).toBe(true);
    expect(statements.some((s) => s.speakerRole === "町長")).toBe(true);
  });

  it("空テキストは空配列を返す", () => {
    expect(parseStatements("")).toEqual([]);
  });

  it("〇 マーカーがない場合は空配列を返す", () => {
    expect(parseStatements("発言テキストがあるがマーカーなし")).toEqual([]);
  });
});
