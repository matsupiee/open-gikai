import { describe, it, expect } from "vitest";
import { parseSpeaker, classifyKind, parseStatements } from "./detail";

describe("parseSpeaker", () => {
  it("議長（名前君）パターンを解析する", () => {
    const result = parseSpeaker(
      "○議長（若山隆史君）　それでは、ただいまから会議を開きます。"
    );
    expect(result.speakerName).toBe("若山隆史");
    expect(result.speakerRole).toBe("議長");
    expect(result.content).toBe("それでは、ただいまから会議を開きます。");
  });

  it("町長（名前君）パターンを解析する", () => {
    const result = parseSpeaker(
      "○町長（早野博文君）　お答えいたします。"
    );
    expect(result.speakerName).toBe("早野博文");
    expect(result.speakerRole).toBe("町長");
    expect(result.content).toBe("お答えいたします。");
  });

  it("全角番号付き議員パターンを解析する", () => {
    const result = parseSpeaker(
      "○３番（水野忠宗君）　質問いたします。"
    );
    expect(result.speakerName).toBe("水野忠宗");
    expect(result.speakerRole).toBe("議員");
    expect(result.content).toBe("質問いたします。");
  });

  it("２桁全角番号の議員パターンを解析する", () => {
    const result = parseSpeaker(
      "○１２番（中村ひとみ君）　一般質問を行います。"
    );
    expect(result.speakerName).toBe("中村ひとみ");
    expect(result.speakerRole).toBe("議員");
    expect(result.content).toBe("一般質問を行います。");
  });

  it("課長パターンを解析する（役職名が前置）", () => {
    const result = parseSpeaker(
      "○総務課長（藤塚正博君）　ご説明いたします。"
    );
    expect(result.speakerName).toBe("藤塚正博");
    expect(result.speakerRole).toBe("課長");
    expect(result.content).toBe("ご説明いたします。");
  });

  it("副町長パターンを解析する", () => {
    const result = parseSpeaker(
      "○副町長（山田次郎君）　お答えします。"
    );
    expect(result.speakerName).toBe("山田次郎");
    expect(result.speakerRole).toBe("副町長");
    expect(result.content).toBe("お答えします。");
  });

  it("教育次長兼課長パターンを解析する", () => {
    const result = parseSpeaker(
      "○教育次長兼学校教育課長（小川裕司君）　ご報告します。"
    );
    expect(result.speakerName).toBe("小川裕司");
    expect(result.speakerRole).toBe("課長");
    expect(result.content).toBe("ご報告します。");
  });

  it("名前に空白を含む場合は除去される", () => {
    const result = parseSpeaker(
      "○町長（早野　博文君）　答弁します。"
    );
    expect(result.speakerName).toBe("早野博文");
  });

  it("○ マーカーなしのテキスト", () => {
    const result = parseSpeaker("午前９時開議");
    expect(result.speakerName).toBeNull();
    expect(result.speakerRole).toBeNull();
    expect(result.content).toBe("午前９時開議");
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
  it("○ マーカーでテキストを分割する", () => {
    const text = `
○議長（若山隆史君）　ただいまから本日の会議を開きます。
○３番（水野忠宗君）　質問があります。
○町長（早野博文君）　お答えします。
`;
    const statements = parseStatements(text);

    expect(statements).toHaveLength(3);

    expect(statements[0]!.kind).toBe("remark");
    expect(statements[0]!.speakerName).toBe("若山隆史");
    expect(statements[0]!.speakerRole).toBe("議長");

    expect(statements[1]!.kind).toBe("question");
    expect(statements[1]!.speakerName).toBe("水野忠宗");
    expect(statements[1]!.speakerRole).toBe("議員");

    expect(statements[2]!.kind).toBe("answer");
    expect(statements[2]!.speakerName).toBe("早野博文");
    expect(statements[2]!.speakerRole).toBe("町長");
  });

  it("各 statement に contentHash が付与される", () => {
    const statements = parseStatements(
      "○議長（若山隆史君）　テスト発言。"
    );
    expect(statements[0]!.contentHash).toMatch(/^[a-f0-9]{64}$/);
  });

  it("offset が正しく計算される", () => {
    const text = `○議長（若山隆史君）　ただいま。
○３番（水野忠宗君）　質問です。`;

    const statements = parseStatements(text);

    expect(statements[0]!.startOffset).toBe(0);
    expect(statements[0]!.endOffset).toBe("ただいま。".length);
    expect(statements[1]!.startOffset).toBe("ただいま。".length + 1);
  });

  it("登壇のト書きはスキップする", () => {
    const text = `○議長（若山隆史君）　ただいまから会議を開きます。
○（３番　水野忠宗君登壇）
○３番（水野忠宗君）　質問があります。`;

    const statements = parseStatements(text);
    expect(statements).toHaveLength(2);
    expect(statements[0]!.speakerRole).toBe("議長");
    expect(statements[1]!.speakerRole).toBe("議員");
  });

  it("空テキストは空配列を返す", () => {
    expect(parseStatements("")).toEqual([]);
  });

  it("◯（丸印の別字体）マーカーにも対応する", () => {
    const text = "◯議長（若山隆史君）　テスト発言です。";
    const statements = parseStatements(text);
    expect(statements).toHaveLength(1);
    expect(statements[0]!.speakerRole).toBe("議長");
  });

  it("課長パターンの発言は answer に分類される", () => {
    const text = "○総務課長（藤塚正博君）　ご説明いたします。";
    const statements = parseStatements(text);
    expect(statements).toHaveLength(1);
    expect(statements[0]!.kind).toBe("answer");
    expect(statements[0]!.speakerRole).toBe("課長");
  });
});
