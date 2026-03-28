import { describe, expect, it } from "vitest";
import { classifyKind, parseSpeaker, parseStatements } from "./detail";

describe("parseSpeaker", () => {
  it("議長パターンを解析する", () => {
    const result = parseSpeaker("○議長（田代はつ江） おはようございます。");
    expect(result.speakerName).toBe("田代はつ江");
    expect(result.speakerRole).toBe("議長");
    expect(result.content).toBe("おはようございます。");
  });

  it("番号議員を議員として解析する", () => {
    const result = parseSpeaker("○３番（田中太郎君） 質問いたします。");
    expect(result.speakerName).toBe("田中太郎");
    expect(result.speakerRole).toBe("議員");
  });

  it("市長公室長のような複合役職は末尾役職を抽出する", () => {
    const result = parseSpeaker("○市長公室長（河合保隆） ご説明します。");
    expect(result.speakerName).toBe("河合保隆");
    expect(result.speakerRole).toBe("室長");
  });
});

describe("classifyKind", () => {
  it("議長は remark", () => {
    expect(classifyKind("議長")).toBe("remark");
  });

  it("市長は answer", () => {
    expect(classifyKind("市長")).toBe("answer");
  });

  it("部長は answer", () => {
    expect(classifyKind("部長")).toBe("answer");
  });

  it("議員は question", () => {
    expect(classifyKind("議員")).toBe("question");
  });
});

describe("parseStatements", () => {
  it("○ マーカーごとに発言を分割する", () => {
    const text = `
      ○議長（田代はつ江） おはようございます。
      ○３番（田中太郎君） 質問します。
      ○市長（日置敏明） お答えいたします。
    `;

    const statements = parseStatements(text);

    expect(statements).toHaveLength(3);
    expect(statements[0]!.kind).toBe("remark");
    expect(statements[1]!.kind).toBe("question");
    expect(statements[2]!.kind).toBe("answer");
  });

  it("ページ番号や罫線を除去して発言を抽出する", () => {
    const text = `
      －５－
      ○議長（田代はつ江） ただいまから会議を開きます。
      ─────────────────────────────
      ○市長（日置敏明） お答えいたします。
    `;

    const statements = parseStatements(text);

    expect(statements).toHaveLength(2);
    expect(statements[0]!.content).toBe("ただいまから会議を開きます。");
    expect(statements[1]!.content).toBe("お答えいたします。");
  });

  it("直後の議事項目見出しは発言本文から除外する", () => {
    const text = `
      ○議長（田代はつ江） ただいまから会議を開きます。 ◎会議録署名議員の指名
      ○市長（日置敏明） お答えいたします。
    `;

    const statements = parseStatements(text);

    expect(statements[0]!.content).toBe("ただいまから会議を開きます。");
  });

  it("contentHash と offset を付与する", () => {
    const statements = parseStatements("○議長（田代はつ江） テスト発言。");
    expect(statements[0]!.contentHash).toMatch(/^[a-f0-9]{64}$/);
    expect(statements[0]!.startOffset).toBe(0);
    expect(statements[0]!.endOffset).toBe("テスト発言。".length);
  });
});
