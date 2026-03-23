import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import { classifyKind, parseSpeaker, parseStatements } from "./detail";

describe("parseSpeaker", () => {
  it("議長を抽出する", () => {
    const result = parseSpeaker("議長（淺野 勉）");
    expect(result.speakerName).toBe("淺野勉");
    expect(result.speakerRole).toBe("議長");
  });

  it("町長を抽出する", () => {
    const result = parseSpeaker("町長（西本安博）");
    expect(result.speakerName).toBe("西本安博");
    expect(result.speakerRole).toBe("町長");
  });

  it("副町長を抽出する", () => {
    const result = parseSpeaker("副町長（富井文枝）");
    expect(result.speakerName).toBe("富井文枝");
    expect(result.speakerRole).toBe("副町長");
  });

  it("番号付き議員を抽出する", () => {
    const result = parseSpeaker("４番（福井保夫）");
    expect(result.speakerName).toBe("福井保夫");
    expect(result.speakerRole).toBe("議員");
  });

  it("教育長を抽出する", () => {
    const result = parseSpeaker("教育長（辰己秀雄）");
    expect(result.speakerName).toBe("辰己秀雄");
    expect(result.speakerRole).toBe("教育長");
  });

  it("部名付き部長を抽出する", () => {
    const result = parseSpeaker("住民生活部長（吉田一弘）");
    expect(result.speakerName).toBe("吉田一弘");
    expect(result.speakerRole).toBe("部長");
  });

  it("課名付き課長を抽出する", () => {
    const result = parseSpeaker("総合政策課長（富士青美）");
    expect(result.speakerName).toBe("富士青美");
    expect(result.speakerRole).toBe("課長");
  });

  it("教育次長を抽出する", () => {
    const result = parseSpeaker("教育次長（辻井弘至）");
    expect(result.speakerName).toBe("辻井弘至");
    expect(result.speakerRole).toBe("教育次長");
  });

  it("総務部長を抽出する", () => {
    const result = parseSpeaker("総務部長（吉村良昭）");
    expect(result.speakerName).toBe("吉村良昭");
    expect(result.speakerRole).toBe("部長");
  });

  it("議会選出監査委員を抽出する", () => {
    const result = parseSpeaker("議会選出監査委員（近藤晃一）");
    expect(result.speakerName).toBe("近藤晃一");
    expect(result.speakerRole).toBe("委員");
  });

  it("名前の全角スペースを除去する", () => {
    const result = parseSpeaker("議長（淺　野　勉）");
    expect(result.speakerName).toBe("淺野勉");
  });

  it("マッチしない場合は null を返す", () => {
    const result = parseSpeaker("不明なテキスト");
    expect(result.speakerName).toBeNull();
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

  it("議員は question", () => {
    expect(classifyKind("議員")).toBe("question");
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

  it("部長は answer", () => {
    expect(classifyKind("部長")).toBe("answer");
  });

  it("課長は answer", () => {
    expect(classifyKind("課長")).toBe("answer");
  });

  it("null は remark", () => {
    expect(classifyKind(null)).toBe("remark");
  });
});

describe("parseStatements", () => {
  it("複数の発言を分割する", () => {
    const text =
      "議長（淺野 勉） 只今から会議を開きます。 町長（西本安博） お答えいたします。";
    const result = parseStatements(text);

    expect(result).toHaveLength(2);
    expect(result[0]!.speakerName).toBe("淺野勉");
    expect(result[0]!.speakerRole).toBe("議長");
    expect(result[0]!.kind).toBe("remark");
    expect(result[0]!.content).toBe("只今から会議を開きます。");

    expect(result[1]!.speakerName).toBe("西本安博");
    expect(result[1]!.speakerRole).toBe("町長");
    expect(result[1]!.kind).toBe("answer");
    expect(result[1]!.content).toBe("お答えいたします。");
  });

  it("番号付き議員の発言を question として分類する", () => {
    const text =
      "議長（森田 瞳） はい。福井議員。 ４番（福井保夫） 質問いたします。 副町長（富井文枝） お答えいたします。";
    const result = parseStatements(text);

    expect(result).toHaveLength(3);

    expect(result[0]!.kind).toBe("remark");
    expect(result[0]!.speakerRole).toBe("議長");

    expect(result[1]!.kind).toBe("question");
    expect(result[1]!.speakerName).toBe("福井保夫");
    expect(result[1]!.speakerRole).toBe("議員");

    expect(result[2]!.kind).toBe("answer");
    expect(result[2]!.speakerRole).toBe("副町長");
  });

  it("部長の発言を answer として分類する", () => {
    const text = "住民生活部長（吉田一弘） お答えいたします。検討中です。";
    const result = parseStatements(text);

    expect(result).toHaveLength(1);
    expect(result[0]!.speakerName).toBe("吉田一弘");
    expect(result[0]!.speakerRole).toBe("部長");
    expect(result[0]!.kind).toBe("answer");
  });

  it("contentHash を SHA-256 で生成する", () => {
    const text = "議長（淺野 勉） テスト発言です。";
    const result = parseStatements(text);

    expect(result).toHaveLength(1);
    const expected = createHash("sha256")
      .update("テスト発言です。")
      .digest("hex");
    expect(result[0]!.contentHash).toBe(expected);
  });

  it("startOffset / endOffset を連番で設定する", () => {
    const text =
      "議長（淺野 勉） 発言A。 町長（西本安博） 発言B。";
    const result = parseStatements(text);

    expect(result).toHaveLength(2);
    expect(result[0]!.startOffset).toBe(0);
    expect(result[0]!.endOffset).toBe("発言A。".length);
    expect(result[1]!.startOffset).toBe("発言A。".length + 1);
  });

  it("ト書き（登壇）を含むカッコはスキップする", () => {
    const text =
      "議長（淺野 勉） はい。西本町長。 （西本町長 登壇） 町長（西本安博） お答えいたします。";
    const result = parseStatements(text);

    expect(result).toHaveLength(2);
    expect(result[0]!.speakerRole).toBe("議長");
    expect(result[1]!.speakerRole).toBe("町長");
  });

  it("空テキストでは空配列を返す", () => {
    expect(parseStatements("")).toEqual([]);
  });

  it("発言者パターンがないテキストでは空配列を返す", () => {
    expect(parseStatements("これはただのテキストです。")).toEqual([]);
  });
});
