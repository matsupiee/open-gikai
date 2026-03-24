import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import { classifyKind, parseSpeaker, parseStatements } from "./detail";

describe("parseSpeaker", () => {
  it("議長パターンを抽出する", () => {
    const result = parseSpeaker(
      "議長（西沢哲朗） ただ今の時刻は午前10時30分です。",
    );
    expect(result.speakerName).toBe("西沢哲朗");
    expect(result.speakerRole).toBe("議長");
    expect(result.content).toBe("ただ今の時刻は午前10時30分です。");
  });

  it("村長パターンを抽出する", () => {
    const result = parseSpeaker(
      "村長（染野隆嗣） ６月定例議会開会にあたりまして。",
    );
    expect(result.speakerName).toBe("染野隆嗣");
    expect(result.speakerRole).toBe("村長");
    expect(result.content).toBe("６月定例議会開会にあたりまして。");
  });

  it("番号付き議員パターンを抽出する（全角）", () => {
    const result = parseSpeaker(
      "１番（新井幹夫議員） おはようございます。",
    );
    expect(result.speakerName).toBe("新井幹夫");
    expect(result.speakerRole).toBe("議員");
    expect(result.content).toBe("おはようございます。");
  });

  it("番号付き議員パターンを抽出する（半角）", () => {
    const result = parseSpeaker(
      "10番（峰村正一議員） 質問いたします。",
    );
    expect(result.speakerName).toBe("峰村正一");
    expect(result.speakerRole).toBe("議員");
    expect(result.content).toBe("質問いたします。");
  });

  it("課長パターンを抽出する", () => {
    const result = parseSpeaker(
      "総務課長（大日方浩和） お答えいたします。",
    );
    expect(result.speakerName).toBe("大日方浩和");
    expect(result.speakerRole).toBe("課長");
    expect(result.content).toBe("お答えいたします。");
  });

  it("教育長パターンを抽出する", () => {
    const result = parseSpeaker(
      "教育長（北田愛治） お答えいたします。",
    );
    expect(result.speakerName).toBe("北田愛治");
    expect(result.speakerRole).toBe("教育長");
    expect(result.content).toBe("お答えいたします。");
  });

  it("副村長パターンを抽出する", () => {
    const result = parseSpeaker(
      "副村長（小林裕一郎） お答えします。",
    );
    expect(result.speakerName).toBe("小林裕一郎");
    expect(result.speakerRole).toBe("副村長");
    expect(result.content).toBe("お答えします。");
  });

  it("事務局長パターンを抽出する", () => {
    const result = parseSpeaker(
      "事務局長（竹村広義） ご報告申し上げます。",
    );
    expect(result.speakerName).toBe("竹村広義");
    expect(result.speakerRole).toBe("事務局長");
    expect(result.content).toBe("ご報告申し上げます。");
  });

  it("社会文教常任委員長パターンを抽出する", () => {
    const result = parseSpeaker(
      "社会文教常任委員長（塚田綾子） ご報告いたします。",
    );
    expect(result.speakerName).toBe("塚田綾子");
    expect(result.speakerRole).toBe("社会文教常任委員長");
    expect(result.content).toBe("ご報告いたします。");
  });

  it("パターンにマッチしない場合はnullを返す", () => {
    const result = parseSpeaker("これは通常のテキストです。");
    expect(result.speakerName).toBeNull();
    expect(result.speakerRole).toBeNull();
    expect(result.content).toBe("これは通常のテキストです。");
  });
});

describe("classifyKind", () => {
  it("議長は remark に分類する", () => {
    expect(classifyKind("議長")).toBe("remark");
  });

  it("副議長は remark に分類する", () => {
    expect(classifyKind("副議長")).toBe("remark");
  });

  it("委員長は remark に分類する", () => {
    expect(classifyKind("委員長")).toBe("remark");
  });

  it("社会文教常任委員長は remark に分類する", () => {
    expect(classifyKind("社会文教常任委員長")).toBe("remark");
  });

  it("総務建経常任委員長は remark に分類する", () => {
    expect(classifyKind("総務建経常任委員長")).toBe("remark");
  });

  it("村長は answer に分類する", () => {
    expect(classifyKind("村長")).toBe("answer");
  });

  it("副村長は answer に分類する", () => {
    expect(classifyKind("副村長")).toBe("answer");
  });

  it("課長は answer に分類する", () => {
    expect(classifyKind("課長")).toBe("answer");
  });

  it("教育長は answer に分類する", () => {
    expect(classifyKind("教育長")).toBe("answer");
  });

  it("事務局長は answer に分類する", () => {
    expect(classifyKind("事務局長")).toBe("answer");
  });

  it("議員は question に分類する", () => {
    expect(classifyKind("議員")).toBe("question");
  });

  it("null は remark に分類する", () => {
    expect(classifyKind(null)).toBe("remark");
  });
});

describe("parseStatements", () => {
  it("◯マーカーで区切られた発言を分割する", () => {
    const text = [
      "◯議長（西沢哲朗） ただ今の時刻は午前10時30分です。",
      "◯村長（染野隆嗣） ６月定例議会開会にあたりまして。",
      "〇１番（新井幹夫議員） おはようございます。",
    ].join("\n");

    const result = parseStatements(text);

    expect(result).toHaveLength(3);
    expect(result[0]!.kind).toBe("remark");
    expect(result[0]!.speakerName).toBe("西沢哲朗");
    expect(result[0]!.speakerRole).toBe("議長");
    expect(result[0]!.content).toBe("ただ今の時刻は午前10時30分です。");
    expect(result[0]!.contentHash).toBe(
      createHash("sha256")
        .update("ただ今の時刻は午前10時30分です。")
        .digest("hex"),
    );

    expect(result[1]!.kind).toBe("answer");
    expect(result[1]!.speakerName).toBe("染野隆嗣");
    expect(result[1]!.speakerRole).toBe("村長");

    expect(result[2]!.kind).toBe("question");
    expect(result[2]!.speakerName).toBe("新井幹夫");
    expect(result[2]!.speakerRole).toBe("議員");
  });

  it("課長の発言も正しく抽出する", () => {
    const text = [
      "◯議長（西沢哲朗） 答弁を求めます。",
      "◯総務課長（大日方浩和） お答えいたします。内容は以下のとおりです。",
    ].join("\n");

    const result = parseStatements(text);

    expect(result).toHaveLength(2);
    expect(result[1]!.kind).toBe("answer");
    expect(result[1]!.speakerName).toBe("大日方浩和");
    expect(result[1]!.speakerRole).toBe("課長");
  });

  it("半角番号付き議員も抽出する", () => {
    const text = "◯10番（峰村正一議員） 質問いたします。";
    const result = parseStatements(text);
    expect(result).toHaveLength(1);
    expect(result[0]!.speakerName).toBe("峰村正一");
    expect(result[0]!.speakerRole).toBe("議員");
    expect(result[0]!.kind).toBe("question");
  });

  it("空テキストでは空配列を返す", () => {
    expect(parseStatements("")).toEqual([]);
  });

  it("発言者パターンがないテキストでは空配列を返す", () => {
    expect(parseStatements("ただの説明テキストです。")).toEqual([]);
  });

  it("startOffset / endOffset が連続している", () => {
    const text = [
      "◯議長（西沢哲朗） 開会します。",
      "◯村長（染野隆嗣） 答弁します。",
    ].join("\n");

    const result = parseStatements(text);
    expect(result).toHaveLength(2);
    expect(result[0]!.startOffset).toBe(0);
    expect(result[0]!.endOffset).toBe("開会します。".length);
    expect(result[1]!.startOffset).toBe(result[0]!.endOffset + 1);
  });
});
