import { describe, it, expect } from "vitest";
import { parseSpeaker, classifyKind, parseStatements } from "./detail";

describe("parseSpeaker", () => {
  it("議長を正しくパースする", () => {
    const result = parseSpeaker(
      "○議長（山田太郎君）　ただいまから本日の会議を開きます。",
    );
    expect(result.speakerName).toBe("山田太郎");
    expect(result.speakerRole).toBe("議長");
    expect(result.content).toBe("ただいまから本日の会議を開きます。");
  });

  it("議員（議席番号付き）を正しくパースする", () => {
    const result = parseSpeaker(
      "○3番（佐藤花子君）　質問いたします。",
    );
    expect(result.speakerName).toBe("佐藤花子");
    expect(result.speakerRole).toBe("議員");
    expect(result.content).toBe("質問いたします。");
  });

  it("町長を正しくパースする", () => {
    const result = parseSpeaker(
      "○町長（鈴木一郎君）　お答えいたします。",
    );
    expect(result.speakerName).toBe("鈴木一郎");
    expect(result.speakerRole).toBe("町長");
    expect(result.content).toBe("お答えいたします。");
  });

  it("教育長を正しくパースする", () => {
    const result = parseSpeaker(
      "○教育長（田中次郎君）　ご報告いたします。",
    );
    expect(result.speakerName).toBe("田中次郎");
    expect(result.speakerRole).toBe("教育長");
    expect(result.content).toBe("ご報告いたします。");
  });

  it("複合役職（企画部長）を正しくパースする", () => {
    const result = parseSpeaker(
      "○企画部長（山本三郎君）　ご説明いたします。",
    );
    expect(result.speakerName).toBe("山本三郎");
    expect(result.speakerRole).toBe("部長");
    expect(result.content).toBe("ご説明いたします。");
  });

  it("名前中の空白を除去する", () => {
    const result = parseSpeaker(
      "○議長（山田　太郎君）　開会します。",
    );
    expect(result.speakerName).toBe("山田太郎");
  });

  it("○マーカーなしのテキスト", () => {
    const result = parseSpeaker("午前９時開議");
    expect(result.speakerName).toBeNull();
    expect(result.speakerRole).toBeNull();
    expect(result.content).toBe("午前９時開議");
  });

  it("副町長を正しくパースする", () => {
    const result = parseSpeaker(
      "○副町長（高橋四郎君）　ご報告いたします。",
    );
    expect(result.speakerName).toBe("高橋四郎");
    expect(result.speakerRole).toBe("副町長");
    expect(result.content).toBe("ご報告いたします。");
  });

  it("全角数字の議席番号を正しくパースする", () => {
    const result = parseSpeaker(
      "○１２番（中村五郎君）　質問します。",
    );
    expect(result.speakerName).toBe("中村五郎");
    expect(result.speakerRole).toBe("議員");
    expect(result.content).toBe("質問します。");
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

  it("部長は answer", () => {
    expect(classifyKind("部長")).toBe("answer");
  });

  it("企画部長は answer（部分一致）", () => {
    expect(classifyKind("企画部長")).toBe("answer");
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
  it("○ マーカーで発言を分割する", () => {
    const text = [
      "○議長（山田太郎君）　ただいまから会議を開きます。",
      "○3番（佐藤花子君）　質問いたします。",
      "○町長（鈴木一郎君）　お答えいたします。",
    ].join("\n");

    const statements = parseStatements(text);

    expect(statements).toHaveLength(3);
    expect(statements[0]!.speakerName).toBe("山田太郎");
    expect(statements[0]!.speakerRole).toBe("議長");
    expect(statements[0]!.kind).toBe("remark");

    expect(statements[1]!.speakerName).toBe("佐藤花子");
    expect(statements[1]!.speakerRole).toBe("議員");
    expect(statements[1]!.kind).toBe("question");

    expect(statements[2]!.speakerName).toBe("鈴木一郎");
    expect(statements[2]!.speakerRole).toBe("町長");
    expect(statements[2]!.kind).toBe("answer");
  });

  it("contentHash が生成される", () => {
    const text = "○議長（山田太郎君）　ただいまから会議を開きます。";
    const statements = parseStatements(text);
    expect(statements[0]!.contentHash).toMatch(/^[a-f0-9]{64}$/);
  });

  it("offset が正しく計算される", () => {
    const text = [
      "○議長（山田太郎君）　ただいま。",
      "○3番（佐藤花子君）　質問です。",
    ].join("\n");

    const statements = parseStatements(text);
    expect(statements[0]!.startOffset).toBe(0);
    expect(statements[0]!.endOffset).toBe("ただいま。".length);
    expect(statements[1]!.startOffset).toBe("ただいま。".length + 1);
  });

  it("○マーカーなしのテキストはスキップする", () => {
    const text = [
      "会議録の冒頭テキスト",
      "○議長（山田太郎君）　ただいまから会議を開きます。",
    ].join("\n");

    const statements = parseStatements(text);
    expect(statements).toHaveLength(1);
  });

  it("空の発言内容はスキップする", () => {
    const text = "○議長（山田太郎君）";
    const statements = parseStatements(text);
    expect(statements).toHaveLength(0);
  });
});
