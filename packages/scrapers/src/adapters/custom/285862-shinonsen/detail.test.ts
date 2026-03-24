import { describe, expect, it } from "vitest";
import { parseSpeaker, classifyKind, parseStatements } from "./detail";

describe("parseSpeaker", () => {
  it("議長（名前）パターンを解析する", () => {
    const result = parseSpeaker(
      "○議長（田中一郎） ただいまから本日の会議を開きます。",
    );
    expect(result.speakerName).toBe("田中一郎");
    expect(result.speakerRole).toBe("議長");
    expect(result.content).toBe("ただいまから本日の会議を開きます。");
  });

  it("町長（名前）パターンを解析する", () => {
    const result = parseSpeaker("○町長（山田太郎） 皆さん、おはようございます。");
    expect(result.speakerName).toBe("山田太郎");
    expect(result.speakerRole).toBe("町長");
    expect(result.content).toBe("皆さん、おはようございます。");
  });

  it("副町長（名前）パターンを解析する", () => {
    const result = parseSpeaker("○副町長（鈴木次郎） ご説明いたします。");
    expect(result.speakerName).toBe("鈴木次郎");
    expect(result.speakerRole).toBe("副町長");
    expect(result.content).toBe("ご説明いたします。");
  });

  it("課長（名前）パターンを解析する", () => {
    const result = parseSpeaker(
      "○総務課長（佐藤三郎） 議案についてご説明いたします。",
    );
    expect(result.speakerName).toBe("佐藤三郎");
    expect(result.speakerRole).toBe("課長");
    expect(result.content).toBe("議案についてご説明いたします。");
  });

  it("名前+議員 パターンを解析する", () => {
    const result = parseSpeaker("○中村四郎議員 質問いたします。");
    expect(result.speakerName).toBe("中村四郎");
    expect(result.speakerRole).toBe("議員");
    expect(result.content).toBe("質問いたします。");
  });

  it("教育長パターンを解析する", () => {
    const result = parseSpeaker("○教育長（木村五郎） お答えいたします。");
    expect(result.speakerName).toBe("木村五郎");
    expect(result.speakerRole).toBe("教育長");
    expect(result.content).toBe("お答えいたします。");
  });

  it("名前に空白を含む場合は空白を除去する", () => {
    const result = parseSpeaker("○産業振興課長（田 中 一） ご説明いたします。");
    expect(result.speakerName).toBe("田中一");
    expect(result.speakerRole).toBe("課長");
  });

  it("○マーカーなしのテキスト", () => {
    const result = parseSpeaker("午前10時開会");
    expect(result.speakerName).toBeNull();
    expect(result.speakerRole).toBeNull();
    expect(result.content).toBe("午前10時開会");
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
  it("○マーカーでテキストを分割する", () => {
    const text = `
○議長（田中一郎） ただいまから本日の会議を開きます。
○町長（山田太郎） 皆さんおはようございます。
○中村四郎議員 質問いたします。
`;
    const statements = parseStatements(text);

    expect(statements).toHaveLength(3);

    expect(statements[0]!.kind).toBe("remark");
    expect(statements[0]!.speakerName).toBe("田中一郎");
    expect(statements[0]!.speakerRole).toBe("議長");

    expect(statements[1]!.kind).toBe("answer");
    expect(statements[1]!.speakerName).toBe("山田太郎");
    expect(statements[1]!.speakerRole).toBe("町長");

    expect(statements[2]!.kind).toBe("question");
    expect(statements[2]!.speakerName).toBe("中村四郎");
    expect(statements[2]!.speakerRole).toBe("議員");
  });

  it("各 statement に contentHash が付与される", () => {
    const statements = parseStatements(
      "○議長（田中一郎） ただいまから会議を開きます。",
    );
    expect(statements[0]!.contentHash).toMatch(/^[a-f0-9]{64}$/);
  });

  it("offset が正しく計算される", () => {
    const text = `○議長（田中一郎） ただいま。
○中村四郎議員 質問です。`;

    const statements = parseStatements(text);

    expect(statements[0]!.startOffset).toBe(0);
    expect(statements[0]!.endOffset).toBe("ただいま。".length);
    expect(statements[1]!.startOffset).toBe("ただいま。".length + 1);
  });

  it("ト書き（登壇）はスキップする", () => {
    const text = `○議長（田中一郎） ただいまから会議を開きます。
○（中村四郎君登壇）
○中村四郎議員 質問があります。`;

    const statements = parseStatements(text);
    expect(statements).toHaveLength(2);
    expect(statements[0]!.speakerRole).toBe("議長");
    expect(statements[1]!.speakerRole).toBe("議員");
  });

  it("空テキストは空配列を返す", () => {
    expect(parseStatements("")).toEqual([]);
  });

  it("行政側の役職を正しく分類する", () => {
    const text = `○副町長（鈴木次郎） ご説明いたします。
○総務課長（佐藤三郎） ご報告いたします。
○産業振興課長（田中一） 補足説明いたします。`;

    const statements = parseStatements(text);

    expect(statements).toHaveLength(3);
    expect(statements[0]!.kind).toBe("answer");
    expect(statements[0]!.speakerRole).toBe("副町長");
    expect(statements[1]!.kind).toBe("answer");
    expect(statements[1]!.speakerRole).toBe("課長");
    expect(statements[2]!.kind).toBe("answer");
    expect(statements[2]!.speakerRole).toBe("課長");
  });

  it("statements が空なら空配列を返す", () => {
    const text = "これはマーカーを含まないテキストです。";
    expect(parseStatements(text)).toEqual([]);
  });
});
