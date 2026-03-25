import { describe, it, expect } from "vitest";
import { parseSpeaker, classifyKind, parseStatements, extractHeldOnFromPdfText } from "./detail";

describe("parseSpeaker", () => {
  it("○議　　長 パターンを解析する（スペースあり）", () => {
    const result = parseSpeaker("○議　　長　ただいまの出席議員は９名でございます。");
    expect(result.speakerRole).toBe("議長");
    expect(result.speakerName).toBeNull();
    expect(result.content).toBe("ただいまの出席議員は９名でございます。");
  });

  it("○町　　長 パターンを解析する（スペースあり）", () => {
    const result = parseSpeaker("○町　　長　前回の議会以降における行政上の諸課題について説明します。");
    expect(result.speakerRole).toBe("町長");
    expect(result.speakerName).toBeNull();
    expect(result.content).toBe("前回の議会以降における行政上の諸課題について説明します。");
  });

  it("○４　　番 パターンを議員として解析する", () => {
    const result = parseSpeaker("○４　　番　今説明がありました説明資料の９ページの件です。");
    expect(result.speakerRole).toBe("議員");
    expect(result.speakerName).toBeNull();
    expect(result.content).toBe("今説明がありました説明資料の９ページの件です。");
  });

  it("○議会事務局長 パターンを解析する（スペースなし）", () => {
    const result = parseSpeaker("○議会事務局長　議案第１号、令和６年度湧別町一般会計補正予算。");
    expect(result.speakerRole).toBe("局長");
    expect(result.speakerName).toBeNull();
    expect(result.content).toBe("議案第１号、令和６年度湧別町一般会計補正予算。");
  });

  it("○農政課長 パターンを解析する", () => {
    const result = parseSpeaker("○農政課長　村川議員の質問にお答えします。");
    expect(result.speakerRole).toBe("課長");
    expect(result.speakerName).toBeNull();
    expect(result.content).toBe("村川議員の質問にお答えします。");
  });

  it("○全　　員 パターンを解析する", () => {
    const result = parseSpeaker("○全　　員　（異　議　な　し）");
    expect(result.speakerRole).toBeNull();
    expect(result.speakerName).toBeNull();
    expect(result.content).toBe("（異　議　な　し）");
  });

  it("○副町長 パターンを解析する", () => {
    const result = parseSpeaker("○副町長　お答えします。");
    expect(result.speakerRole).toBe("副町長");
    expect(result.content).toBe("お答えします。");
  });

  it("○教育長 パターンを解析する", () => {
    const result = parseSpeaker("○教育長　ご説明いたします。");
    expect(result.speakerRole).toBe("教育長");
    expect(result.content).toBe("ご説明いたします。");
  });

  it("○副議長 パターンを解析する", () => {
    const result = parseSpeaker("○副議長　ただいまから会議を再開いたします。");
    expect(result.speakerRole).toBe("副議長");
    expect(result.content).toBe("ただいまから会議を再開いたします。");
  });

  it("半角数字の番号議員を解析する", () => {
    const result = parseSpeaker("○4　　番　質問があります。");
    expect(result.speakerRole).toBe("議員");
    expect(result.content).toBe("質問があります。");
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

  it("局長は answer", () => {
    expect(classifyKind("局長")).toBe("answer");
  });

  it("農政課長（課長サフィックス）は answer", () => {
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
  it("○ マーカーでテキストを分割する", () => {
    const text =
      "○議　　長　ただいまから本日の会議を開きます。\n○４　　番　質問があります。\n○町　　長　お答えします。";
    const statements = parseStatements(text);

    expect(statements).toHaveLength(3);

    expect(statements[0]!.kind).toBe("remark");
    expect(statements[0]!.speakerRole).toBe("議長");

    expect(statements[1]!.kind).toBe("question");
    expect(statements[1]!.speakerRole).toBe("議員");

    expect(statements[2]!.kind).toBe("answer");
    expect(statements[2]!.speakerRole).toBe("町長");
  });

  it("各 statement に contentHash が付与される", () => {
    const statements = parseStatements(
      "○議　　長　テスト発言。",
    );
    expect(statements[0]!.contentHash).toMatch(/^[a-f0-9]{64}$/);
  });

  it("contentHash が sha256 の hex 文字列である", () => {
    const statements = parseStatements(
      "○町　　長　説明いたします。内容が長い発言のテストです。",
    );
    expect(statements).toHaveLength(1);
    expect(statements[0]!.contentHash).toHaveLength(64);
    expect(statements[0]!.contentHash).toMatch(/^[0-9a-f]+$/);
  });

  it("offset が正しく計算される", () => {
    const text = "○議　　長　ただいま。\n○４　　番　質問です。";
    const statements = parseStatements(text);

    expect(statements[0]!.startOffset).toBe(0);
    expect(statements[0]!.endOffset).toBe("ただいま。".length);
    expect(statements[1]!.startOffset).toBe("ただいま。".length + 1);
  });

  it("ト書き（登壇）はスキップする", () => {
    const text =
      "○議　　長　ただいまから会議を開きます。\n○（３番　田中君登壇）\n○３　　番　質問があります。";
    const statements = parseStatements(text);
    expect(statements).toHaveLength(2);
    expect(statements[0]!.speakerRole).toBe("議長");
    expect(statements[1]!.speakerRole).toBe("議員");
  });

  it("空テキストは空配列を返す", () => {
    expect(parseStatements("")).toEqual([]);
  });
});

describe("extractHeldOnFromPdfText", () => {
  it("令和の開催日を抽出する", () => {
    const text =
      "令和７年第１回湧別町議会臨時会会議\n令和７年１月１０日湧別町議会議場に招集された。";
    expect(extractHeldOnFromPdfText(text)).toBe("2025-01-10");
  });

  it("全角数字の日付を抽出する", () => {
    const text = "令和６年３月６日湧別町議会議場に招集された。";
    expect(extractHeldOnFromPdfText(text)).toBe("2024-03-06");
  });

  it("日付がない場合は null を返す", () => {
    expect(extractHeldOnFromPdfText("テキストのみ")).toBeNull();
  });
});
