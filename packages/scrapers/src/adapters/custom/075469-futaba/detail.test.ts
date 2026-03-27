import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import {
  classifyKind,
  parseHeldOnFromText,
  parseSpeaker,
  parseStatements,
} from "./detail";

describe("parseHeldOnFromText", () => {
  it("本文中の和暦日付を開催日に変換する", () => {
    const text =
      "令和７年第１回双葉町議会定例会議事日程（第１号） 令和７年３月１１日（火曜日）午前９時開会";

    expect(parseHeldOnFromText(text)).toBe("2025-03-11");
  });

  it("平成・令和元年にも対応する", () => {
    const text = "平成31年４月24日（水曜日）午前10時開会";
    expect(parseHeldOnFromText(text)).toBe("2019-04-24");
  });
});

describe("parseSpeaker", () => {
  it("議長発言を解析する", () => {
    const result = parseSpeaker(
      "〇議長（岩本久人君） おはようございます。ただいまの出席議員は８名です。",
    );

    expect(result.speakerName).toBe("岩本久人");
    expect(result.speakerRole).toBe("議長");
    expect(result.content).toBe(
      "おはようございます。ただいまの出席議員は8名です。",
    );
  });

  it("番号付き議員発言を議員として解析する", () => {
    const result = parseSpeaker(
      "〇２番（山根辰洋君） ご答弁ありがとうございます。再質問させていただきます。",
    );

    expect(result.speakerName).toBe("山根辰洋");
    expect(result.speakerRole).toBe("議員");
  });

  it("敬称なしの事務局長発言も解析する", () => {
    const result = parseSpeaker(
      "〇議会事務局長（石上 崇） おはようございます。事務局長の石上でございます。",
    );

    expect(result.speakerName).toBe("石上崇");
    expect(result.speakerRole).toBe("事務局長");
  });
});

describe("classifyKind", () => {
  it("議長系を remark に分類する", () => {
    expect(classifyKind("議長")).toBe("remark");
    expect(classifyKind("臨時議長")).toBe("remark");
  });

  it("町長を answer に分類する", () => {
    expect(classifyKind("町長")).toBe("answer");
  });

  it("議員を question に分類する", () => {
    expect(classifyKind("議員")).toBe("question");
  });
});

describe("parseStatements", () => {
  it("◎見出しを飛ばしつつ 〇発言を抽出する", () => {
    const text = [
      "◎開会の宣告",
      "〇議長（岩本久人君） ただいまから令和７年第１回双葉町議会臨時会を開会します。",
      "◎議案第１号の上程、説明、質疑、討論、採決",
      "〇町長（伊澤史朗君） 提案理由の説明を申し上げます。",
      "〇２番（山根辰洋君） 再質問させていただきます。",
    ].join(" ");

    const result = parseStatements(text);

    expect(result).toHaveLength(3);
    expect(result[0]!.speakerRole).toBe("議長");
    expect(result[0]!.kind).toBe("remark");
    expect(result[1]!.speakerRole).toBe("町長");
    expect(result[1]!.kind).toBe("answer");
    expect(result[2]!.speakerRole).toBe("議員");
    expect(result[2]!.kind).toBe("question");
  });

  it("speaker を解釈できない構造ブロックは除外する", () => {
    const text = [
      "〇出席議員（８名） １番 渡部昭洋君 ２番 山根辰洋君",
      "〇議長（岩本久人君） これから本日の会議を開きます。",
    ].join(" ");

    const result = parseStatements(text);

    expect(result).toHaveLength(1);
    expect(result[0]!.speakerName).toBe("岩本久人");
  });

  it("contentHash と offset を設定する", () => {
    const text = "〇議長（岩本久人君） 開会します。";
    const result = parseStatements(text);

    expect(result[0]!.contentHash).toBe(
      createHash("sha256").update("開会します。").digest("hex"),
    );
    expect(result[0]!.startOffset).toBe(0);
    expect(result[0]!.endOffset).toBe("開会します。".length);
  });
});
