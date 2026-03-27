import { describe, expect, it } from "vitest";
import { classifyKind, parseSpeaker, parseStatements } from "./detail";

describe("parseSpeaker", () => {
  it("議長パターンを解析する", () => {
    const result = parseSpeaker(
      "○議長（水野秀一君） 改めまして、おはようございます。",
    );
    expect(result.speakerName).toBe("水野秀一");
    expect(result.speakerRole).toBe("議長");
    expect(result.content).toBe("改めまして、おはようございます。");
  });

  it("町長パターンを解析する", () => {
    const result = parseSpeaker(
      "○町長（江田文男君） 皆さん、改めておはようございます。",
    );
    expect(result.speakerName).toBe("江田文男");
    expect(result.speakerRole).toBe("町長");
    expect(result.content).toBe("皆さん、改めておはようございます。");
  });

  it("番号議員パターンを解析する", () => {
    const result = parseSpeaker(
      "○６番（岡部宗寿君） 議会運営委員長報告。",
    );
    expect(result.speakerName).toBe("岡部宗寿");
    expect(result.speakerRole).toBe("議員");
    expect(result.content).toBe("議会運営委員長報告。");
  });

  it("複合役職は末尾の役職を採用する", () => {
    const result = parseSpeaker(
      "○建設水道課長（生田目聡君） ご説明申し上げます。",
    );
    expect(result.speakerName).toBe("生田目聡");
    expect(result.speakerRole).toBe("課長");
    expect(result.content).toBe("ご説明申し上げます。");
  });

  it("議会事務局長を解析する", () => {
    const result = parseSpeaker(
      "○議会事務局長（田子広子君） 町長招集に当たっての挨拶及び行政報告。",
    );
    expect(result.speakerName).toBe("田子広子");
    expect(result.speakerRole).toBe("議会事務局長");
  });

  it("名前の空白を除去する", () => {
    const result = parseSpeaker("○町長（江田　文男君） ご挨拶します。");
    expect(result.speakerName).toBe("江田文男");
  });
});

describe("classifyKind", () => {
  it("議長は remark", () => {
    expect(classifyKind("議長")).toBe("remark");
  });

  it("町長は answer", () => {
    expect(classifyKind("町長")).toBe("answer");
  });

  it("課長は answer", () => {
    expect(classifyKind("課長")).toBe("answer");
  });

  it("議会事務局長は answer", () => {
    expect(classifyKind("議会事務局長")).toBe("answer");
  });

  it("議員は question", () => {
    expect(classifyKind("議員")).toBe("question");
  });

  it("null は remark", () => {
    expect(classifyKind(null)).toBe("remark");
  });
});

describe("parseStatements", () => {
  it("○ マーカーごとに発言を抽出する", () => {
    const text = `
○議長（水野秀一君） 改めまして、おはようございます。
○町長（江田文男君） 皆さん、改めておはようございます。
○６番（岡部宗寿君） 議会運営委員長報告。
`;

    const statements = parseStatements(text);

    expect(statements).toHaveLength(3);
    expect(statements[0]!.kind).toBe("remark");
    expect(statements[1]!.kind).toBe("answer");
    expect(statements[2]!.kind).toBe("question");
  });

  it("contentHash を付与する", () => {
    const statements = parseStatements(
      "○議長（水野秀一君） ただいまから本日の会議を開きます。",
    );
    expect(statements[0]!.contentHash).toMatch(/^[a-f0-9]{64}$/);
  });

  it("offset を連番で計算する", () => {
    const statements = parseStatements(`○議長（水野秀一君） 開議します。
○町長（江田文男君） ご挨拶します。`);

    expect(statements[0]!.startOffset).toBe(0);
    expect(statements[0]!.endOffset).toBe("開議します。".length);
    expect(statements[1]!.startOffset).toBe("開議します。".length + 1);
  });

  it("ト書きをスキップする", () => {
    const text = `○議長（水野秀一君） これより再開します。
○（江田文男君登壇）
○町長（江田文男君） ご説明申し上げます。`;

    const statements = parseStatements(text);

    expect(statements).toHaveLength(2);
    expect(statements[0]!.speakerRole).toBe("議長");
    expect(statements[1]!.speakerRole).toBe("町長");
  });

  it("空文字は空配列を返す", () => {
    expect(parseStatements("")).toEqual([]);
  });
});
