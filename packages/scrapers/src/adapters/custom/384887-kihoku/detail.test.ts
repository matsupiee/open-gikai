import { describe, expect, it } from "vitest";
import { parseSpeaker, classifyKind, parseStatements } from "./detail";

describe("parseSpeaker", () => {
  it("議長をカッコ形式でパースする", () => {
    const result = parseSpeaker("○議長（山田太郎） 本日の会議を開きます。");
    expect(result.speakerName).toBe("山田太郎");
    expect(result.speakerRole).toBe("議長");
    expect(result.content).toBe("本日の会議を開きます。");
  });

  it("町長をカッコ形式でパースする", () => {
    const result = parseSpeaker("○町長（鈴木花子） お答えいたします。");
    expect(result.speakerName).toBe("鈴木花子");
    expect(result.speakerRole).toBe("町長");
    expect(result.content).toBe("お答えいたします。");
  });

  it("番号付き議員をカッコ形式でパースする", () => {
    const result = parseSpeaker("○１番（田中一郎） 質問いたします。");
    expect(result.speakerName).toBe("田中一郎");
    expect(result.speakerRole).toBe("議員");
    expect(result.content).toBe("質問いたします。");
  });

  it("総務課長をカッコ形式でパースする", () => {
    const result = parseSpeaker("○総務課長（上田浩） ご説明いたします。");
    expect(result.speakerName).toBe("上田浩");
    expect(result.speakerRole).toBe("課長");
    expect(result.content).toBe("ご説明いたします。");
  });

  it("副議長をパースする", () => {
    const result = parseSpeaker("○副議長（佐藤次郎） 暫時休憩します。");
    expect(result.speakerName).toBe("佐藤次郎");
    expect(result.speakerRole).toBe("副議長");
    expect(result.content).toBe("暫時休憩します。");
  });

  it("副町長をパースする", () => {
    const result = parseSpeaker("○副町長（中村三郎） 補足説明をします。");
    expect(result.speakerName).toBe("中村三郎");
    expect(result.speakerRole).toBe("副町長");
    expect(result.content).toBe("補足説明をします。");
  });

  it("教育長をパースする", () => {
    const result = parseSpeaker("○教育長（木村恵子） 答弁します。");
    expect(result.speakerName).toBe("木村恵子");
    expect(result.speakerRole).toBe("教育長");
    expect(result.content).toBe("答弁します。");
  });

  it("○マーカーなしのテキスト", () => {
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
  it("○マーカーで区切られた発言を抽出する", () => {
    const text = `
○議長（山田太郎） 本日の会議を開きます。
○１番（田中一郎） 質問いたします。
○町長（鈴木花子） お答えいたします。
    `.trim();

    const statements = parseStatements(text);

    expect(statements).toHaveLength(3);
    expect(statements[0]!.speakerName).toBe("山田太郎");
    expect(statements[0]!.speakerRole).toBe("議長");
    expect(statements[0]!.kind).toBe("remark");
    expect(statements[0]!.content).toBe("本日の会議を開きます。");
    expect(statements[1]!.speakerName).toBe("田中一郎");
    expect(statements[1]!.speakerRole).toBe("議員");
    expect(statements[1]!.kind).toBe("question");
    expect(statements[2]!.speakerName).toBe("鈴木花子");
    expect(statements[2]!.speakerRole).toBe("町長");
    expect(statements[2]!.kind).toBe("answer");
  });

  it("登壇・退席のト書きをスキップする", () => {
    const text = `
○１番（田中一郎）（登壇）
○１番（田中一郎） 質問いたします。
    `.trim();

    const statements = parseStatements(text);

    expect(statements).toHaveLength(1);
    expect(statements[0]!.content).toBe("質問いたします。");
  });

  it("空のブロックはスキップする", () => {
    const text = `
○議長（山田太郎） 本日の会議を開きます。
    `.trim();

    const statements = parseStatements(text);

    expect(statements).toHaveLength(1);
  });

  it("contentHash が SHA-256 で生成される", () => {
    const text = `○議長（山田太郎） 本日の会議を開きます。`;

    const statements = parseStatements(text);

    expect(statements[0]!.contentHash).toMatch(/^[a-f0-9]{64}$/);
  });

  it("offset が正しく計算される", () => {
    const text = `○議長（山田太郎） 開きます。\n○町長（鈴木花子） 答えます。`;

    const statements = parseStatements(text);

    expect(statements[0]!.startOffset).toBe(0);
    expect(statements[0]!.endOffset).toBe("開きます。".length);
    expect(statements[1]!.startOffset).toBe("開きます。".length + 1);
  });

  it("発言がない場合は空配列を返す", () => {
    const text = "令和6年第1回定例会 議事録";

    const statements = parseStatements(text);

    expect(statements).toHaveLength(0);
  });
});
