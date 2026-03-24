import { describe, it, expect } from "vitest";
import { parseSpeaker, classifyKind, parseStatements } from "./detail";

describe("parseSpeaker", () => {
  it("議長（名前）パターンを解析する（能登町形式）", () => {
    const result = parseSpeaker("議長（金七祐太郎）　ただいまから会議を開きます。");
    expect(result.speakerName).toBe("金七祐太郎");
    expect(result.speakerRole).toBe("議長");
    expect(result.content).toBe("ただいまから会議を開きます。");
  });

  it("町長（名前）パターンを解析する", () => {
    const result = parseSpeaker("町長（大森凡世）　お答えいたします。");
    expect(result.speakerName).toBe("大森凡世");
    expect(result.speakerRole).toBe("町長");
    expect(result.content).toBe("お答えいたします。");
  });

  it("番号議員パターンを解析する（能登町形式）", () => {
    const result = parseSpeaker("６番（金七祐太郎）　質問いたします。");
    expect(result.speakerName).toBe("金七祐太郎");
    expect(result.speakerRole).toBe("議員");
    expect(result.content).toBe("質問いたします。");
  });

  it("教育長パターンを解析する", () => {
    const result = parseSpeaker("教育長（佐藤一郎）　お答えいたします。");
    expect(result.speakerName).toBe("佐藤一郎");
    expect(result.speakerRole).toBe("教育長");
    expect(result.content).toBe("お答えいたします。");
  });

  it("課長パターンを解析する", () => {
    const result = parseSpeaker("総務課長（蔭田大介）　ご説明いたします。");
    expect(result.speakerName).toBe("蔭田大介");
    expect(result.speakerRole).toBe("課長");
    expect(result.content).toBe("ご説明いたします。");
  });

  it("副町長パターンを解析する", () => {
    const result = parseSpeaker("副町長（伊藤二郎）　ご報告いたします。");
    expect(result.speakerName).toBe("伊藤二郎");
    expect(result.speakerRole).toBe("副町長");
    expect(result.content).toBe("ご報告いたします。");
  });

  it("委員長パターンを解析する", () => {
    const result = parseSpeaker("総務常任委員会委員長（中村三郎）　ご報告いたします。");
    expect(result.speakerName).toBe("中村三郎");
    expect(result.speakerRole).toBe("委員長");
    expect(result.content).toBe("ご報告いたします。");
  });

  it("副委員長は委員長より先にマッチする", () => {
    const result = parseSpeaker("副委員長（小林四郎）　報告いたします。");
    expect(result.speakerRole).toBe("副委員長");
  });

  it("名前に空白を含む場合は除去される", () => {
    const result = parseSpeaker("町長（大森　凡世）　答弁します。");
    expect(result.speakerName).toBe("大森凡世");
  });

  it("○ マーカー付きパターンも解析する（旧形式）", () => {
    const result = parseSpeaker("○議長（山田太郎君）　ただいまから会議を開きます。");
    expect(result.speakerName).toBe("山田太郎");
    expect(result.speakerRole).toBe("議長");
    expect(result.content).toBe("ただいまから会議を開きます。");
  });

  it("副議長パターンを解析する", () => {
    const result = parseSpeaker("副議長（小路政敏）　休憩前に引き続き会議を開きます。");
    expect(result.speakerName).toBe("小路政敏");
    expect(result.speakerRole).toBe("副議長");
    expect(result.content).toBe("休憩前に引き続き会議を開きます。");
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
});

describe("parseStatements", () => {
  it("能登町形式（マーカーなし）でテキストを分割する", () => {
    const text =
      "議長（金七祐太郎）　ただいまから本日の会議を開きます。" +
      "６番（田中花子）　質問があります。" +
      "町長（大森凡世）　お答えします。";
    const statements = parseStatements(text);

    expect(statements.length).toBeGreaterThanOrEqual(3);

    const chairman = statements.find((s) => s.speakerRole === "議長");
    expect(chairman).toBeDefined();
    expect(chairman!.speakerName).toBe("金七祐太郎");
    expect(chairman!.kind).toBe("remark");

    const member = statements.find((s) => s.speakerRole === "議員");
    expect(member).toBeDefined();
    expect(member!.speakerName).toBe("田中花子");
    expect(member!.kind).toBe("question");

    const mayor = statements.find((s) => s.speakerRole === "町長");
    expect(mayor).toBeDefined();
    expect(mayor!.speakerName).toBe("大森凡世");
    expect(mayor!.kind).toBe("answer");
  });

  it("○ マーカー付き形式でテキストを分割する（旧形式）", () => {
    const text = `
○議長（山田太郎君）　ただいまから本日の会議を開きます。
○３番（田中花子君）　質問があります。
○町長（鈴木次郎君）　お答えします。
`;
    const statements = parseStatements(text);

    expect(statements).toHaveLength(3);

    expect(statements[0]!.kind).toBe("remark");
    expect(statements[0]!.speakerName).toBe("山田太郎");
    expect(statements[0]!.speakerRole).toBe("議長");

    expect(statements[1]!.kind).toBe("question");
    expect(statements[1]!.speakerName).toBe("田中花子");
    expect(statements[1]!.speakerRole).toBe("議員");

    expect(statements[2]!.kind).toBe("answer");
    expect(statements[2]!.speakerName).toBe("鈴木次郎");
    expect(statements[2]!.speakerRole).toBe("町長");
  });

  it("各 statement に contentHash が付与される", () => {
    const text =
      "議長（金七祐太郎）　テスト発言。" +
      "町長（大森凡世）　お答えします。";
    const statements = parseStatements(text);
    expect(statements.length).toBeGreaterThan(0);
    expect(statements[0]!.contentHash).toMatch(/^[a-f0-9]{64}$/);
  });

  it("空テキストは空配列を返す", () => {
    expect(parseStatements("")).toEqual([]);
  });

  it("課長の発言は answer に分類される", () => {
    const text =
      "総務課長（蔭田大介）　ご説明します。" +
      "町長（大森凡世）　以上です。";
    const statements = parseStatements(text);
    const kacho = statements.find((s) => s.speakerRole === "課長");
    expect(kacho).toBeDefined();
    expect(kacho!.kind).toBe("answer");
  });
});
