import { describe, expect, it } from "vitest";
import { parseSpeaker, classifyKind, parseStatements } from "./detail";

describe("parseSpeaker", () => {
  it("議長（名前君）パターンを正しくパースする", () => {
    const result = parseSpeaker("○議長（後藤幸平君）　開会を宣言する。");
    expect(result.speakerRole).toBe("議長");
    expect(result.speakerName).toBe("後藤幸平");
    expect(result.content).toBe("開会を宣言する。");
  });

  it("番号付き議員パターンを正しくパースする", () => {
    const result = parseSpeaker("○3番（山田太郎君）　質問します。");
    expect(result.speakerRole).toBe("議員");
    expect(result.speakerName).toBe("山田太郎");
    expect(result.content).toBe("質問します。");
  });

  it("町長パターンを正しくパースする", () => {
    const result = parseSpeaker("○町長（鈴木一郎君）　答弁します。");
    expect(result.speakerRole).toBe("町長");
    expect(result.speakerName).toBe("鈴木一郎");
    expect(result.content).toBe("答弁します。");
  });

  it("副町長パターンを正しくパースする", () => {
    const result = parseSpeaker("○副町長（田中二郎君）　補足説明します。");
    expect(result.speakerRole).toBe("副町長");
    expect(result.speakerName).toBe("田中二郎");
    expect(result.content).toBe("補足説明します。");
  });

  it("課長を含む役職パターンを正しくパースする", () => {
    const result = parseSpeaker("○総務課長（佐藤花子君）　報告します。");
    expect(result.speakerRole).toBe("課長");
    expect(result.speakerName).toBe("佐藤花子");
    expect(result.content).toBe("報告します。");
  });

  it("副議長パターンを正しくパースする", () => {
    const result = parseSpeaker("○副議長（佐々木五郎君）　議事進行。");
    expect(result.speakerRole).toBe("副議長");
    expect(result.speakerName).toBe("佐々木五郎");
    expect(result.content).toBe("議事進行。");
  });

  it("委員長パターンを正しくパースする", () => {
    const result = parseSpeaker("○委員長（高橋六郎君）　審査を開始する。");
    expect(result.speakerRole).toBe("委員長");
    expect(result.speakerName).toBe("高橋六郎");
    expect(result.content).toBe("審査を開始する。");
  });
});

describe("classifyKind", () => {
  it("議長は remark を返す", () => {
    expect(classifyKind("議長")).toBe("remark");
  });

  it("副議長は remark を返す", () => {
    expect(classifyKind("副議長")).toBe("remark");
  });

  it("委員長は remark を返す", () => {
    expect(classifyKind("委員長")).toBe("remark");
  });

  it("副委員長は remark を返す", () => {
    expect(classifyKind("副委員長")).toBe("remark");
  });

  it("null は remark を返す", () => {
    expect(classifyKind(null)).toBe("remark");
  });

  it("町長は answer を返す", () => {
    expect(classifyKind("町長")).toBe("answer");
  });

  it("副町長は answer を返す", () => {
    expect(classifyKind("副町長")).toBe("answer");
  });

  it("教育長は answer を返す", () => {
    expect(classifyKind("教育長")).toBe("answer");
  });

  it("課長は answer を返す", () => {
    expect(classifyKind("課長")).toBe("answer");
  });

  it("議員は question を返す", () => {
    expect(classifyKind("議員")).toBe("question");
  });
});

describe("parseStatements", () => {
  it("○ マーカーで発言ブロックを分割する", () => {
    const text = `
令和6年大江町議会会議録
○議長（後藤幸平君） これより開会します。
○3番（山田太郎君） 一般質問を行います。道路整備事業についてお伺いします。
○町長（鈴木一郎君） ご質問にお答えします。事業は予定通り進めます。
`;

    const statements = parseStatements(text);

    expect(statements).toHaveLength(3);

    expect(statements[0]!.kind).toBe("remark");
    expect(statements[0]!.speakerRole).toBe("議長");
    expect(statements[0]!.speakerName).toBe("後藤幸平");
    expect(statements[0]!.content).toBe("これより開会します。");

    expect(statements[1]!.kind).toBe("question");
    expect(statements[1]!.speakerRole).toBe("議員");
    expect(statements[1]!.speakerName).toBe("山田太郎");

    expect(statements[2]!.kind).toBe("answer");
    expect(statements[2]!.speakerRole).toBe("町長");
    expect(statements[2]!.speakerName).toBe("鈴木一郎");
  });

  it("各 statement に contentHash が付与される", () => {
    const text = "○議長（後藤幸平君） 開会します。";
    const statements = parseStatements(text);
    expect(statements[0]!.contentHash).toMatch(/^[a-f0-9]{64}$/);
  });

  it("offset が正しく計算される", () => {
    const text =
      "○議長（後藤幸平君） 開会。\n○町長（鈴木一郎君） 答弁。";
    const statements = parseStatements(text);

    expect(statements[0]!.startOffset).toBe(0);
    expect(statements[0]!.endOffset).toBe(3);
    expect(statements[1]!.startOffset).toBe(4);
    expect(statements[1]!.endOffset).toBe(7);
  });

  it("空テキストは空配列を返す", () => {
    expect(parseStatements("")).toEqual([]);
  });

  it("○ マーカーがないテキストは空配列を返す", () => {
    const text = "大江町議会会議録\n令和6年3月定例会";
    expect(parseStatements(text)).toHaveLength(0);
  });

  it("登壇などのト書きをスキップする", () => {
    const text = "○3番（山田太郎君）（登壇）\n○議長（後藤幸平君） 開会します。";
    const statements = parseStatements(text);

    expect(statements).toHaveLength(1);
    expect(statements[0]!.speakerRole).toBe("議長");
  });

  it("speakerName と speakerRole が正しく設定される", () => {
    const text = "○副委員長（木村七郎君） 議事を進めます。";
    const statements = parseStatements(text);

    expect(statements[0]!.speakerName).toBe("木村七郎");
    expect(statements[0]!.speakerRole).toBe("副委員長");
    expect(statements[0]!.kind).toBe("remark");
  });
});
