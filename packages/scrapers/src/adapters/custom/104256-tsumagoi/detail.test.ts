import { describe, expect, it } from "vitest";
import { parseSpeaker, classifyKind, parseStatements } from "./detail";

describe("parseSpeaker", () => {
  it("議長を正しくパースする", () => {
    const result = parseSpeaker("○議長（佐藤鈴江君） ただいまから本日の会議を開きます。");
    expect(result.speakerName).toBe("佐藤鈴江");
    expect(result.speakerRole).toBe("議長");
    expect(result.content).toBe("ただいまから本日の会議を開きます。");
  });

  it("村長を正しくパースする", () => {
    const result = parseSpeaker("○村長（熊川栄君） お答えいたします。");
    expect(result.speakerName).toBe("熊川栄");
    expect(result.speakerRole).toBe("村長");
    expect(result.content).toBe("お答えいたします。");
  });

  it("副村長を正しくパースする", () => {
    const result = parseSpeaker("○副村長（黒岩彰君） ご報告いたします。");
    expect(result.speakerName).toBe("黒岩彰");
    expect(result.speakerRole).toBe("副村長");
    expect(result.content).toBe("ご報告いたします。");
  });

  it("課長を正しくパースする", () => {
    const result = parseSpeaker("○交流推進課長（小林千速君） ご報告いたします。");
    expect(result.speakerName).toBe("小林千速");
    expect(result.speakerRole).toBe("課長");
    expect(result.content).toBe("ご報告いたします。");
  });

  it("議員番号パターン（半角数字）を正しくパースする", () => {
    const result = parseSpeaker("○3番（伊東正吾君） 質問いたします。");
    expect(result.speakerName).toBe("伊東正吾");
    expect(result.speakerRole).toBe("議員");
    expect(result.content).toBe("質問いたします。");
  });

  it("議員番号パターン（全角数字）を正しくパースする", () => {
    const result = parseSpeaker("○３番（伊東正吾君） 質問いたします。");
    expect(result.speakerName).toBe("伊東正吾");
    expect(result.speakerRole).toBe("議員");
    expect(result.content).toBe("質問いたします。");
  });

  it("２桁の議員番号もパースする", () => {
    const result = parseSpeaker("○１２番（山田太郎君） 質問します。");
    expect(result.speakerName).toBe("山田太郎");
    expect(result.speakerRole).toBe("議員");
    expect(result.content).toBe("質問します。");
  });

  it("委員長を正しくパースする", () => {
    const result = parseSpeaker("○議会運営委員長（土屋幸雄君） 報告いたします。");
    expect(result.speakerName).toBe("土屋幸雄");
    expect(result.speakerRole).toBe("委員長");
    expect(result.content).toBe("報告いたします。");
  });

  it("全角スペースを含む氏名を正しくパースする", () => {
    const result = parseSpeaker("○村長（熊川　栄君） お答えいたします。");
    expect(result.speakerName).toBe("熊川栄");
    expect(result.speakerRole).toBe("村長");
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

  it("村長は answer", () => {
    expect(classifyKind("村長")).toBe("answer");
  });

  it("副村長は answer", () => {
    expect(classifyKind("副村長")).toBe("answer");
  });

  it("課長は answer", () => {
    expect(classifyKind("課長")).toBe("answer");
  });

  it("部長は answer", () => {
    expect(classifyKind("部長")).toBe("answer");
  });

  it("議員は question", () => {
    expect(classifyKind("議員")).toBe("question");
  });

  it("null は remark", () => {
    expect(classifyKind(null)).toBe("remark");
  });

  it("交流推進課長（課長サフィックス）は answer", () => {
    expect(classifyKind("交流推進課長")).toBe("answer");
  });
});

describe("parseStatements", () => {
  it("発言者行から発言を抽出する", () => {
    const text = `
○議長（佐藤鈴江君） ただいまから本日の会議を開きます。
○３番（伊東正吾君） 質問いたします。
○村長（熊川栄君） お答えいたします。
`.trim();

    const statements = parseStatements(text);

    expect(statements).toHaveLength(3);

    expect(statements[0]!.speakerName).toBe("佐藤鈴江");
    expect(statements[0]!.speakerRole).toBe("議長");
    expect(statements[0]!.kind).toBe("remark");
    expect(statements[0]!.content).toBe("ただいまから本日の会議を開きます。");

    expect(statements[1]!.speakerName).toBe("伊東正吾");
    expect(statements[1]!.speakerRole).toBe("議員");
    expect(statements[1]!.kind).toBe("question");

    expect(statements[2]!.speakerName).toBe("熊川栄");
    expect(statements[2]!.speakerRole).toBe("村長");
    expect(statements[2]!.kind).toBe("answer");
  });

  it("ページ番号行（−N− 形式）を除去する", () => {
    const text = `
○議長（佐藤鈴江君） ただいまから会議を開きます。
−1−
○３番（伊東正吾君） 質問します。
`.trim();

    const statements = parseStatements(text);

    expect(statements).toHaveLength(2);
    expect(statements[0]!.content).toBe("ただいまから会議を開きます。");
    expect(statements[1]!.content).toBe("質問します。");
  });

  it("複数行にわたる発言をまとめる", () => {
    const text = `
○議長（佐藤鈴江君） ただいまから
本日の会議を
開きます。
○３番（伊東正吾君） 質問します。
`.trim();

    const statements = parseStatements(text);

    expect(statements).toHaveLength(2);
    expect(statements[0]!.content).toContain("ただいまから");
    expect(statements[0]!.content).toContain("本日の会議を");
    expect(statements[0]!.content).toContain("開きます。");
  });

  it("contentHash が生成される", () => {
    const text = "○議長（佐藤鈴江君） ただいまから会議を開きます。";
    const statements = parseStatements(text);
    expect(statements[0]!.contentHash).toMatch(/^[a-f0-9]{64}$/);
  });

  it("発言者がいない場合は空配列を返す", () => {
    const text = "議事日程\n第1 開会\n第2 議案審議";
    const statements = parseStatements(text);
    expect(statements).toHaveLength(0);
  });

  it("〔登壇〕形式のト書きはスキップする", () => {
    const text = `
○議長（佐藤鈴江君） ただいまから会議を開きます。
○（村長登壇）
○村長（熊川栄君） お答えいたします。
`.trim();

    const statements = parseStatements(text);

    expect(statements).toHaveLength(2);
    expect(statements[0]!.speakerRole).toBe("議長");
    expect(statements[1]!.speakerRole).toBe("村長");
  });
});
