import { describe, expect, it } from "vitest";
import { parseSpeaker, classifyKind, parseStatements } from "./detail";

describe("parseSpeaker", () => {
  it("番号付き議員の発言を解析する", () => {
    const result = parseSpeaker("○１番（鈴木一郎君）　質問いたします。");
    expect(result.speakerName).toBe("鈴木一郎");
    expect(result.speakerRole).toBe("議員");
    expect(result.content).toBe("質問いたします。");
  });

  it("議長の発言を解析する", () => {
    const result = parseSpeaker("○議長（山田太郎君）　ただいまから会議を開きます。");
    expect(result.speakerName).toBe("山田太郎");
    expect(result.speakerRole).toBe("議長");
    expect(result.content).toBe("ただいまから会議を開きます。");
  });

  it("村長の発言を解析する", () => {
    const result = parseSpeaker("○村長（佐藤次郎君）　ご答弁申し上げます。");
    expect(result.speakerName).toBe("佐藤次郎");
    expect(result.speakerRole).toBe("村長");
    expect(result.content).toBe("ご答弁申し上げます。");
  });

  it("教育長の発言を解析する", () => {
    const result = parseSpeaker("○教育長（田中三郎君）　お答えします。");
    expect(result.speakerName).toBe("田中三郎");
    expect(result.speakerRole).toBe("教育長");
    expect(result.content).toBe("お答えします。");
  });

  it("{名前}{役職} 形式の発言を解析する", () => {
    const result = parseSpeaker("○山田課長　ご説明いたします。");
    expect(result.speakerName).toBe("山田");
    expect(result.speakerRole).toBe("課長");
    expect(result.content).toBe("ご説明いたします。");
  });

  it("副委員長を委員長より先にマッチする", () => {
    const result = parseSpeaker("○副委員長（田中四郎君）　暫時休憩します。");
    expect(result.speakerRole).toBe("副委員長");
  });

  it("副議長を議長より先にマッチする", () => {
    const result = parseSpeaker("○副議長（伊藤五郎君）　議事を進めます。");
    expect(result.speakerRole).toBe("副議長");
  });
});

describe("classifyKind", () => {
  it("議員は question を返す", () => {
    expect(classifyKind("議員")).toBe("question");
  });

  it("村長は answer を返す", () => {
    expect(classifyKind("村長")).toBe("answer");
  });

  it("副村長は answer を返す", () => {
    expect(classifyKind("副村長")).toBe("answer");
  });

  it("教育長は answer を返す", () => {
    expect(classifyKind("教育長")).toBe("answer");
  });

  it("課長は answer を返す", () => {
    expect(classifyKind("課長")).toBe("answer");
  });

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

  it("XXX課長のように役職サフィックスで終わる場合は answer を返す", () => {
    expect(classifyKind("総務課長")).toBe("answer");
  });
});

describe("parseStatements", () => {
  it("○ マーカーで発言を分割する", () => {
    const text = `○議長（山田太郎君） ただいまから会議を開きます。
○１番（鈴木一郎君） 村道の整備についてお伺いします。
○村長（佐藤次郎君） ご質問にお答えします。`;

    const statements = parseStatements(text);

    expect(statements).toHaveLength(3);
    expect(statements[0]!.speakerRole).toBe("議長");
    expect(statements[0]!.kind).toBe("remark");
    expect(statements[1]!.speakerRole).toBe("議員");
    expect(statements[1]!.kind).toBe("question");
    expect(statements[2]!.speakerRole).toBe("村長");
    expect(statements[2]!.kind).toBe("answer");
  });

  it("contentHash が SHA-256 形式で生成される", () => {
    const text = `○議長（山田太郎君） ただいまから会議を開きます。`;

    const statements = parseStatements(text);

    expect(statements).toHaveLength(1);
    expect(statements[0]!.contentHash).toMatch(/^[a-f0-9]{64}$/);
  });

  it("offset が連続して計算される", () => {
    const text = `○１番（鈴木一郎君） 一般質問をします。
○村長（佐藤次郎君） お答えします。`;

    const statements = parseStatements(text);

    expect(statements).toHaveLength(2);
    expect(statements[0]!.startOffset).toBe(0);
    expect(statements[0]!.endOffset).toBe(statements[0]!.content.length);
    expect(statements[1]!.startOffset).toBe(statements[0]!.endOffset + 1);
  });

  it("ト書き（登壇）をスキップする", () => {
    const text = `○（登壇）
○議長（山田太郎君） 会議を開きます。`;

    const statements = parseStatements(text);

    expect(statements).toHaveLength(1);
    expect(statements[0]!.speakerRole).toBe("議長");
  });

  it("○ マーカーがない行はスキップする", () => {
    const text = `会議録
○議長（山田太郎君） ただいまから会議を開きます。
ページ番号など
○村長（佐藤次郎君） ご答弁します。`;

    const statements = parseStatements(text);

    expect(statements).toHaveLength(2);
  });

  it("空のテキストでは空配列を返す", () => {
    const statements = parseStatements("");
    expect(statements).toHaveLength(0);
  });

  it("content が空の発言はスキップする", () => {
    const text = `○議長（山田太郎君）`;

    const statements = parseStatements(text);

    expect(statements).toHaveLength(0);
  });
});
