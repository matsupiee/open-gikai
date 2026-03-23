import { describe, expect, it } from "vitest";
import { parseSpeaker, classifyKind, parseStatements } from "./detail";

describe("parseSpeaker", () => {
  it("議長（名前君）パターンを解析する", () => {
    const result = parseSpeaker(
      "○議長（笠井安之君） 現在の出席議員は１９名で定足数に達しており、議会は成立しました。"
    );
    expect(result.speakerName).toBe("笠井安之");
    expect(result.speakerRole).toBe("議長");
    expect(result.content).toBe(
      "現在の出席議員は１９名で定足数に達しており、議会は成立しました。"
    );
  });

  it("市長（名前君）パターンを解析する", () => {
    const result = parseSpeaker(
      "○市長（町田寿人君） 皆さん、おはようございます。"
    );
    expect(result.speakerName).toBe("町田寿人");
    expect(result.speakerRole).toBe("市長");
    expect(result.content).toBe("皆さん、おはようございます。");
  });

  it("委員長パターンを解析する", () => {
    const result = parseSpeaker(
      "○総務常任委員長（坂東重夫君） おはようございます。"
    );
    expect(result.speakerName).toBe("坂東重夫");
    expect(result.speakerRole).toBe("委員長");
    expect(result.content).toBe("おはようございます。");
  });

  it("理事パターンを解析する", () => {
    const result = parseSpeaker(
      "○理事（坂東孝一君） それでは、補足説明をさせていただきます。"
    );
    expect(result.speakerName).toBe("坂東孝一");
    expect(result.speakerRole).toBe("理事");
    expect(result.content).toBe("それでは、補足説明をさせていただきます。");
  });

  it("部長パターンを解析する", () => {
    const result = parseSpeaker(
      "○市民部長（稲井誠司君） それでは、補足説明をさせていただきます。"
    );
    expect(result.speakerName).toBe("稲井誠司");
    expect(result.speakerRole).toBe("部長");
    expect(result.content).toBe("それでは、補足説明をさせていただきます。");
  });

  it("番号議員パターンを解析する", () => {
    const result = parseSpeaker(
      "○３番（野口加代子君） 質問いたします。"
    );
    expect(result.speakerName).toBe("野口加代子");
    expect(result.speakerRole).toBe("議員");
    expect(result.content).toBe("質問いたします。");
  });

  it("名前に空白を含む場合は除去される", () => {
    const result = parseSpeaker(
      "○文教厚生常任委員長（吉田 稔君） それでは報告します。"
    );
    expect(result.speakerName).toBe("吉田稔");
    expect(result.speakerRole).toBe("委員長");
  });

  it("教育長パターンを解析する", () => {
    const result = parseSpeaker(
      "○教育長（髙田稔君） お答えいたします。"
    );
    expect(result.speakerName).toBe("髙田稔");
    expect(result.speakerRole).toBe("教育長");
    expect(result.content).toBe("お答えいたします。");
  });

  it("次長パターンを解析する", () => {
    const result = parseSpeaker(
      "○企画総務部次長（古川秀樹君） ご説明いたします。"
    );
    expect(result.speakerName).toBe("古川秀樹");
    expect(result.speakerRole).toBe("次長");
    expect(result.content).toBe("ご説明いたします。");
  });

  it("○ マーカーなしのテキスト", () => {
    const result = parseSpeaker("午前１０時００分 開会");
    expect(result.speakerName).toBeNull();
    expect(result.speakerRole).toBeNull();
    expect(result.content).toBe("午前１０時００分 開会");
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

  it("市長は answer", () => {
    expect(classifyKind("市長")).toBe("answer");
  });

  it("教育長は answer", () => {
    expect(classifyKind("教育長")).toBe("answer");
  });

  it("部長は answer", () => {
    expect(classifyKind("部長")).toBe("answer");
  });

  it("理事は answer", () => {
    expect(classifyKind("理事")).toBe("answer");
  });

  it("次長は answer", () => {
    expect(classifyKind("次長")).toBe("answer");
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
○議長（笠井安之君） ただいまから本日の会議を開きます。
○３番（野口加代子君） 質問があります。
○市長（町田寿人君） お答えします。
`;
    const statements = parseStatements(text);

    expect(statements).toHaveLength(3);

    expect(statements[0]!.kind).toBe("remark");
    expect(statements[0]!.speakerName).toBe("笠井安之");
    expect(statements[0]!.speakerRole).toBe("議長");

    expect(statements[1]!.kind).toBe("question");
    expect(statements[1]!.speakerName).toBe("野口加代子");
    expect(statements[1]!.speakerRole).toBe("議員");

    expect(statements[2]!.kind).toBe("answer");
    expect(statements[2]!.speakerName).toBe("町田寿人");
    expect(statements[2]!.speakerRole).toBe("市長");
  });

  it("各 statement に contentHash が付与される", () => {
    const statements = parseStatements(
      "○議長（笠井安之君） テスト発言。"
    );
    expect(statements[0]!.contentHash).toMatch(/^[a-f0-9]{64}$/);
  });

  it("offset が正しく計算される", () => {
    const text = `○議長（笠井安之君） ただいま。
○３番（野口加代子君） 質問です。`;

    const statements = parseStatements(text);

    expect(statements[0]!.startOffset).toBe(0);
    expect(statements[0]!.endOffset).toBe("ただいま。".length);
    expect(statements[1]!.startOffset).toBe("ただいま。".length + 1);
  });

  it("ト書き（登壇）はスキップする", () => {
    const text = `○議長（笠井安之君） ただいまから会議を開きます。
（３番　野口加代子君登壇）
○３番（野口加代子君） 質問があります。`;

    const statements = parseStatements(text);
    expect(statements).toHaveLength(2);
    expect(statements[0]!.speakerRole).toBe("議長");
    expect(statements[1]!.speakerRole).toBe("議員");
  });

  it("空テキストは空配列を返す", () => {
    expect(parseStatements("")).toEqual([]);
  });

  it("行政側の役職を正しく分類する", () => {
    const text = `○理事（坂東孝一君） 補足説明いたします。
○市民部長（稲井誠司君） ご説明いたします。
○教育長（髙田稔君） お答えいたします。`;

    const statements = parseStatements(text);

    expect(statements).toHaveLength(3);
    expect(statements[0]!.kind).toBe("answer");
    expect(statements[0]!.speakerRole).toBe("理事");
    expect(statements[1]!.kind).toBe("answer");
    expect(statements[1]!.speakerRole).toBe("部長");
    expect(statements[2]!.kind).toBe("answer");
    expect(statements[2]!.speakerRole).toBe("教育長");
  });
});
