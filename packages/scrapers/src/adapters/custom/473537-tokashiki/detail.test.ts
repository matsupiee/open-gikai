import { describe, expect, it } from "vitest";
import {
  parseSpeaker,
  classifyKind,
  parseStatements,
  parseDateFromPdfText,
} from "./detail";

describe("parseSpeaker", () => {
  it("議長パターンを解析する（名前+役職）", () => {
    const result = parseSpeaker("○　當山清彦議長　ただいまから本日の会議を開きます。");
    expect(result.speakerName).toBe("當山清彦");
    expect(result.speakerRole).toBe("議長");
    expect(result.content).toBe("ただいまから本日の会議を開きます。");
  });

  it("村長パターンを解析する", () => {
    const result = parseSpeaker("○　新里武広村長　お答えいたします。");
    expect(result.speakerName).toBe("新里武広");
    expect(result.speakerRole).toBe("村長");
    expect(result.content).toBe("お答えいたします。");
  });

  it("教育長パターンを解析する（名前中にスペースあり）", () => {
    const result = parseSpeaker("○　金城　満教育長　説明いたします。");
    expect(result.speakerName).toBe("金城満");
    expect(result.speakerRole).toBe("教育長");
    expect(result.content).toBe("説明いたします。");
  });

  it("議員パターン（全角番号）を解析する", () => {
    const result = parseSpeaker("○　３番　玉城保弘議員　質問いたします。");
    expect(result.speakerName).toBe("玉城保弘");
    expect(result.speakerRole).toBe("議員");
    expect(result.content).toBe("質問いたします。");
  });

  it("議員パターン（半角番号）を解析する", () => {
    const result = parseSpeaker("○　3番　玉城保弘議員　発言します。");
    expect(result.speakerName).toBe("玉城保弘");
    expect(result.speakerRole).toBe("議員");
    expect(result.content).toBe("発言します。");
  });

  it("課長パターンを解析する（名前と役職がスペースで区切られている場合）", () => {
    const result = parseSpeaker("○　新垣聡　総務課長　報告いたします。");
    expect(result.speakerName).toBe("新垣聡");
    expect(result.speakerRole).toBe("課長");
    expect(result.content).toBe("報告いたします。");
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

  it("議員は question", () => {
    expect(classifyKind("議員")).toBe("question");
  });

  it("null は remark", () => {
    expect(classifyKind(null)).toBe("remark");
  });
});

describe("parseStatements", () => {
  it("○ マーカーでテキストを発言に分割する", () => {
    const text = `○　當山清彦議長　ただいまから本日の会議を開きます。
○　３番　玉城保弘議員　質問があります。
○　新里武広村長　お答えします。`;

    const statements = parseStatements(text);

    expect(statements).toHaveLength(3);

    expect(statements[0]!.kind).toBe("remark");
    expect(statements[0]!.speakerName).toBe("當山清彦");
    expect(statements[0]!.speakerRole).toBe("議長");

    expect(statements[1]!.kind).toBe("question");
    expect(statements[1]!.speakerName).toBe("玉城保弘");
    expect(statements[1]!.speakerRole).toBe("議員");

    expect(statements[2]!.kind).toBe("answer");
    expect(statements[2]!.speakerName).toBe("新里武広");
    expect(statements[2]!.speakerRole).toBe("村長");
  });

  it("複数行にわたる発言内容を結合する", () => {
    const text = `○　當山清彦議長　ただいまから本日の会議を開きます。
なお、本日の議事日程は配付のとおりです。
よろしくお願いします。
○　新里武広村長　報告します。`;

    const statements = parseStatements(text);

    expect(statements).toHaveLength(2);
    expect(statements[0]!.content).toContain("ただいまから本日の会議を開きます。");
    expect(statements[0]!.content).toContain("なお、本日の議事日程は配付のとおりです。");
  });

  it("各 statement に contentHash が付与される", () => {
    const statements = parseStatements("○　當山清彦議長　テスト発言。");
    expect(statements[0]!.contentHash).toMatch(/^[a-f0-9]{64}$/);
  });

  it("ト書き（登壇）はスキップする", () => {
    const text = `○　當山清彦議長　ただいまから会議を開きます。
○（３番　玉城保弘議員登壇）
○　３番　玉城保弘議員　質問があります。`;

    const statements = parseStatements(text);
    expect(statements).toHaveLength(2);
    expect(statements[0]!.speakerRole).toBe("議長");
    expect(statements[1]!.speakerRole).toBe("議員");
  });

  it("◎ で始まる議事日程見出しはスキップする", () => {
    const text = `◎日程第1　会議録署名議員指名
○　當山清彦議長　日程第1を議題といたします。`;

    const statements = parseStatements(text);
    expect(statements).toHaveLength(1);
    expect(statements[0]!.speakerRole).toBe("議長");
  });

  it("空テキストは空配列を返す", () => {
    expect(parseStatements("")).toEqual([]);
  });
});

describe("parseDateFromPdfText", () => {
  it("令和7年（2025）の日付をパースする", () => {
    expect(
      parseDateFromPdfText("令和７年12月10日(水)午前10時00分"),
    ).toBe("2025-12-10");
  });

  it("令和7年（全角数字）をパースする", () => {
    expect(
      parseDateFromPdfText("令和７年１２月１０日（水曜日）"),
    ).toBe("2025-12-10");
  });

  it("令和6年（2024）の日付をパースする", () => {
    expect(parseDateFromPdfText("令和6年3月4日")).toBe("2024-03-04");
  });

  it("令和元年（2019）をパースする", () => {
    expect(parseDateFromPdfText("令和元年6月3日")).toBe("2019-06-03");
  });

  it("日付が含まれない場合は null を返す", () => {
    expect(parseDateFromPdfText("渡嘉敷村議会定例会会議録")).toBeNull();
  });
});
