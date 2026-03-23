import { describe, it, expect } from "vitest";
import { parseSpeaker, classifyKind, parseStatements } from "./detail";

describe("parseSpeaker", () => {
  it("議長（名前君）パターンを解析する", () => {
    const result = parseSpeaker(
      "○議長（森下伸吾君）　ただいまから会議を開きます。"
    );
    expect(result.speakerName).toBe("森下伸吾");
    expect(result.speakerRole).toBe("議長");
    expect(result.content).toBe("ただいまから会議を開きます。");
  });

  it("市長（名前君）パターンを解析する", () => {
    const result = parseSpeaker(
      "○市長（平木哲朗君）　お答えいたします。"
    );
    expect(result.speakerName).toBe("平木哲朗");
    expect(result.speakerRole).toBe("市長");
    expect(result.content).toBe("お答えいたします。");
  });

  it("番号議員パターンを解析する", () => {
    const result = parseSpeaker(
      "○５番（阪本久代君）　質問いたします。"
    );
    expect(result.speakerName).toBe("阪本久代");
    expect(result.speakerRole).toBe("議員");
    expect(result.content).toBe("質問いたします。");
  });

  it("教育長パターンを解析する", () => {
    const result = parseSpeaker(
      "○教育長（今田実君）　お答えいたします。"
    );
    expect(result.speakerName).toBe("今田実");
    expect(result.speakerRole).toBe("教育長");
    expect(result.content).toBe("お答えいたします。");
  });

  it("部長パターンを解析する", () => {
    const result = parseSpeaker(
      "○総合政策部長（井上稔章君）　お答えします。"
    );
    expect(result.speakerName).toBe("井上稔章");
    expect(result.speakerRole).toBe("部長");
    expect(result.content).toBe("お答えします。");
  });

  it("副市長パターンを解析する", () => {
    const result = parseSpeaker(
      "○副市長（小原秀紀君）　ご説明します。"
    );
    expect(result.speakerName).toBe("小原秀紀");
    expect(result.speakerRole).toBe("副市長");
    expect(result.content).toBe("ご説明します。");
  });

  it("危機管理監パターンを解析する", () => {
    const result = parseSpeaker(
      "○危機管理監（大岡久子君）　お答えいたします。"
    );
    expect(result.speakerName).toBe("大岡久子");
    expect(result.speakerRole).toBe("危機管理監");
    expect(result.content).toBe("お答えいたします。");
  });

  it("課長パターンを解析する", () => {
    const result = parseSpeaker(
      "○財政課長（三嶋信史君）　ご説明いたします。"
    );
    expect(result.speakerName).toBe("三嶋信史");
    expect(result.speakerRole).toBe("課長");
    expect(result.content).toBe("ご説明いたします。");
  });

  it("名前に空白を含む場合は除去される", () => {
    const result = parseSpeaker(
      "○市長（平木　哲朗君）　答弁します。"
    );
    expect(result.speakerName).toBe("平木哲朗");
  });

  it("○ マーカーなしのテキスト", () => {
    const result = parseSpeaker("午前９時30分 開議");
    expect(result.speakerName).toBeNull();
    expect(result.speakerRole).toBeNull();
    expect(result.content).toBe("午前９時30分 開議");
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

  it("危機管理監は answer", () => {
    expect(classifyKind("危機管理監")).toBe("answer");
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
    const text = `
○議長（森下伸吾君）　ただいまから本日の会議を開きます。
○５番（阪本久代君）　質問があります。
○市長（平木哲朗君）　お答えします。
`;
    const statements = parseStatements(text);

    expect(statements).toHaveLength(3);

    expect(statements[0]!.kind).toBe("remark");
    expect(statements[0]!.speakerName).toBe("森下伸吾");
    expect(statements[0]!.speakerRole).toBe("議長");

    expect(statements[1]!.kind).toBe("question");
    expect(statements[1]!.speakerName).toBe("阪本久代");
    expect(statements[1]!.speakerRole).toBe("議員");

    expect(statements[2]!.kind).toBe("answer");
    expect(statements[2]!.speakerName).toBe("平木哲朗");
    expect(statements[2]!.speakerRole).toBe("市長");
  });

  it("各 statement に contentHash が付与される", () => {
    const statements = parseStatements(
      "○議長（森下伸吾君）　テスト発言。"
    );
    expect(statements[0]!.contentHash).toMatch(/^[a-f0-9]{64}$/);
  });

  it("offset が正しく計算される", () => {
    const text = `○議長（森下伸吾君）　ただいま。
○５番（阪本久代君）　質問です。`;

    const statements = parseStatements(text);

    expect(statements[0]!.startOffset).toBe(0);
    expect(statements[0]!.endOffset).toBe("ただいま。".length);
    expect(statements[1]!.startOffset).toBe("ただいま。".length + 1);
  });

  it("ト書き（登壇）はスキップする", () => {
    const text = `○議長（森下伸吾君）　ただいまから会議を開きます。
〔市長（平木哲朗君）登壇〕
○市長（平木哲朗君）　お答えします。`;

    const statements = parseStatements(text);
    expect(statements).toHaveLength(2);
    expect(statements[0]!.speakerRole).toBe("議長");
    expect(statements[1]!.speakerRole).toBe("市長");
  });

  it("空テキストは空配列を返す", () => {
    expect(parseStatements("")).toEqual([]);
  });

  it("部長職の答弁を正しく分類する", () => {
    const text = `○総合政策部長（井上稔章君）　お答えします。
○建設部長（西前克彦君）　ご説明いたします。`;

    const statements = parseStatements(text);

    expect(statements).toHaveLength(2);
    expect(statements[0]!.kind).toBe("answer");
    expect(statements[0]!.speakerRole).toBe("部長");
    expect(statements[1]!.kind).toBe("answer");
    expect(statements[1]!.speakerRole).toBe("部長");
  });
});
