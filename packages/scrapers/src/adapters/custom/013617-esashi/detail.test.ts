import { describe, it, expect } from "vitest";
import { parseSpeaker, classifyKind, parseStatements } from "./detail";

describe("parseSpeaker", () => {
  it("（議長）パターンを解析する", () => {
    const result = parseSpeaker("（議長）");
    expect(result.speakerName).toBeNull();
    expect(result.speakerRole).toBe("議長");
  });

  it("「町長」パターンを解析する", () => {
    const result = parseSpeaker("「町長」");
    expect(result.speakerName).toBeNull();
    expect(result.speakerRole).toBe("町長");
  });

  it("「副町長」パターンを解析する", () => {
    const result = parseSpeaker("「副町長」");
    expect(result.speakerName).toBeNull();
    expect(result.speakerRole).toBe("副町長");
  });

  it("「増永議員」パターンから名前と役職を抽出する", () => {
    const result = parseSpeaker("「増永議員」");
    expect(result.speakerName).toBe("増永");
    expect(result.speakerRole).toBe("議員");
  });

  it("「小野寺議員」パターンから名前と役職を抽出する", () => {
    const result = parseSpeaker("「小野寺議員」");
    expect(result.speakerName).toBe("小野寺");
    expect(result.speakerRole).toBe("議員");
  });

  it("「財政課長」パターンを解析する", () => {
    const result = parseSpeaker("「財政課長」");
    expect(result.speakerName).toBe("財政");
    expect(result.speakerRole).toBe("課長");
  });

  it("「まちづくり推進課長」パターンを解析する", () => {
    const result = parseSpeaker("「まちづくり推進課長」");
    expect(result.speakerName).toBe("まちづくり推進");
    expect(result.speakerRole).toBe("課長");
  });

  it("「教育長」パターンを解析する", () => {
    const result = parseSpeaker("「教育長」");
    expect(result.speakerName).toBeNull();
    expect(result.speakerRole).toBe("教育長");
  });

  it("「室井委員長」パターンから名前と役職を抽出する", () => {
    const result = parseSpeaker("「室井委員長」");
    expect(result.speakerName).toBe("室井");
    expect(result.speakerRole).toBe("委員長");
  });

  it("「総務課長」パターンを解析する", () => {
    const result = parseSpeaker("「総務課長」");
    expect(result.speakerName).toBe("総務");
    expect(result.speakerRole).toBe("課長");
  });

  it("「高齢あんしん課長」パターンを解析する", () => {
    const result = parseSpeaker("「高齢あんしん課長」");
    expect(result.speakerName).toBe("高齢あんしん");
    expect(result.speakerRole).toBe("課長");
  });

  it("マーカーでないテキストは null を返す", () => {
    const result = parseSpeaker("テスト");
    expect(result.speakerName).toBeNull();
    expect(result.speakerRole).toBeNull();
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

  it("部長は answer", () => {
    expect(classifyKind("部長")).toBe("answer");
  });

  it("議員は question", () => {
    expect(classifyKind("議員")).toBe("question");
  });

  it("null は remark", () => {
    expect(classifyKind(null)).toBe("remark");
  });
});

describe("parseStatements", () => {
  it("（議長）マーカーで発言を抽出する", () => {
    const text = `（議長） ただいまの出席議員数は１２名です。定足数に達しておりますので、会議は成立致しました。`;

    const statements = parseStatements(text);

    expect(statements).toHaveLength(1);
    expect(statements[0]!.kind).toBe("remark");
    expect(statements[0]!.speakerRole).toBe("議長");
    expect(statements[0]!.content).toMatch(/ただいまの出席議員数は/);
  });

  it("「」マーカーで各種発言者を抽出する", () => {
    const text = `（議長） 提案理由の説明を求めます。 「町長」 議長。 （議長） 町長。 「町長」 報告第１号について説明します。`;

    const statements = parseStatements(text);

    // 「町長」 議長。 はスキップされる
    expect(statements.length).toBeGreaterThanOrEqual(2);

    const chairStatements = statements.filter(
      (s) => s.speakerRole === "議長",
    );
    expect(chairStatements.length).toBeGreaterThanOrEqual(1);

    const mayorStatements = statements.filter(
      (s) => s.speakerRole === "町長",
    );
    expect(mayorStatements.length).toBeGreaterThanOrEqual(1);
  });

  it("議員の質問を question として分類する", () => {
    const text = `「増永議員」 町長にお伺いします。人口減少対策について、具体的な施策をお聞かせください。`;

    const statements = parseStatements(text);

    expect(statements).toHaveLength(1);
    expect(statements[0]!.kind).toBe("question");
    expect(statements[0]!.speakerName).toBe("増永");
    expect(statements[0]!.speakerRole).toBe("議員");
  });

  it("課長の答弁を answer として分類する", () => {
    const text = `「財政課長」（補足説明） おはようございます。それでは報告第１号について、補足説明をさせて頂きます。`;

    const statements = parseStatements(text);

    expect(statements).toHaveLength(1);
    expect(statements[0]!.kind).toBe("answer");
    expect(statements[0]!.speakerRole).toBe("課長");
  });

  it("各 statement に contentHash が付与される", () => {
    const statements = parseStatements(
      "（議長） テスト発言。",
    );
    expect(statements[0]!.contentHash).toMatch(/^[a-f0-9]{64}$/);
  });

  it("offset が正しく計算される", () => {
    const text = `（議長） ただいま。 「町長」 お答えします。`;

    const statements = parseStatements(text);

    expect(statements[0]!.startOffset).toBe(0);
    expect(statements[0]!.endOffset).toBe(statements[0]!.content.length);
    expect(statements[1]!.startOffset).toBe(
      statements[0]!.content.length + 1,
    );
  });

  it("「なし」等の非発言者パターンはスキップする", () => {
    const text = `（議長） 質疑希望ありませんか。 （「なし」の声） （議長） 質疑希望ありませんので、終わります。`;

    const statements = parseStatements(text);

    // 「なし」は発言者としてカウントされない
    const roles = statements.map((s) => s.speakerRole);
    expect(roles.every((r) => r === "議長")).toBe(true);
  });

  it("「議長。」のみの呼びかけはスキップする", () => {
    const text = `「町長」 議長。 （議長） 町長。 「町長」 お答えいたします。`;

    const statements = parseStatements(text);

    // 「町長」 議長。 の短い呼びかけはスキップ
    // （議長） 町長。 は残る（議長が許可する発言）
    const mayorStatements = statements.filter(
      (s) => s.speakerRole === "町長",
    );
    expect(mayorStatements).toHaveLength(1);
    expect(mayorStatements[0]!.content).toMatch(/お答えいたします/);
  });

  it("空テキストは空配列を返す", () => {
    expect(parseStatements("")).toEqual([]);
  });
});
