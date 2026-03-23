import { describe, expect, it } from "vitest";
import { parseSpeaker, classifyKind, parseStatements } from "./detail";

describe("parseSpeaker", () => {
  it("議長を正しくパースする", () => {
    const result = parseSpeaker("○議長（疋田俊文） 本日の会議を開きます。");
    expect(result.speakerName).toBe("疋田俊文");
    expect(result.speakerRole).toBe("議長");
    expect(result.content).toBe("本日の会議を開きます。");
  });

  it("町長を正しくパースする", () => {
    const result = parseSpeaker("○町長（森川喜之） おはようございます。");
    expect(result.speakerName).toBe("森川喜之");
    expect(result.speakerRole).toBe("町長");
    expect(result.content).toBe("おはようございます。");
  });

  it("副町長を正しくパースする", () => {
    const result = parseSpeaker("○副町長（佐藤壮浩） ご説明いたします。");
    expect(result.speakerName).toBe("佐藤壮浩");
    expect(result.speakerRole).toBe("副町長");
    expect(result.content).toBe("ご説明いたします。");
  });

  it("番号付き議員を正しくパースする", () => {
    const result = parseSpeaker("○３番（梅野美智代） はい、議長。");
    expect(result.speakerName).toBe("梅野美智代");
    expect(result.speakerRole).toBe("議員");
    expect(result.content).toBe("はい、議長。");
  });

  it("部長（複合役職名）を正しくパースする", () => {
    const result = parseSpeaker("○総務部長（上村卓也） ご報告いたします。");
    expect(result.speakerName).toBe("上村卓也");
    expect(result.speakerRole).toBe("部長");
    expect(result.content).toBe("ご報告いたします。");
  });

  it("教育長を正しくパースする", () => {
    const result = parseSpeaker("○教育長（上村欣也） 答弁申し上げます。");
    expect(result.speakerName).toBe("上村欣也");
    expect(result.speakerRole).toBe("教育長");
    expect(result.content).toBe("答弁申し上げます。");
  });

  it("○マーカーのない行は speakerName・speakerRole が null", () => {
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

  it("副委員長は remark", () => {
    expect(classifyKind("副委員長")).toBe("remark");
  });

  it("町長は answer", () => {
    expect(classifyKind("町長")).toBe("answer");
  });

  it("副町長は answer", () => {
    expect(classifyKind("副町長")).toBe("answer");
  });

  it("部長は answer", () => {
    expect(classifyKind("部長")).toBe("answer");
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
  it("○ マーカーで発言を正しく分割する", () => {
    const text = `
○議長（疋田俊文） 本日の会議を開きます。
○町長（森川喜之） おはようございます。令和６年第３回定例会の開催に当たりまして。
○３番（梅野美智代） はい、議長。
    `.trim();

    const statements = parseStatements(text);

    expect(statements).toHaveLength(3);

    expect(statements[0]!.speakerName).toBe("疋田俊文");
    expect(statements[0]!.speakerRole).toBe("議長");
    expect(statements[0]!.kind).toBe("remark");
    expect(statements[0]!.content).toBe("本日の会議を開きます。");

    expect(statements[1]!.speakerName).toBe("森川喜之");
    expect(statements[1]!.speakerRole).toBe("町長");
    expect(statements[1]!.kind).toBe("answer");

    expect(statements[2]!.speakerName).toBe("梅野美智代");
    expect(statements[2]!.speakerRole).toBe("議員");
    expect(statements[2]!.kind).toBe("question");
  });

  it("登壇のト書きをスキップする", () => {
    const text = `
○町長（森川喜之） はい、議長。
○町長（森川喜之登壇）
○町長（森川喜之） おはようございます。
    `.trim();

    const statements = parseStatements(text);

    // 登壇のト書きはスキップされる
    expect(statements.length).toBeLessThanOrEqual(2);
    expect(statements.some((s) => s.content === "")).toBe(false);
  });

  it("contentHash が SHA-256 で生成される", () => {
    const text = "○議長（疋田俊文） 会議を開きます。";

    const statements = parseStatements(text);

    expect(statements).toHaveLength(1);
    expect(statements[0]!.contentHash).toMatch(/^[a-f0-9]{64}$/);
  });

  it("offset が正しく計算される", () => {
    const text = `○議長（疋田俊文） 開会します。
○町長（森川喜之） ありがとう。`;

    const statements = parseStatements(text);

    expect(statements[0]!.startOffset).toBe(0);
    expect(statements[0]!.endOffset).toBe("開会します。".length);
    expect(statements[1]!.startOffset).toBe("開会します。".length + 1);
  });

  it("○ マーカーのないテキストブロックはスキップされる", () => {
    const text = `
河合町議会会議録 令和６年９月６日開会
○議長（疋田俊文） 本日の会議を開きます。
    `.trim();

    const statements = parseStatements(text);

    expect(statements).toHaveLength(1);
    expect(statements[0]!.speakerRole).toBe("議長");
  });
});
