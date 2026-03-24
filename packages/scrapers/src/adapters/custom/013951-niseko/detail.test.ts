import { describe, expect, it } from "vitest";
import { classifyKind, parseSpeakerLine, parseStatements } from "./detail";

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

  it("建設課長は answer（endsWith マッチ）", () => {
    expect(classifyKind("建設課長")).toBe("answer");
  });

  it("議員は question", () => {
    expect(classifyKind("議員")).toBe("question");
  });

  it("null は remark", () => {
    expect(classifyKind(null)).toBe("remark");
  });
});

describe("parseSpeakerLine", () => {
  it("議長の発言者行をパースする", () => {
    const result = parseSpeakerLine("○議長（青羽雄士君）");
    expect(result).not.toBeNull();
    expect(result!.role).toBe("議長");
    expect(result!.name).toBe("青羽雄士");
  });

  it("町長の発言者行をパースする", () => {
    const result = parseSpeakerLine("○町長（片山健也君）");
    expect(result).not.toBeNull();
    expect(result!.role).toBe("町長");
    expect(result!.name).toBe("片山健也");
  });

  it("副町長の発言者行をパースする", () => {
    const result = parseSpeakerLine("○副町長（山本契太君）");
    expect(result).not.toBeNull();
    expect(result!.role).toBe("副町長");
    expect(result!.name).toBe("山本契太");
  });

  it("番号付き議員の発言者行をパースする（役職は議員）", () => {
    const result = parseSpeakerLine("○3番（高木直良君）");
    expect(result).not.toBeNull();
    expect(result!.role).toBe("議員");
    expect(result!.name).toBe("高木直良");
  });

  it("10番の議員もパースできる", () => {
    const result = parseSpeakerLine("○10番（田中一郎君）");
    expect(result).not.toBeNull();
    expect(result!.role).toBe("議員");
    expect(result!.name).toBe("田中一郎");
  });

  it("○で始まらない行は null を返す", () => {
    const result = parseSpeakerLine("議長（青羽雄士君）");
    expect(result).toBeNull();
  });

  it("括弧なしの行は null を返す", () => {
    const result = parseSpeakerLine("○議長");
    expect(result).toBeNull();
  });

  it("空行は null を返す", () => {
    const result = parseSpeakerLine("");
    expect(result).toBeNull();
  });
});

describe("parseStatements", () => {
  it("発言者行と発言内容から ParsedStatement を生成する", () => {
    const pages = [
      [
        "令和6年(2024年)第4回ニセコ町議会定例会",
        "令和6年(2024年)12月19日（水曜日）",
        "◎開会の宣告",
        "○議長（青羽雄士君）",
        "ただいまの出席議員数は10名です。定足数に達しておりますので、これより会議を開きます。",
        "◎日程第1　会議録署名議員の指名",
        "○議長（青羽雄士君）",
        "日程第1、会議録署名議員の指名を行います。",
        "○3番（高木直良君）",
        "一般質問を行います。農業振興について伺います。",
        "○町長（片山健也君）",
        "お答えいたします。農業振興については取り組んでいます。",
      ].join("\n"),
    ];

    const statements = parseStatements(pages);

    expect(statements.length).toBeGreaterThan(0);
    const roles = statements.map((s) => s.speakerRole);
    expect(roles).toContain("議長");
    expect(roles).toContain("議員");
    expect(roles).toContain("町長");
  });

  it("議長の発言は kind が remark になる", () => {
    const pages = [
      [
        "○議長（青羽雄士君）",
        "ただいまから会議を開きます。",
      ].join("\n"),
    ];

    const statements = parseStatements(pages);

    expect(statements.length).toBeGreaterThan(0);
    const chairStatement = statements.find((s) => s.speakerRole === "議長");
    expect(chairStatement).toBeDefined();
    expect(chairStatement!.kind).toBe("remark");
  });

  it("議員の発言は kind が question になる", () => {
    const pages = [
      [
        "○5番（鈴木花子君）",
        "一般質問を行います。",
      ].join("\n"),
    ];

    const statements = parseStatements(pages);

    expect(statements.length).toBeGreaterThan(0);
    expect(statements[0]!.kind).toBe("question");
    expect(statements[0]!.speakerRole).toBe("議員");
    expect(statements[0]!.speakerName).toBe("鈴木花子");
  });

  it("町長の発言は kind が answer になる", () => {
    const pages = [
      [
        "○町長（片山健也君）",
        "ご質問にお答えします。",
      ].join("\n"),
    ];

    const statements = parseStatements(pages);

    expect(statements.length).toBeGreaterThan(0);
    expect(statements[0]!.kind).toBe("answer");
    expect(statements[0]!.speakerRole).toBe("町長");
  });

  it("contentHash が SHA-256 の hex 文字列である", () => {
    const pages = [
      [
        "○議長（青羽雄士君）",
        "ただいまから会議を開きます。",
      ].join("\n"),
    ];

    const statements = parseStatements(pages);
    expect(statements.length).toBeGreaterThan(0);
    expect(statements[0]!.contentHash).toMatch(/^[a-f0-9]{64}$/);
  });

  it("offset が正しく計算される", () => {
    const pages = [
      [
        "○議長（青羽雄士君）",
        "ただいまから会議を開きます。",
        "○町長（片山健也君）",
        "ご答弁いたします。",
      ].join("\n"),
    ];

    const statements = parseStatements(pages);
    expect(statements.length).toBeGreaterThan(0);
    expect(statements[0]!.startOffset).toBe(0);
    if (statements.length > 1) {
      expect(statements[1]!.startOffset).toBeGreaterThan(statements[0]!.endOffset);
    }
  });

  it("発言者がいない場合は空配列を返す", () => {
    const pages = [
      "令和6年(2024年)第4回ニセコ町議会定例会",
      "出席議員名簿",
      "議員一覧",
    ];

    const statements = parseStatements(pages);
    expect(statements).toHaveLength(0);
  });

  it("複数ページにまたがる発言を正しく処理する", () => {
    const pages = [
      [
        "○議長（青羽雄士君）",
        "開会いたします。",
      ].join("\n"),
      [
        "○3番（高木直良君）",
        "質問いたします。",
        "○町長（片山健也君）",
        "お答えします。",
      ].join("\n"),
    ];

    const statements = parseStatements(pages);

    expect(statements.length).toBeGreaterThan(0);
    const roles = statements.map((s) => s.speakerRole);
    expect(roles).toContain("議長");
    expect(roles).toContain("議員");
    expect(roles).toContain("町長");
  });
});
