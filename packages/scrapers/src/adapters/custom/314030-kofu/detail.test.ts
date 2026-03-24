import { describe, expect, it } from "vitest";
import { parseSpeaker, classifyKind, parseStatements } from "./detail";

describe("parseSpeaker", () => {
  it("議長（名前君）パターンを解析する", () => {
    const result = parseSpeaker("○議長（三好　晋也君） 日程第1、会議録署名議員の指名を行います。");
    expect(result.speakerName).toBe("三好晋也");
    expect(result.speakerRole).toBe("議長");
    expect(result.content).toBe("日程第1、会議録署名議員の指名を行います。");
  });

  it("町長（名前君）パターンを解析する", () => {
    const result = parseSpeaker("○町長（白石　祐治君） 皆さん、おはようございます。");
    expect(result.speakerName).toBe("白石祐治");
    expect(result.speakerRole).toBe("町長");
    expect(result.content).toBe("皆さん、おはようございます。");
  });

  it("課長パターンを解析する", () => {
    const result = parseSpeaker("○総務課長（生田　志保君） それでは説明いたします。");
    expect(result.speakerName).toBe("生田志保");
    expect(result.speakerRole).toBe("課長");
    expect(result.content).toBe("それでは説明いたします。");
  });

  it("教育長パターンを解析する", () => {
    const result = parseSpeaker("○教育長（富田　敦司君） お答えいたします。");
    expect(result.speakerName).toBe("富田敦司");
    expect(result.speakerRole).toBe("教育長");
    expect(result.content).toBe("お答えいたします。");
  });

  it("副町長パターンを解析する", () => {
    const result = parseSpeaker("○副町長（八幡　徳弘君） ご説明いたします。");
    expect(result.speakerName).toBe("八幡徳弘");
    expect(result.speakerRole).toBe("副町長");
    expect(result.content).toBe("ご説明いたします。");
  });

  it("番号付き議員パターン（全角数字）を解析する", () => {
    const result = parseSpeaker("○１番（加藤　邦樹君） 質問いたします。");
    expect(result.speakerName).toBe("加藤邦樹");
    expect(result.speakerRole).toBe("議員");
    expect(result.content).toBe("質問いたします。");
  });

  it("番号付き議員パターン（半角数字）を解析する", () => {
    const result = parseSpeaker("○3番（田中　太郎君） 質問いたします。");
    expect(result.speakerName).toBe("田中太郎");
    expect(result.speakerRole).toBe("議員");
    expect(result.content).toBe("質問いたします。");
  });

  it("名前の空白を除去する", () => {
    const result = parseSpeaker("○議長（三好　晋也君） 開議します。");
    expect(result.speakerName).toBe("三好晋也");
  });

  it("○ マーカーなしのテキスト", () => {
    const result = parseSpeaker("午前10時00分 開会");
    expect(result.speakerName).toBeNull();
    expect(result.speakerRole).toBeNull();
    expect(result.content).toBe("午前10時00分 開会");
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

  it("副課長は answer", () => {
    expect(classifyKind("副課長")).toBe("answer");
  });

  it("議員は question", () => {
    expect(classifyKind("議員")).toBe("question");
  });

  it("null は remark", () => {
    expect(classifyKind(null)).toBe("remark");
  });

  it("○○課長のような複合役職は answer", () => {
    expect(classifyKind("総務課長")).toBe("answer");
    expect(classifyKind("住民生活課長")).toBe("answer");
  });
});

describe("parseStatements", () => {
  it("○ マーカーでテキストを分割する", () => {
    const text = `
○議長（三好　晋也君） ただいまから本日の会議を開きます。
○１番（加藤　邦樹君） 質問があります。
○町長（白石　祐治君） お答えします。
`;
    const statements = parseStatements(text);

    expect(statements).toHaveLength(3);

    expect(statements[0]!.kind).toBe("remark");
    expect(statements[0]!.speakerName).toBe("三好晋也");
    expect(statements[0]!.speakerRole).toBe("議長");

    expect(statements[1]!.kind).toBe("question");
    expect(statements[1]!.speakerName).toBe("加藤邦樹");
    expect(statements[1]!.speakerRole).toBe("議員");

    expect(statements[2]!.kind).toBe("answer");
    expect(statements[2]!.speakerName).toBe("白石祐治");
    expect(statements[2]!.speakerRole).toBe("町長");
  });

  it("各 statement に contentHash が付与される", () => {
    const statements = parseStatements("○議長（三好　晋也君） テスト発言。");
    expect(statements[0]!.contentHash).toMatch(/^[a-f0-9]{64}$/);
  });

  it("offset が正しく計算される", () => {
    const text = `○議長（三好　晋也君） ただいま。
○１番（加藤　邦樹君） 質問です。`;

    const statements = parseStatements(text);

    expect(statements[0]!.startOffset).toBe(0);
    expect(statements[0]!.endOffset).toBe("ただいま。".length);
    expect(statements[1]!.startOffset).toBe("ただいま。".length + 1);
  });

  it("ト書き（登壇）はスキップする", () => {
    const text = `○議長（三好　晋也君） ただいまから会議を開きます。
○（１番　加藤　邦樹君登壇）
○１番（加藤　邦樹君） 質問があります。`;

    const statements = parseStatements(text);
    expect(statements).toHaveLength(2);
    expect(statements[0]!.speakerRole).toBe("議長");
    expect(statements[1]!.speakerRole).toBe("議員");
  });

  it("ページ番号（－N－）を除去する", () => {
    const text = `○議長（三好　晋也君） ただいまから会議を開きます。
－1－
○１番（加藤　邦樹君） 質問があります。`;

    const statements = parseStatements(text);
    expect(statements).toHaveLength(2);
  });

  it("空テキストは空配列を返す", () => {
    expect(parseStatements("")).toEqual([]);
  });

  it("行政側の役職を正しく分類する", () => {
    const text = `○総務課長（生田　志保君） 補足説明いたします。
○副町長（八幡　徳弘君） ご説明いたします。
○教育長（富田　敦司君） お答えいたします。`;

    const statements = parseStatements(text);

    expect(statements).toHaveLength(3);
    expect(statements[0]!.kind).toBe("answer");
    expect(statements[0]!.speakerRole).toBe("課長");
    expect(statements[1]!.kind).toBe("answer");
    expect(statements[1]!.speakerRole).toBe("副町長");
    expect(statements[2]!.kind).toBe("answer");
    expect(statements[2]!.speakerRole).toBe("教育長");
  });
});
