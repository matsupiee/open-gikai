import { describe, expect, it } from "vitest";
import { parseSpeaker, classifyKind, parseStatements } from "./detail";

describe("parseSpeaker", () => {
  it("議長を正しくパースする", () => {
    const result = parseSpeaker("○議長（湊俊文） おはようございます。");
    expect(result.speakerName).toBe("湊俊文");
    expect(result.speakerRole).toBe("議長");
    expect(result.content).toBe("おはようございます。");
  });

  it("町長を正しくパースする", () => {
    const result = parseSpeaker("○町長（箕野博司） お答えいたします。");
    expect(result.speakerName).toBe("箕野博司");
    expect(result.speakerRole).toBe("町長");
    expect(result.content).toBe("お答えいたします。");
  });

  it("副町長を正しくパースする", () => {
    const result = parseSpeaker("○副町長（畑田正法） ご説明いたします。");
    expect(result.speakerName).toBe("畑田正法");
    expect(result.speakerRole).toBe("副町長");
    expect(result.content).toBe("ご説明いたします。");
  });

  it("教育長を正しくパースする", () => {
    const result = parseSpeaker("○教育長（池田庄策） お答えいたします。");
    expect(result.speakerName).toBe("池田庄策");
    expect(result.speakerRole).toBe("教育長");
    expect(result.content).toBe("お答えいたします。");
  });

  it("課長を正しくパースする", () => {
    const result = parseSpeaker("○建設課長（竹下秀樹） ご説明申し上げます。");
    expect(result.speakerName).toBe("竹下秀樹");
    expect(result.speakerRole).toBe("課長");
    expect(result.content).toBe("ご説明申し上げます。");
  });

  it("番号付き議員を正しくパースする", () => {
    const result = parseSpeaker("○３番（花岡元治君） 質問いたします。");
    expect(result.speakerName).toBe("花岡元治");
    expect(result.speakerRole).toBe("議員");
    expect(result.content).toBe("質問いたします。");
  });

  it("支所長を正しくパースする", () => {
    const result = parseSpeaker("○芸北支所長（村竹明治） ご説明します。");
    expect(result.speakerName).toBe("村竹明治");
    expect(result.speakerRole).toBe("芸北支所長");
    expect(result.content).toBe("ご説明します。");
  });

  it("○マーカーなしのテキスト", () => {
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

  it("芸北支所長は answer", () => {
    expect(classifyKind("芸北支所長")).toBe("answer");
  });

  it("議員は question", () => {
    expect(classifyKind("議員")).toBe("question");
  });

  it("null は remark", () => {
    expect(classifyKind(null)).toBe("remark");
  });
});

describe("parseStatements", () => {
  it("○マーカーで発言ブロックを分割する", () => {
    const text = `
- 2 -
～～～～～～～～ ○ ～～～～～～～～
○議長（湊俊文） おはようございます。ただいまから会議を開きます。
～～～～～～～～ ○ ～～～～～～～～
○町長（箕野博司） お答えいたします。詳細をご説明します。
○３番（花岡元治君） 質問いたします。
    `;

    const statements = parseStatements(text);

    expect(statements.length).toBeGreaterThanOrEqual(3);

    const gichou = statements.find((s) => s.speakerRole === "議長");
    expect(gichou).toBeDefined();
    expect(gichou!.speakerName).toBe("湊俊文");
    expect(gichou!.kind).toBe("remark");

    const chocho = statements.find((s) => s.speakerRole === "町長");
    expect(chocho).toBeDefined();
    expect(chocho!.kind).toBe("answer");

    const giin = statements.find((s) => s.speakerRole === "議員");
    expect(giin).toBeDefined();
    expect(giin!.speakerName).toBe("花岡元治");
    expect(giin!.kind).toBe("question");
  });

  it("ト書き（登壇）をスキップする", () => {
    const text = `
○議長（湊俊文） 町長。
○（登壇）
○町長（箕野博司） お答えいたします。
    `;

    const statements = parseStatements(text);
    const toGaki = statements.filter(
      (s) => s.speakerRole === null && s.content.includes("登壇"),
    );
    expect(toGaki).toHaveLength(0);
  });

  it("contentHash が SHA-256 形式で生成される", () => {
    const text = "○議長（湊俊文） ただいまから会議を開きます。";

    const statements = parseStatements(text);
    expect(statements.length).toBeGreaterThan(0);
    expect(statements[0]!.contentHash).toMatch(/^[a-f0-9]{64}$/);
  });

  it("offset が正しく計算される", () => {
    const text = "○議長（湊俊文） ただいま。\n○町長（箕野博司） お答えします。";

    const statements = parseStatements(text);
    expect(statements.length).toBeGreaterThanOrEqual(2);
    expect(statements[0]!.startOffset).toBe(0);
    expect(statements[0]!.endOffset).toBe("ただいま。".length);
    expect(statements[1]!.startOffset).toBe("ただいま。".length + 1);
  });

  it("発言が空のテキストでは空配列を返す", () => {
    const text = "- 1 - 議事日程\n午前10時開会";
    const statements = parseStatements(text);
    expect(statements).toHaveLength(0);
  });
});
