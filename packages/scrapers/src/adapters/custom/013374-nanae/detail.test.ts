import { describe, expect, it } from "vitest";
import { parseSpeaker, classifyKind, parseStatements } from "./detail";

describe("parseSpeaker", () => {
  it("議長（氏名君）パターンを解析する", () => {
    const result = parseSpeaker("○議長（田村一義君）");
    expect(result.speakerName).toBeNull();
    expect(result.speakerRole).toBe("議長");
  });

  it("町長（氏名君）パターンを解析する", () => {
    const result = parseSpeaker("○町長（中宮安一君）");
    expect(result.speakerName).toBeNull();
    expect(result.speakerRole).toBe("町長");
  });

  it("副町長パターンを解析する", () => {
    const result = parseSpeaker("○副町長（山田太郎君）");
    expect(result.speakerName).toBeNull();
    expect(result.speakerRole).toBe("副町長");
  });

  it("総務課長パターンを解析する", () => {
    const result = parseSpeaker("○総務課長（鈴木一郎君）");
    expect(result.speakerName).toBe("総務");
    expect(result.speakerRole).toBe("課長");
  });

  it("議員番号パターンを解析する", () => {
    const result = parseSpeaker("○3番（田村一義君）");
    expect(result.speakerName).toBeNull();
    expect(result.speakerRole).toBe("議員");
  });

  it("副議長パターンを解析する", () => {
    const result = parseSpeaker("○副議長（佐藤花子君）");
    expect(result.speakerName).toBeNull();
    expect(result.speakerRole).toBe("副議長");
  });

  it("委員長パターンを解析する", () => {
    const result = parseSpeaker("○委員長（田中次郎君）");
    expect(result.speakerName).toBeNull();
    expect(result.speakerRole).toBe("委員長");
  });

  it("副委員長パターンを解析する", () => {
    const result = parseSpeaker("○副委員長（高橋三郎君）");
    expect(result.speakerName).toBeNull();
    expect(result.speakerRole).toBe("副委員長");
  });

  it("教育長パターンを解析する", () => {
    const result = parseSpeaker("○教育長（中村四郎君）");
    expect(result.speakerName).toBeNull();
    expect(result.speakerRole).toBe("教育長");
  });

  it("まちづくり推進課長パターンを解析する", () => {
    const result = parseSpeaker("○まちづくり推進課長（伊藤五郎君）");
    expect(result.speakerName).toBe("まちづくり推進");
    expect(result.speakerRole).toBe("課長");
  });

  it("括弧なしの議長パターンを解析する", () => {
    const result = parseSpeaker("○議長");
    expect(result.speakerName).toBeNull();
    expect(result.speakerRole).toBe("議長");
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

  it("総務課長サフィックスは answer", () => {
    expect(classifyKind("総務課長")).toBe("answer");
  });

  it("議員は question", () => {
    expect(classifyKind("議員")).toBe("question");
  });

  it("null は remark", () => {
    expect(classifyKind(null)).toBe("remark");
  });
});

describe("parseStatements", () => {
  it("○議長マーカーで発言を抽出する", () => {
    const text = `○議長（田村一義君） ただいまの出席議員数は１２名です。定足数に達しておりますので、会議は成立いたしました。`;

    const statements = parseStatements(text);

    expect(statements).toHaveLength(1);
    expect(statements[0]!.kind).toBe("remark");
    expect(statements[0]!.speakerRole).toBe("議長");
    expect(statements[0]!.content).toMatch(/ただいまの出席議員数は/);
  });

  it("町長の発言を answer として分類する", () => {
    const text = `○町長（中宮安一君） お答えいたします。七飯町の発展のため積極的に取り組んでまいります。`;

    const statements = parseStatements(text);

    expect(statements).toHaveLength(1);
    expect(statements[0]!.kind).toBe("answer");
    expect(statements[0]!.speakerRole).toBe("町長");
  });

  it("議員番号パターンの発言を question として分類する", () => {
    const text = `○3番（田村一義君） 町長にお伺いします。今後の観光振興策についてお聞かせください。`;

    const statements = parseStatements(text);

    expect(statements).toHaveLength(1);
    expect(statements[0]!.kind).toBe("question");
    expect(statements[0]!.speakerRole).toBe("議員");
  });

  it("複数の発言者を正しく抽出する", () => {
    const text = `○議長（田村一義君） 提案理由の説明を求めます。○町長（中宮安一君） 議案第１号について説明します。○3番（田村一義君） 質問いたします。`;

    const statements = parseStatements(text);

    expect(statements).toHaveLength(3);
    expect(statements[0]!.speakerRole).toBe("議長");
    expect(statements[0]!.kind).toBe("remark");
    expect(statements[1]!.speakerRole).toBe("町長");
    expect(statements[1]!.kind).toBe("answer");
    expect(statements[2]!.speakerRole).toBe("議員");
    expect(statements[2]!.kind).toBe("question");
  });

  it("課長の答弁を answer として分類する", () => {
    const text = `○総務課長（鈴木一郎君） ご説明いたします。予算の概要は以下のとおりです。`;

    const statements = parseStatements(text);

    expect(statements).toHaveLength(1);
    expect(statements[0]!.kind).toBe("answer");
    expect(statements[0]!.speakerRole).toBe("課長");
    expect(statements[0]!.speakerName).toBe("総務");
  });

  it("contentHash が SHA-256 形式で生成される", () => {
    const text = `○議長（田村一義君） テスト発言。`;

    const statements = parseStatements(text);

    expect(statements[0]!.contentHash).toMatch(/^[a-f0-9]{64}$/);
  });

  it("offset が正しく計算される", () => {
    const text = `○議長（田村一義君） ただいま。○町長（中宮安一君） お答えします。`;

    const statements = parseStatements(text);

    expect(statements[0]!.startOffset).toBe(0);
    expect(statements[0]!.endOffset).toBe(statements[0]!.content.length);
    expect(statements[1]!.startOffset).toBe(statements[0]!.content.length + 1);
  });

  it("空テキストは空配列を返す", () => {
    expect(parseStatements("")).toEqual([]);
  });

  it("発言マーカーがない場合は空配列を返す", () => {
    const text = `令和６年第４回七飯町議会定例会会議録`;

    const statements = parseStatements(text);
    expect(statements).toHaveLength(0);
  });

  it("空の発言内容はスキップする", () => {
    const text = `○議長（田村一義君） ○町長（中宮安一君） お答えします。`;

    const statements = parseStatements(text);

    const nonEmpty = statements.filter((s) => s.content.trim() !== "");
    expect(nonEmpty.length).toBeGreaterThanOrEqual(1);
    expect(nonEmpty.some((s) => s.speakerRole === "町長")).toBe(true);
  });
});
