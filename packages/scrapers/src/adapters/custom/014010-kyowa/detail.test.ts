import { describe, expect, it } from "vitest";
import { parseSpeaker, classifyKind, parseStatements } from "./detail";

describe("parseSpeaker", () => {
  it("委員長を正しくパースする", () => {
    const result = parseSpeaker("○田中委員長 ただいまから会議を開きます。");
    expect(result.speakerName).toBe("田中");
    expect(result.speakerRole).toBe("委員長");
    expect(result.content).toBe("ただいまから会議を開きます。");
  });

  it("副委員長を正しくパースする（副委員長 > 委員長 の順序確認）", () => {
    const result = parseSpeaker("○佐藤副委員長 進行します。");
    expect(result.speakerName).toBe("佐藤");
    expect(result.speakerRole).toBe("副委員長");
    expect(result.content).toBe("進行します。");
  });

  it("教育長を正しくパースする", () => {
    const result = parseSpeaker("○山田教育長 お答えいたします。");
    expect(result.speakerName).toBe("山田");
    expect(result.speakerRole).toBe("教育長");
    expect(result.content).toBe("お答えいたします。");
  });

  it("副教育長を正しくパースする（副教育長 > 教育長 の順序確認）", () => {
    const result = parseSpeaker("○鈴木副教育長 ご説明いたします。");
    expect(result.speakerName).toBe("鈴木");
    expect(result.speakerRole).toBe("副教育長");
    expect(result.content).toBe("ご説明いたします。");
  });

  it("委員を正しくパースする", () => {
    const result = parseSpeaker("○高橋委員 質問いたします。");
    expect(result.speakerName).toBe("高橋");
    expect(result.speakerRole).toBe("委員");
    expect(result.content).toBe("質問いたします。");
  });

  it("課長を正しくパースする", () => {
    const result = parseSpeaker("○田村総務課長 ご報告いたします。");
    expect(result.speakerName).toBe("田村総務");
    expect(result.speakerRole).toBe("課長");
    expect(result.content).toBe("ご報告いたします。");
  });

  it("全角スペースで区切られた発言をパースする", () => {
    const result = parseSpeaker("○田中委員長　ただいまから会議を開きます。");
    expect(result.speakerName).toBe("田中");
    expect(result.speakerRole).toBe("委員長");
    expect(result.content).toBe("ただいまから会議を開きます。");
  });

  it("◯マーカーなしのテキスト", () => {
    const result = parseSpeaker("午後１時開議");
    expect(result.speakerName).toBeNull();
    expect(result.speakerRole).toBeNull();
    expect(result.content).toBe("午後１時開議");
  });

  it("◯マーカーあり・役職不明の場合は名前のみ", () => {
    const result = parseSpeaker("○田中太郎 発言します。");
    expect(result.speakerName).toBe("田中太郎");
    expect(result.speakerRole).toBeNull();
    expect(result.content).toBe("発言します。");
  });
});

describe("classifyKind", () => {
  it("委員長は remark", () => {
    expect(classifyKind("委員長")).toBe("remark");
  });

  it("副委員長は remark", () => {
    expect(classifyKind("副委員長")).toBe("remark");
  });

  it("議長は remark", () => {
    expect(classifyKind("議長")).toBe("remark");
  });

  it("副議長は remark", () => {
    expect(classifyKind("副議長")).toBe("remark");
  });

  it("教育長は answer", () => {
    expect(classifyKind("教育長")).toBe("answer");
  });

  it("副教育長は answer", () => {
    expect(classifyKind("副教育長")).toBe("answer");
  });

  it("課長は answer", () => {
    expect(classifyKind("課長")).toBe("answer");
  });

  it("委員は question", () => {
    expect(classifyKind("委員")).toBe("question");
  });

  it("null は remark", () => {
    expect(classifyKind(null)).toBe("remark");
  });
});

describe("parseStatements", () => {
  it("○マーカーで始まる行を発言として抽出する", () => {
    const text = `
○田中委員長　ただいまから会議を開きます。
○高橋委員　質問いたします。
○山田教育長　お答えいたします。
    `;

    const statements = parseStatements(text);

    expect(statements).toHaveLength(3);

    expect(statements[0]!.speakerName).toBe("田中");
    expect(statements[0]!.speakerRole).toBe("委員長");
    expect(statements[0]!.kind).toBe("remark");
    expect(statements[0]!.content).toBe("ただいまから会議を開きます。");

    expect(statements[1]!.speakerName).toBe("高橋");
    expect(statements[1]!.speakerRole).toBe("委員");
    expect(statements[1]!.kind).toBe("question");

    expect(statements[2]!.speakerName).toBe("山田");
    expect(statements[2]!.speakerRole).toBe("教育長");
    expect(statements[2]!.kind).toBe("answer");
  });

  it("複数行にわたる発言をまとめる", () => {
    const text = `
○高橋委員　質問いたします。
この件について詳しく説明してください。
よろしくお願いします。
○山田教育長　お答えします。
    `;

    const statements = parseStatements(text);

    expect(statements).toHaveLength(2);
    expect(statements[0]!.content).toBe(
      "質問いたします。 この件について詳しく説明してください。 よろしくお願いします。",
    );
    expect(statements[1]!.speakerRole).toBe("教育長");
  });

  it("contentHash が SHA-256 形式で生成される", () => {
    const text = `○田中委員長　ただいまから会議を開きます。`;

    const statements = parseStatements(text);
    expect(statements[0]!.contentHash).toMatch(/^[a-f0-9]{64}$/);
  });

  it("offset が正しく計算される", () => {
    const text = `
○田中委員長　ただいま。
○高橋委員　質問です。
    `;

    const statements = parseStatements(text);
    expect(statements[0]!.startOffset).toBe(0);
    expect(statements[0]!.endOffset).toBe("ただいま。".length);
    expect(statements[1]!.startOffset).toBe("ただいま。".length + 1);
  });

  it("空テキストでは空配列を返す", () => {
    expect(parseStatements("")).toHaveLength(0);
    expect(parseStatements("   \n   ")).toHaveLength(0);
  });
});
