import { describe, expect, it, vi } from "vitest";

vi.mock("../../../utils/pdf", () => ({
  extractText: vi.fn(),
  getDocumentProxy: vi.fn(),
}));

import { classifyKind, parseSpeaker, parseStatements } from "./detail";

describe("parseSpeaker", () => {
  it("副議長パターンを解析する", () => {
    const result = parseSpeaker("◎副議長（山口 享君） 許可します。");
    expect(result.speakerName).toBe("山口享");
    expect(result.speakerRole).toBe("副議長");
    expect(result.content).toBe("許可します。");
  });

  it("番号議員パターンを解析する", () => {
    const result = parseSpeaker("◎10番（五十嵐一夫君） 議長、10番。");
    expect(result.speakerName).toBe("五十嵐一夫");
    expect(result.speakerRole).toBe("議員");
    expect(result.content).toBe("議長、10番。");
  });

  it("部署付き課長パターンを解析する", () => {
    const result = parseSpeaker(
      "◎庁舎整備課長（遠藤幸喜君） ご説明いたします。",
    );
    expect(result.speakerName).toBe("遠藤幸喜");
    expect(result.speakerRole).toBe("課長");
    expect(result.content).toBe("ご説明いたします。");
  });

  it("先頭の登壇ト書きを本文から除去する", () => {
    const result = parseSpeaker(
      "◎町長（古川庄平君）（登壇） お答えいたします。",
    );
    expect(result.speakerName).toBe("古川庄平");
    expect(result.speakerRole).toBe("町長");
    expect(result.content).toBe("お答えいたします。");
  });
});

describe("classifyKind", () => {
  it("副議長は remark", () => {
    expect(classifyKind("副議長")).toBe("remark");
  });

  it("町長は answer", () => {
    expect(classifyKind("町長")).toBe("answer");
  });

  it("課長は answer", () => {
    expect(classifyKind("課長")).toBe("answer");
  });

  it("監査委員は answer", () => {
    expect(classifyKind("監査委員")).toBe("answer");
  });

  it("議員は question", () => {
    expect(classifyKind("議員")).toBe("question");
  });

  it("null は remark", () => {
    expect(classifyKind(null)).toBe("remark");
  });
});

describe("parseStatements", () => {
  it("見出しだけの ◎ を除外して発言ブロックを抽出する", () => {
    const text = `
◎会議録署名議員の指名
◎副議長（山口 享君）
日程第１、会議録署名議員の指名を行います。
◎10番（五十嵐一夫君）
議長、10番。
◎副議長（山口 享君）
許可します。
◎10番（五十嵐一夫君）（登壇）
◎10番（五十嵐一夫君）
通告に従い一般質問いたします。
◎町長（古川庄平君）（登壇）
お答えいたします。
`;

    const statements = parseStatements(text);

    expect(statements).toHaveLength(5);
    expect(statements[0]!.speakerRole).toBe("副議長");
    expect(statements[0]!.content).toBe(
      "日程第１、会議録署名議員の指名を行います。",
    );
    expect(statements[1]!.speakerRole).toBe("議員");
    expect(statements[1]!.content).toBe("議長、10番。");
    expect(statements[2]!.speakerRole).toBe("副議長");
    expect(statements[2]!.content).toBe("許可します。");
    expect(statements[3]!.speakerRole).toBe("議員");
    expect(statements[3]!.content).toBe("通告に従い一般質問いたします。");
    expect(statements[4]!.speakerRole).toBe("町長");
    expect(statements[4]!.content).toBe("お答えいたします。");
  });

  it("contentHash と offset を付与する", () => {
    const statements = parseStatements(
      "◎副議長（山口 享君） 許可します。\n◎町長（古川庄平君） お答えいたします。",
    );

    expect(statements[0]!.contentHash).toMatch(/^[a-f0-9]{64}$/);
    expect(statements[0]!.startOffset).toBe(0);
    expect(statements[0]!.endOffset).toBe("許可します。".length);
    expect(statements[1]!.startOffset).toBe("許可します。".length + 1);
  });

  it("ページ番号ヘッダーを本文から除去する", () => {
    const statements = parseStatements(`
◎副議長（山口 享君）
再開いたします。
2 / 第 1 日
◎町長（古川庄平君）
お答えいたします。
`);

    expect(statements).toHaveLength(2);
    expect(statements[0]!.content).toBe("再開いたします。");
    expect(statements[1]!.content).toBe("お答えいたします。");
  });

  it("空テキストは空配列を返す", () => {
    expect(parseStatements("")).toEqual([]);
  });
});
