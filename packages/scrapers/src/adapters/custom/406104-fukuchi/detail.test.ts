import { describe, expect, it } from "vitest";
import {
  classifyKind,
  extractHeldOn,
  parseSpeaker,
  parseStatements,
} from "./detail";

describe("parseSpeaker", () => {
  it("議長の発言を解析する", () => {
    const result = parseSpeaker(
      "○議長（皆川 高司君） 皆さん、おはようございます。",
    );

    expect(result).toEqual({
      speakerName: "皆川高司",
      speakerRole: "議長",
      content: "皆さん、おはようございます。",
    });
  });

  it("議員（番号付き氏名）の発言を解析する", () => {
    const result = parseSpeaker(
      "○議員（１３番 髙津 鶴己君） その辺をお尋ねします。",
    );

    expect(result).toEqual({
      speakerName: "髙津鶴己",
      speakerRole: "議員",
      content: "その辺をお尋ねします。",
    });
  });

  it("課長職の発言を末尾サフィックスで解析する", () => {
    const result = parseSpeaker(
      "○税務住民課長（仲村 和宏君） よろしくお願いします。",
    );

    expect(result).toEqual({
      speakerName: "仲村和宏",
      speakerRole: "課長",
      content: "よろしくお願いします。",
    });
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

  it("議員は question", () => {
    expect(classifyKind("議員")).toBe("question");
  });
});

describe("parseStatements", () => {
  it("PDF 抽出テキストの発言ブロックを分割する", () => {
    const text = `
○議長（皆川 高司君） 皆さん、おはようございます。
  それでは、ただいまより令和５年第２回福智町議会臨時会を開会いたします。
○町長（黒土 孝司君） おはようございます。本日はよろしくお願いいたします。
○議員（１３番 髙津 鶴己君） その辺をお尋ねします。
`;

    const statements = parseStatements(text);

    expect(statements).toHaveLength(3);
    expect(statements[0]!.kind).toBe("remark");
    expect(statements[0]!.speakerName).toBe("皆川高司");
    expect(statements[1]!.kind).toBe("answer");
    expect(statements[1]!.speakerRole).toBe("町長");
    expect(statements[2]!.kind).toBe("question");
    expect(statements[2]!.speakerName).toBe("髙津鶴己");
    expect(statements[2]!.contentHash).toMatch(/^[a-f0-9]{64}$/);
  });

  it("offset を連番で計算する", () => {
    const statements = parseStatements(`
○議長（皆川 高司君） 開会します。
○町長（黒土 孝司君） お答えします。
`);

    expect(statements[0]!.startOffset).toBe(0);
    expect(statements[0]!.endOffset).toBe("開会します。".length);
    expect(statements[1]!.startOffset).toBe("開会します。".length + 1);
  });
});

describe("extractHeldOn", () => {
  it("和暦日付を YYYY-MM-DD に変換する", () => {
    expect(
      extractHeldOn("令和７年 第１回 （定例）福智町議会会議録 令和７年３月３日（月曜日）"),
    ).toBe("2025-03-03");
  });

  it("平成元年にも対応する", () => {
    expect(extractHeldOn("平成元年６月１日")).toBe("1989-06-01");
  });
});
