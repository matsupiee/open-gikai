import { describe, it, expect } from "vitest";
import { parseSpeaker, classifyKind, parseStatements } from "./detail";

describe("parseSpeaker", () => {
  it("議長（全角スペースあり）パターンを解析する", () => {
    // 役職の「議　長」（全角スペース）は "議長" に正規化される
    const result = parseSpeaker("議　長（小林　洋君）　おはようございます。");
    expect(result.speakerName).toBe("小林洋");
    expect(result.speakerRole).toBe("議長");
    expect(result.content).toBe("おはようございます。");
  });

  it("町長パターンを解析する", () => {
    const result = parseSpeaker("町　長（阿部賢一君）　皆さん、おはようございます。");
    expect(result.speakerName).toBe("阿部賢一");
    expect(result.speakerRole).toBe("町長");
    expect(result.content).toBe("皆さん、おはようございます。");
  });

  it("副町長パターンを解析する", () => {
    const result = parseSpeaker("副町長（田中一郎君）　ご報告いたします。");
    expect(result.speakerName).toBe("田中一郎");
    expect(result.speakerRole).toBe("副町長");
    expect(result.content).toBe("ご報告いたします。");
  });

  it("教育長パターンを解析する", () => {
    const result = parseSpeaker("教育長（山田太郎君）　お答えいたします。");
    expect(result.speakerName).toBe("山田太郎");
    expect(result.speakerRole).toBe("教育長");
    expect(result.content).toBe("お答えいたします。");
  });

  it("課長パターンを解析する（総務課長 → 課長）", () => {
    const result = parseSpeaker("総務課長（鈴木一郎君）　ご説明いたします。");
    expect(result.speakerName).toBe("鈴木一郎");
    expect(result.speakerRole).toBe("課長");
    expect(result.content).toBe("ご説明いたします。");
  });

  it("副委員長は委員長と区別される", () => {
    const result = parseSpeaker("副委員長（田中花子君）　ご報告いたします。");
    expect(result.speakerName).toBe("田中花子");
    expect(result.speakerRole).toBe("副委員長");
    expect(result.content).toBe("ご報告いたします。");
  });

  it("委員長パターンを解析する", () => {
    const result = parseSpeaker("総務常任委員会委員長（佐藤一君）　ご報告いたします。");
    expect(result.speakerName).toBe("佐藤一");
    expect(result.speakerRole).toBe("委員長");
    expect(result.content).toBe("ご報告いたします。");
  });

  it("名前の全角スペースを除去する", () => {
    const result = parseSpeaker("議長（小林　洋君）　開会します。");
    expect(result.speakerName).toBe("小林洋");
  });

  it("番号議員パターンを解析する", () => {
    const result = parseSpeaker("3番（石坂武君）　質問いたします。");
    expect(result.speakerName).toBe("石坂武");
    expect(result.speakerRole).toBe("議員");
    expect(result.content).toBe("質問いたします。");
  });

  it("発言者パターンに合致しない行", () => {
    const result = parseSpeaker("午前10時開議");
    expect(result.speakerName).toBeNull();
    expect(result.speakerRole).toBeNull();
    expect(result.content).toBe("午前10時開議");
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
  it("発言者パターンでテキストを分割する", () => {
    const text = [
      "議　長（小林　洋君）　ただいまから本日の会議を開きます。",
      "3番（石坂武君）　質問があります。",
      "町　長（阿部賢一君）　お答えします。",
    ].join("\n");

    const statements = parseStatements(text);

    expect(statements).toHaveLength(3);

    expect(statements[0]!.kind).toBe("remark");
    expect(statements[0]!.speakerName).toBe("小林洋");
    expect(statements[0]!.speakerRole).toBe("議長");
    expect(statements[0]!.content).toBe("ただいまから本日の会議を開きます。");

    expect(statements[1]!.kind).toBe("question");
    expect(statements[1]!.speakerName).toBe("石坂武");
    expect(statements[1]!.speakerRole).toBe("議員");

    expect(statements[2]!.kind).toBe("answer");
    expect(statements[2]!.speakerName).toBe("阿部賢一");
    expect(statements[2]!.speakerRole).toBe("町長");
  });

  it("各 statement に contentHash が付与される", () => {
    const statements = parseStatements(
      "議長（小林洋君）　テスト発言。",
    );
    expect(statements[0]!.contentHash).toMatch(/^[a-f0-9]{64}$/);
  });

  it("offset が正しく計算される", () => {
    const text = [
      "議長（小林洋君）　ただいま。",
      "3番（石坂武君）　質問です。",
    ].join("\n");

    const statements = parseStatements(text);

    expect(statements[0]!.startOffset).toBe(0);
    expect(statements[0]!.endOffset).toBe("ただいま。".length);
    expect(statements[1]!.startOffset).toBe("ただいま。".length + 1);
  });

  it("登壇のト書きはスキップする", () => {
    const text = [
      "議長（小林洋君）　ただいまから会議を開きます。",
      "（町長　阿部賢一君登壇）",
      "町長（阿部賢一君）　お答えします。",
    ].join("\n");

    const statements = parseStatements(text);
    expect(statements).toHaveLength(2);
    expect(statements[0]!.speakerRole).toBe("議長");
    expect(statements[1]!.speakerRole).toBe("町長");
  });

  it("◇ で始まる一般質問者リスト行はスキップする", () => {
    const text = [
      "◇　石坂　武　君・・・１．町長、公約実現への取り組み",
      "◇　鈴木美香　君・・・１．アピアランスケア事業の周知と柔軟な対応を",
      "議長（小林洋君）　開会します。",
    ].join("\n");

    const statements = parseStatements(text);
    expect(statements).toHaveLength(1);
    expect(statements[0]!.speakerRole).toBe("議長");
  });

  it("継続行が前の発言に結合される", () => {
    const text = [
      "議長（小林洋君）　ただいまから",
      "会議を開きます。",
      "町長（阿部賢一君）　お答えします。",
    ].join("\n");

    const statements = parseStatements(text);

    expect(statements).toHaveLength(2);
    expect(statements[0]!.content).toContain("ただいまから");
    expect(statements[0]!.content).toContain("会議を開きます。");
  });

  it("空テキストは空配列を返す", () => {
    expect(parseStatements("")).toEqual([]);
  });
});
