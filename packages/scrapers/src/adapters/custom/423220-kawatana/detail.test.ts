import { describe, expect, it } from "vitest";
import { parseSpeaker, classifyKind, parseStatements } from "./detail";

describe("parseSpeaker", () => {
  it("議長を正しくパースする", () => {
    const result = parseSpeaker("○議長（中村義人君）　ただいまから会議を開きます。");
    expect(result.speakerName).toBe("中村義人");
    expect(result.speakerRole).toBe("議長");
    expect(result.content).toBe("ただいまから会議を開きます。");
  });

  it("副議長を正しくパースする", () => {
    const result = parseSpeaker("○副議長（山田太郎君）　議事を進めます。");
    expect(result.speakerName).toBe("山田太郎");
    expect(result.speakerRole).toBe("副議長");
    expect(result.content).toBe("議事を進めます。");
  });

  it("町長を正しくパースする", () => {
    const result = parseSpeaker("○町長（中島慎太郎君）　お答えいたします。");
    expect(result.speakerName).toBe("中島慎太郎");
    expect(result.speakerRole).toBe("町長");
    expect(result.content).toBe("お答えいたします。");
  });

  it("番号付き議員を正しくパースする", () => {
    const result = parseSpeaker("○３番（田中君）　質問いたします。");
    expect(result.speakerName).toBe("田中");
    expect(result.speakerRole).toBe("議員");
    expect(result.content).toBe("質問いたします。");
  });

  it("課長を正しくパースする", () => {
    const result = parseSpeaker("○総務課長（山本君）　ご説明いたします。");
    expect(result.speakerName).toBe("山本");
    expect(result.speakerRole).toBe("課長");
    expect(result.content).toBe("ご説明いたします。");
  });

  it("教育長を正しくパースする", () => {
    const result = parseSpeaker("○教育長（鈴木花子君）　ご答弁申し上げます。");
    expect(result.speakerName).toBe("鈴木花子");
    expect(result.speakerRole).toBe("教育長");
    expect(result.content).toBe("ご答弁申し上げます。");
  });

  it("◯マーカー（U+25EF）でもパースできる", () => {
    const result = parseSpeaker("◯議長（中村義人君）　会議を開きます。");
    expect(result.speakerRole).toBe("議長");
    expect(result.content).toBe("会議を開きます。");
  });

  it("カッコなしのパターンでもパースできる", () => {
    const result = parseSpeaker("○議長　会議を開きます。");
    expect(result.speakerName).toBeNull();
    expect(result.speakerRole).toBe("議長");
    expect(result.content).toBe("会議を開きます。");
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

  it("議会運営委員長は remark", () => {
    expect(classifyKind("議会運営委員長")).toBe("remark");
  });

  it("町長は answer", () => {
    expect(classifyKind("町長")).toBe("answer");
  });

  it("課長は answer", () => {
    expect(classifyKind("課長")).toBe("answer");
  });

  it("教育長は answer", () => {
    expect(classifyKind("教育長")).toBe("answer");
  });

  it("議員は question", () => {
    expect(classifyKind("議員")).toBe("question");
  });

  it("null は remark", () => {
    expect(classifyKind(null)).toBe("remark");
  });
});

describe("parseStatements", () => {
  it("○マーカーで発言を分割する", () => {
    const text = "○議長（中村義人君）　ただいまから会議を開きます。\n○町長（中島慎太郎君）　お答えいたします。\n○３番（田中君）　質問いたします。";

    const statements = parseStatements(text);

    expect(statements).toHaveLength(3);

    expect(statements[0]!.speakerName).toBe("中村義人");
    expect(statements[0]!.speakerRole).toBe("議長");
    expect(statements[0]!.kind).toBe("remark");
    expect(statements[0]!.content).toBe("ただいまから会議を開きます。");

    expect(statements[1]!.speakerName).toBe("中島慎太郎");
    expect(statements[1]!.speakerRole).toBe("町長");
    expect(statements[1]!.kind).toBe("answer");

    expect(statements[2]!.speakerName).toBe("田中");
    expect(statements[2]!.speakerRole).toBe("議員");
    expect(statements[2]!.kind).toBe("question");
  });

  it("議事日程見出しをスキップする", () => {
    const text = "○議事日程\n第1 開会\n○議長（中村義人君）　開会します。";

    const statements = parseStatements(text);
    expect(statements).toHaveLength(1);
    expect(statements[0]!.speakerRole).toBe("議長");
  });

  it("出席議員見出しをスキップする", () => {
    const text = "○出席議員（10名）\n1番 田中\n○議長（中村義人君）　開会します。";

    const statements = parseStatements(text);
    expect(statements).toHaveLength(1);
  });

  it("contentHash が SHA-256 形式で生成される", () => {
    const text = "○議長（中村義人君）　ただいまから会議を開きます。";

    const statements = parseStatements(text);
    expect(statements[0]!.contentHash).toMatch(/^[a-f0-9]{64}$/);
  });

  it("offset が正しく計算される", () => {
    const text = "○議長（中村君）　ただいま。\n○町長（中島君）　答弁します。";

    const statements = parseStatements(text);
    expect(statements[0]!.startOffset).toBe(0);
    expect(statements[0]!.endOffset).toBe("ただいま。".length);
    expect(statements[1]!.startOffset).toBe("ただいま。".length + 1);
  });

  it("◯マーカー（U+25EF）にも対応する", () => {
    const text = "◯議長（中村君）　開会します。";

    const statements = parseStatements(text);
    expect(statements).toHaveLength(1);
    expect(statements[0]!.speakerRole).toBe("議長");
  });

  it("content が空の発言はスキップする", () => {
    const text = "○議長（中村君）\n○町長（中島君）　答弁します。";

    const statements = parseStatements(text);
    // content が空のものはスキップされる
    const withContent = statements.filter((s) => s.content.length > 0);
    expect(withContent).toHaveLength(statements.length);
  });
});
