import { describe, expect, it } from "vitest";
import {
  parseSpeaker,
  classifyKind,
  parseStatements,
  parseDateFromPdfText,
} from "./detail";

describe("parseSpeaker", () => {
  it("議長パターンを解析する（名前+役職）", () => {
    const result = parseSpeaker("○　金城武弘議長　ただいまから本日の会議を開きます。");
    expect(result.speakerName).toBe("金城武弘");
    expect(result.speakerRole).toBe("議長");
    expect(result.content).toBe("ただいまから本日の会議を開きます。");
  });

  it("村長パターンを解析する", () => {
    const result = parseSpeaker("○　座間味尚村長　お答えいたします。");
    expect(result.speakerName).toBe("座間味尚");
    expect(result.speakerRole).toBe("村長");
    expect(result.content).toBe("お答えいたします。");
  });

  it("教育長パターンを解析する（名前中にスペースあり）", () => {
    const result = parseSpeaker("○　新城　博教育長　説明いたします。");
    expect(result.speakerName).toBe("新城博");
    expect(result.speakerRole).toBe("教育長");
    expect(result.content).toBe("説明いたします。");
  });

  it("議員パターン（全角番号）を解析する", () => {
    const result = parseSpeaker("○　３番　宮城清議員　質問いたします。");
    expect(result.speakerName).toBe("宮城清");
    expect(result.speakerRole).toBe("議員");
    expect(result.content).toBe("質問いたします。");
  });

  it("議員パターン（半角番号）を解析する", () => {
    const result = parseSpeaker("○　5番　古謝誠議員　発言します。");
    expect(result.speakerName).toBe("古謝誠");
    expect(result.speakerRole).toBe("議員");
    expect(result.content).toBe("発言します。");
  });

  it("課長パターンを解析する（名前と役職がスペースで区切られている場合）", () => {
    const result = parseSpeaker("○　宮城英次　総務課長　報告いたします。");
    expect(result.speakerName).toBe("宮城英次");
    expect(result.speakerRole).toBe("課長");
    expect(result.content).toBe("報告いたします。");
  });

  it("副議長パターンを解析する", () => {
    const result = parseSpeaker("○　渡嘉敷優子副議長　発言を許可します。");
    expect(result.speakerName).toBe("渡嘉敷優子");
    expect(result.speakerRole).toBe("副議長");
    expect(result.content).toBe("発言を許可します。");
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

  it("議員は question", () => {
    expect(classifyKind("議員")).toBe("question");
  });

  it("null は remark", () => {
    expect(classifyKind(null)).toBe("remark");
  });
});

describe("parseStatements", () => {
  it("○ マーカーでテキストを発言に分割する", () => {
    const text = `○　金城武弘議長　ただいまから本日の会議を開きます。
○　３番　宮城清議員　質問があります。
○　座間味尚村長　お答えします。`;

    const statements = parseStatements(text);

    expect(statements).toHaveLength(3);

    expect(statements[0]!.kind).toBe("remark");
    expect(statements[0]!.speakerName).toBe("金城武弘");
    expect(statements[0]!.speakerRole).toBe("議長");

    expect(statements[1]!.kind).toBe("question");
    expect(statements[1]!.speakerName).toBe("宮城清");
    expect(statements[1]!.speakerRole).toBe("議員");

    expect(statements[2]!.kind).toBe("answer");
    expect(statements[2]!.speakerName).toBe("座間味尚");
    expect(statements[2]!.speakerRole).toBe("村長");
  });

  it("複数行にわたる発言内容を結合する", () => {
    const text = `○　金城武弘議長　ただいまから本日の会議を開きます。
なお、本日の議事日程は配付のとおりです。
よろしくお願いします。
○　座間味尚村長　報告します。`;

    const statements = parseStatements(text);

    expect(statements).toHaveLength(2);
    expect(statements[0]!.content).toContain("ただいまから本日の会議を開きます。");
    expect(statements[0]!.content).toContain("なお、本日の議事日程は配付のとおりです。");
  });

  it("各 statement に contentHash が付与される", () => {
    const statements = parseStatements("○　金城武弘議長　テスト発言。");
    expect(statements[0]!.contentHash).toMatch(/^[a-f0-9]{64}$/);
  });

  it("ト書き（登壇）はスキップする", () => {
    const text = `○　金城武弘議長　ただいまから会議を開きます。
○（３番　宮城清議員登壇）
○　３番　宮城清議員　質問があります。`;

    const statements = parseStatements(text);
    expect(statements).toHaveLength(2);
    expect(statements[0]!.speakerRole).toBe("議長");
    expect(statements[1]!.speakerRole).toBe("議員");
  });

  it("◎ で始まる議事日程見出しはスキップする", () => {
    const text = `◎日程第1　会議録署名議員指名
○　金城武弘議長　日程第1を議題といたします。`;

    const statements = parseStatements(text);
    expect(statements).toHaveLength(1);
    expect(statements[0]!.speakerRole).toBe("議長");
  });

  it("空テキストは空配列を返す", () => {
    expect(parseStatements("")).toEqual([]);
  });
});

describe("parseDateFromPdfText", () => {
  it("令和6年12月16日をパースする", () => {
    expect(parseDateFromPdfText("令和６年12月16日(火)午前10時00分")).toBe(
      "2024-12-16",
    );
  });

  it("全角数字をパースする", () => {
    expect(parseDateFromPdfText("令和６年１２月１６日（火曜日）")).toBe(
      "2024-12-16",
    );
  });

  it("令和7年（2025）の日付をパースする", () => {
    expect(parseDateFromPdfText("令和7年3月4日")).toBe("2025-03-04");
  });

  it("令和元年（2019）をパースする", () => {
    expect(parseDateFromPdfText("令和元年6月3日")).toBe("2019-06-03");
  });

  it("平成25年をパースする", () => {
    expect(parseDateFromPdfText("平成25年3月8日(木)午前10時00分")).toBe(
      "2013-03-08",
    );
  });

  it("日付が含まれない場合は null を返す", () => {
    expect(parseDateFromPdfText("座間味村議会定例会会議録")).toBeNull();
  });
});
