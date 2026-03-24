import { describe, expect, it } from "vitest";
import { parseSpeakerText, classifyKind, parseStatementsFromItems } from "./detail";

describe("parseSpeakerText", () => {
  it("議長をパースする", () => {
    const result = parseSpeakerText("議長");
    expect(result.role).toBe("議長");
    expect(result.name).toBeNull();
  });

  it("坂本町長をパースする（名前+役職）", () => {
    const result = parseSpeakerText("坂本町長");
    expect(result.role).toBe("町長");
    expect(result.name).toBe("坂本");
  });

  it("副議長をパースする", () => {
    const result = parseSpeakerText("副議長");
    expect(result.role).toBe("副議長");
    expect(result.name).toBeNull();
  });

  it("副委員長を副議長より先にマッチする（長い方を優先）", () => {
    const result = parseSpeakerText("副委員長");
    expect(result.role).toBe("副委員長");
    expect(result.name).toBeNull();
  });

  it("副町長をパースする", () => {
    const result = parseSpeakerText("八十島副町長");
    expect(result.role).toBe("副町長");
    expect(result.name).toBe("八十島");
  });

  it("教育長をパースする", () => {
    const result = parseSpeakerText("三好教育長");
    expect(result.role).toBe("教育長");
    expect(result.name).toBe("三好");
  });

  it("番号付き議員をパースする（４番山田）", () => {
    const result = parseSpeakerText("４番山田");
    expect(result.role).toBe("議員");
    expect(result.name).toBe("山田");
  });

  it("課長をパースする", () => {
    const result = parseSpeakerText("友岡総務課長");
    expect(result.role).toBe("課長");
    expect(result.name).toBe("友岡総務");
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

describe("parseStatementsFromItems", () => {
  it("発言者と内容を正しく抽出する", () => {
    // 松野町 PDF の実際の構造を再現
    // 発言者は左カラム（x < 170, 短い文字列）
    // 内容は右カラム（x >= 177）
    const items = [
      // 議長 (x=78:'議', x=155:'長')
      { str: "議", x: 78.4, y: 767.8 },
      { str: "長", x: 155.3, y: 767.8 },
      // 議長の内容
      { str: "ただいまから、令和６年第４回松野町議会定例会を開会します。", x: 189.2, y: 767.8 },
      // 坂本町長 (x=78:'坂', x=104:'本', x=129:'町', x=155:'長')
      { str: "坂", x: 78.4, y: 692.2 },
      { str: "本", x: 104.0, y: 692.2 },
      { str: "町", x: 129.7, y: 692.2 },
      { str: "長", x: 155.3, y: 692.2 },
      // 坂本町長の内容
      { str: "「議長」", x: 189.2, y: 692.2 },
      // 坂本町長の発言継続
      { str: "それでは定例議会の開会にあたりまして、", x: 189.2, y: 641.8 },
      { str: "議長のお許しをいただき", x: 413.3, y: 641.8 },
      { str: "ましたので、一言御挨拶を申し上げます。", x: 177.2, y: 616.6 },
    ];

    const statements = parseStatementsFromItems(items);

    // 「議長」というト書き行はスキップされる
    expect(statements.length).toBeGreaterThanOrEqual(2);

    const gicho = statements.find((s) => s.speakerRole === "議長");
    expect(gicho).toBeDefined();
    expect(gicho!.kind).toBe("remark");
    expect(gicho!.content).toContain("ただいまから");

    const chocho = statements.find((s) => s.speakerRole === "町長");
    expect(chocho).toBeDefined();
    expect(chocho!.kind).toBe("answer");
    expect(chocho!.speakerName).toBe("坂本");
    expect(chocho!.content).toContain("それでは定例議会の開会");
  });

  it("番号付き議員（４番山田）を正しく処理する", () => {
    const items = [
      // ４番山田
      { str: "４", x: 78.4, y: 238.6 },
      { str: "番", x: 104.0, y: 238.6 },
      { str: "山", x: 129.7, y: 238.6 },
      { str: "田", x: 155.3, y: 238.6 },
      // 内容
      { str: "質問いたします。", x: 189.2, y: 238.6 },
    ];

    const statements = parseStatementsFromItems(items);

    expect(statements).toHaveLength(1);
    expect(statements[0]!.speakerRole).toBe("議員");
    expect(statements[0]!.speakerName).toBe("山田");
    expect(statements[0]!.kind).toBe("question");
    expect(statements[0]!.content).toBe("質問いたします。");
  });

  it("contentHash が SHA-256 で生成される", () => {
    const items = [
      { str: "議", x: 78.4, y: 767.8 },
      { str: "長", x: 155.3, y: 767.8 },
      { str: "本日の会議を開きます。", x: 189.2, y: 767.8 },
    ];

    const statements = parseStatementsFromItems(items);

    expect(statements[0]!.contentHash).toMatch(/^[a-f0-9]{64}$/);
  });

  it("対話マーカー行（「議長」等）をスキップする", () => {
    const items = [
      // 坂本町長
      { str: "坂", x: 78.4, y: 692.2 },
      { str: "本", x: 104.0, y: 692.2 },
      { str: "町", x: 129.7, y: 692.2 },
      { str: "長", x: 155.3, y: 692.2 },
      // 対話マーカー行（スキップされるべき）
      { str: "「議長」", x: 189.2, y: 692.2 },
      // 実際の内容
      { str: "お答えいたします。", x: 189.2, y: 667.0 },
    ];

    const statements = parseStatementsFromItems(items);

    expect(statements).toHaveLength(1);
    expect(statements[0]!.content).toBe("お答えいたします。");
  });

  it("発言がない場合は空配列を返す", () => {
    const statements = parseStatementsFromItems([]);
    expect(statements).toHaveLength(0);
  });
});
