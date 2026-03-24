import { describe, expect, it } from "vitest";
import { parseSpeaker, classifyKind, parseStatements } from "./detail";

describe("parseSpeaker", () => {
  it("議長を正しくパースする", () => {
    const result = parseSpeaker("○議長（田中一郎君） ただいまから本日の会議を開きます。");
    expect(result.speakerName).toBe("田中一郎");
    expect(result.speakerRole).toBe("議長");
    expect(result.content).toBe("ただいまから本日の会議を開きます。");
  });

  it("町長を正しくパースする", () => {
    const result = parseSpeaker("○町長（山田太郎君） お答えいたします。");
    expect(result.speakerName).toBe("山田太郎");
    expect(result.speakerRole).toBe("町長");
    expect(result.content).toBe("お答えいたします。");
  });

  it("課長を正しくパースする", () => {
    const result = parseSpeaker("○総務課長（鈴木花子君） ご報告いたします。");
    expect(result.speakerName).toBe("鈴木花子");
    expect(result.speakerRole).toBe("課長");
    expect(result.content).toBe("ご報告いたします。");
  });

  it("番号付き議員を正しくパースする（半角数字）", () => {
    const result = parseSpeaker("○3番（佐藤次郎君） 質問いたします。");
    expect(result.speakerName).toBe("佐藤次郎");
    expect(result.speakerRole).toBe("議員");
    expect(result.content).toBe("質問いたします。");
  });

  it("番号付き議員を正しくパースする（全角数字）", () => {
    const result = parseSpeaker("○３番（佐藤次郎君） 質問いたします。");
    expect(result.speakerName).toBe("佐藤次郎");
    expect(result.speakerRole).toBe("議員");
    expect(result.content).toBe("質問いたします。");
  });

  it("副町長を正しくパースする", () => {
    const result = parseSpeaker("○副町長（高橋三郎君） ご説明します。");
    expect(result.speakerName).toBe("高橋三郎");
    expect(result.speakerRole).toBe("副町長");
    expect(result.content).toBe("ご説明します。");
  });

  it("副議長を正しくパースする", () => {
    const result = parseSpeaker("○副議長（木村四郎君） 議長に代わりまして。");
    expect(result.speakerName).toBe("木村四郎");
    expect(result.speakerRole).toBe("副議長");
    expect(result.content).toBe("議長に代わりまして。");
  });

  it("委員長を正しくパースする", () => {
    const result = parseSpeaker("○総務常任委員長（中村五郎君） 報告いたします。");
    expect(result.speakerName).toBe("中村五郎");
    expect(result.speakerRole).toBe("委員長");
    expect(result.content).toBe("報告いたします。");
  });

  it("教育長を正しくパースする", () => {
    const result = parseSpeaker("○教育長（小林六郎君） お答えします。");
    expect(result.speakerName).toBe("小林六郎");
    expect(result.speakerRole).toBe("教育長");
    expect(result.content).toBe("お答えします。");
  });

  it("マーカーなしのテキストもパースを試みる", () => {
    const result = parseSpeaker("議長（田中一郎君） 開会します。");
    expect(result.speakerName).toBe("田中一郎");
    expect(result.speakerRole).toBe("議長");
    expect(result.content).toBe("開会します。");
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

  it("課長は answer", () => {
    expect(classifyKind("課長")).toBe("answer");
  });

  it("部長は answer", () => {
    expect(classifyKind("部長")).toBe("answer");
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
  it("発言者行から発言を抽出する", () => {
    const text = [
      "○議長（田中一郎君） ただいまから本日の会議を開きます。",
      "○3番（佐藤次郎君） 質問いたします。",
      "○町長（山田太郎君） お答えいたします。",
    ].join("\n");

    const statements = parseStatements(text);

    expect(statements).toHaveLength(3);

    expect(statements[0]!.speakerName).toBe("田中一郎");
    expect(statements[0]!.speakerRole).toBe("議長");
    expect(statements[0]!.kind).toBe("remark");
    expect(statements[0]!.content).toBe("ただいまから本日の会議を開きます。");

    expect(statements[1]!.speakerName).toBe("佐藤次郎");
    expect(statements[1]!.speakerRole).toBe("議員");
    expect(statements[1]!.kind).toBe("question");

    expect(statements[2]!.speakerName).toBe("山田太郎");
    expect(statements[2]!.speakerRole).toBe("町長");
    expect(statements[2]!.kind).toBe("answer");
  });

  it("複数行にわたる発言をまとめる", () => {
    const text = [
      "○議長（田中一郎君） ただいまから",
      "本日の会議を",
      "開きます。",
      "○3番（佐藤次郎君） 質問します。",
    ].join("\n");

    const statements = parseStatements(text);

    expect(statements).toHaveLength(2);
    expect(statements[0]!.content).toContain("ただいまから");
    expect(statements[0]!.content).toContain("本日の会議を");
    expect(statements[0]!.content).toContain("開きます。");
  });

  it("contentHash が生成される", () => {
    const text = "○議長（田中一郎君） ただいまから会議を開きます。";
    const statements = parseStatements(text);
    expect(statements).toHaveLength(1);
    expect(statements[0]!.contentHash).toMatch(/^[a-f0-9]{64}$/);
  });

  it("発言者がいない場合は空配列を返す", () => {
    const text = "議事日程\n第1 開会\n第2 議案審議";
    const statements = parseStatements(text);
    expect(statements).toHaveLength(0);
  });

  it("PDF 抽出の文字間スペースを除去して正しくパースする", () => {
    // PDF で抽出されたテキストには文字間にスペースが入ることがある
    const text = "○議 長（田 中 一 郎 君） 開 会 し ま す 。";
    const statements = parseStatements(text);
    expect(statements).toHaveLength(1);
    expect(statements[0]!.speakerRole).toBe("議長");
    expect(statements[0]!.speakerName).toBe("田中一郎");
  });

  it("startOffset と endOffset が設定される", () => {
    const text = [
      "○議長（田中一郎君） 開会します。",
      "○3番（佐藤次郎君） 質問します。",
    ].join("\n");

    const statements = parseStatements(text);
    expect(statements).toHaveLength(2);
    expect(statements[0]!.startOffset).toBe(0);
    expect(statements[0]!.endOffset).toBeGreaterThan(0);
    expect(statements[1]!.startOffset).toBeGreaterThan(statements[0]!.endOffset);
  });
});
