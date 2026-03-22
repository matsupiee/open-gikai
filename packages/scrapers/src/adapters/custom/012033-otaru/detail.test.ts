import { describe, expect, it } from "vitest";
import { parseSpeaker, classifyKind, buildStatements } from "./detail";

describe("parseSpeaker", () => {
  it("委員長（役職のみ）を正しくパースする", () => {
    const result = parseSpeaker("委員長");
    expect(result.speakerName).toBeNull();
    expect(result.speakerRole).toBe("委員長");
  });

  it("議長（役職のみ）を正しくパースする", () => {
    const result = parseSpeaker("議長");
    expect(result.speakerName).toBeNull();
    expect(result.speakerRole).toBe("議長");
  });

  it("名前+委員を正しくパースする", () => {
    const result = parseSpeaker("松岩委員");
    expect(result.speakerName).toBe("松岩");
    expect(result.speakerRole).toBe("委員");
  });

  it("名前+議員を正しくパースする", () => {
    const result = parseSpeaker("高橋議員");
    expect(result.speakerName).toBe("高橋");
    expect(result.speakerRole).toBe("議員");
  });

  it("部署名+課長を正しくパースする", () => {
    const result = parseSpeaker("子育て支援課長");
    expect(result.speakerName).toBe("子育て支援");
    expect(result.speakerRole).toBe("課長");
  });

  it("部署名+名前+主幹を正しくパースする", () => {
    const result = parseSpeaker("企画政策室山本主幹");
    expect(result.speakerName).toBe("企画政策室山本");
    expect(result.speakerRole).toBe("主幹");
  });

  it("市長を正しくパースする", () => {
    const result = parseSpeaker("市長");
    expect(result.speakerName).toBeNull();
    expect(result.speakerRole).toBe("市長");
  });

  it("副市長を正しくパースする", () => {
    const result = parseSpeaker("副市長");
    expect(result.speakerName).toBeNull();
    expect(result.speakerRole).toBe("副市長");
  });

  it("名前+副委員長を正しくパースする", () => {
    const result = parseSpeaker("田中副委員長");
    expect(result.speakerName).toBe("田中");
    expect(result.speakerRole).toBe("副委員長");
  });

  it("次長を正しくパースする", () => {
    const result = parseSpeaker("選挙管理委員会事務局次長");
    expect(result.speakerName).toBe("選挙管理委員会事務局");
    expect(result.speakerRole).toBe("次長");
  });

  it("空文字列に対して null を返す", () => {
    const result = parseSpeaker("");
    expect(result.speakerName).toBeNull();
    expect(result.speakerRole).toBeNull();
  });

  it("既知の役職に一致しない場合は名前として扱う", () => {
    const result = parseSpeaker("事務局長代理");
    expect(result.speakerName).toBe("事務局長代理");
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

  it("市長は answer", () => {
    expect(classifyKind("市長")).toBe("answer");
  });

  it("副市長は answer", () => {
    expect(classifyKind("副市長")).toBe("answer");
  });

  it("課長は answer", () => {
    expect(classifyKind("課長")).toBe("answer");
  });

  it("主幹は answer", () => {
    expect(classifyKind("主幹")).toBe("answer");
  });

  it("次長は answer", () => {
    expect(classifyKind("次長")).toBe("answer");
  });

  it("議員は question", () => {
    expect(classifyKind("議員")).toBe("question");
  });

  it("委員は question", () => {
    expect(classifyKind("委員")).toBe("question");
  });

  it("null は remark", () => {
    expect(classifyKind(null)).toBe("remark");
  });
});

describe("buildStatements", () => {
  it("発言レコードから ParsedStatement を生成する", () => {
    const records = [
      { speaker: "委員長", text: "ただいまから会議を開きます。" },
      { speaker: "松岩委員", text: "質問いたします。" },
      { speaker: "子育て支援課長", text: "お答えいたします。" },
    ];

    const statements = buildStatements(records);

    expect(statements).toHaveLength(3);

    expect(statements[0]!.kind).toBe("remark");
    expect(statements[0]!.speakerName).toBeNull();
    expect(statements[0]!.speakerRole).toBe("委員長");
    expect(statements[0]!.content).toBe("ただいまから会議を開きます。");

    expect(statements[1]!.kind).toBe("question");
    expect(statements[1]!.speakerName).toBe("松岩");
    expect(statements[1]!.speakerRole).toBe("委員");
    expect(statements[1]!.content).toBe("質問いたします。");

    expect(statements[2]!.kind).toBe("answer");
    expect(statements[2]!.speakerName).toBe("子育て支援");
    expect(statements[2]!.speakerRole).toBe("課長");
    expect(statements[2]!.content).toBe("お答えいたします。");
  });

  it("contentHash が SHA-256 形式で生成される", () => {
    const records = [{ speaker: "委員長", text: "テスト発言。" }];

    const statements = buildStatements(records);

    expect(statements[0]!.contentHash).toMatch(/^[a-f0-9]{64}$/);
  });

  it("offset が正しく計算される", () => {
    const records = [
      { speaker: "委員長", text: "ただいま。" },
      { speaker: "松岩委員", text: "質問です。" },
    ];

    const statements = buildStatements(records);

    expect(statements[0]!.startOffset).toBe(0);
    expect(statements[0]!.endOffset).toBe("ただいま。".length);
    expect(statements[1]!.startOffset).toBe("ただいま。".length + 1);
  });

  it("空テキストのレコードはスキップする", () => {
    const records = [
      { speaker: "委員長", text: "発言します。" },
      { speaker: "松岩委員", text: "" },
      { speaker: "松岩委員", text: "   " },
      { speaker: "課長", text: "回答します。" },
    ];

    const statements = buildStatements(records);
    expect(statements).toHaveLength(2);
  });
});
