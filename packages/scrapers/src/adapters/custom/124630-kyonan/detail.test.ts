import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import {
  classifyKind,
  extractHeldOn,
  parseSpeaker,
  parseStatements,
} from "./detail";

describe("extractHeldOn", () => {
  it("全角数字の和暦日付を抽出する", () => {
    const text = "令和７年５月８日　開会";
    expect(extractHeldOn(text)).toBe("2025-05-08");
  });

  it("半角数字の和暦日付を抽出する", () => {
    const text = "令和6年3月15日 午前10時00分開議";
    expect(extractHeldOn(text)).toBe("2024-03-15");
  });

  it("平成の日付を抽出する", () => {
    const text = "平成２５年３月５日 午前１０時００分開議";
    expect(extractHeldOn(text)).toBe("2013-03-05");
  });

  it("令和元年に対応する", () => {
    const text = "令和元年９月９日 午前１０時開議";
    expect(extractHeldOn(text)).toBe("2019-09-09");
  });

  it("平成元年に対応する", () => {
    const text = "平成元年４月１日 午前１０時開議";
    expect(extractHeldOn(text)).toBe("1989-04-01");
  });

  it("日付がない場合は null を返す", () => {
    expect(extractHeldOn("マーカーなしのテキスト")).toBeNull();
  });
});

describe("parseSpeaker", () => {
  it("議長の発言を抽出する", () => {
    const result = parseSpeaker("○議長（青木悦子）　ただいまから会議を開きます。");
    expect(result.speakerName).toBe("青木悦子");
    expect(result.speakerRole).toBe("議長");
    expect(result.content).toBe("ただいまから会議を開きます。");
  });

  it("副議長の発言を抽出する", () => {
    const result = parseSpeaker("○副議長（田中次郎）　休憩します。");
    expect(result.speakerName).toBe("田中次郎");
    expect(result.speakerRole).toBe("副議長");
    expect(result.content).toBe("休憩します。");
  });

  it("町長の発言を抽出する", () => {
    const result = parseSpeaker("○町長（白石治和）　お答えいたします。");
    expect(result.speakerName).toBe("白石治和");
    expect(result.speakerRole).toBe("町長");
    expect(result.content).toBe("お答えいたします。");
  });

  it("番号付き議員の発言を抽出する（全角数字）", () => {
    const result = parseSpeaker("○１番（鈴木辰也）　質問いたします。");
    expect(result.speakerName).toBe("鈴木辰也");
    expect(result.speakerRole).toBe("議員");
    expect(result.content).toBe("質問いたします。");
  });

  it("番号付き議員の発言を抽出する（2桁全角数字）", () => {
    const result = parseSpeaker("○１２番（山田一郎）　発言します。");
    expect(result.speakerName).toBe("山田一郎");
    expect(result.speakerRole).toBe("議員");
    expect(result.content).toBe("発言します。");
  });

  it("課長の発言を抽出する", () => {
    const result = parseSpeaker("○税務住民課長（菊間寛之）　お答えいたします。");
    expect(result.speakerName).toBe("菊間寛之");
    expect(result.speakerRole).toBe("課長");
    expect(result.content).toBe("お答えいたします。");
  });

  it("教育長の発言を抽出する", () => {
    const result = parseSpeaker("○教育長（中村四郎）　お答えいたします。");
    expect(result.speakerName).toBe("中村四郎");
    expect(result.speakerRole).toBe("教育長");
    expect(result.content).toBe("お答えいたします。");
  });

  it("委員長の発言を抽出する", () => {
    const result = parseSpeaker("○議会運営委員会委員長（鈴木辰也）　報告いたします。");
    expect(result.speakerName).toBe("鈴木辰也");
    expect(result.speakerRole).toBe("委員長");
    expect(result.content).toBe("報告いたします。");
  });

  it("副委員長の発言を抽出する", () => {
    const result = parseSpeaker("○総務委員会副委員長（伊藤五郎）　報告します。");
    expect(result.speakerName).toBe("伊藤五郎");
    expect(result.speakerRole).toBe("副委員長");
    expect(result.content).toBe("報告します。");
  });

  it("名前の間のスペースを除去する", () => {
    const result = parseSpeaker("○町長（白石　治和）　お答えします。");
    expect(result.speakerName).toBe("白石治和");
    expect(result.speakerRole).toBe("町長");
  });

  it("カッコパターンに合致しない場合は content だけ返す", () => {
    const result = parseSpeaker("○休憩");
    expect(result.speakerName).toBeNull();
    expect(result.speakerRole).toBeNull();
    expect(result.content).toBe("休憩");
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

  it("議員は question を返す", () => {
    expect(classifyKind("議員")).toBe("question");
  });

  it("町長は answer を返す", () => {
    expect(classifyKind("町長")).toBe("answer");
  });

  it("副町長は answer を返す", () => {
    expect(classifyKind("副町長")).toBe("answer");
  });

  it("課長は answer を返す", () => {
    expect(classifyKind("課長")).toBe("answer");
  });

  it("教育長は answer を返す", () => {
    expect(classifyKind("教育長")).toBe("answer");
  });

  it("null は remark を返す", () => {
    expect(classifyKind(null)).toBe("remark");
  });
});

describe("parseStatements", () => {
  it("○マーカーで発言を分割して ParsedStatement 配列を返す", () => {
    const text = [
      "○議長（青木悦子）　ただいまから会議を開きます。",
      "○１番（鈴木辰也）　質問いたします。",
      "○町長（白石治和）　お答えいたします。",
    ].join("\n");

    const result = parseStatements(text);

    expect(result).toHaveLength(3);

    expect(result[0]!.kind).toBe("remark");
    expect(result[0]!.speakerName).toBe("青木悦子");
    expect(result[0]!.speakerRole).toBe("議長");
    expect(result[0]!.content).toBe("ただいまから会議を開きます。");
    expect(result[0]!.contentHash).toBe(
      createHash("sha256").update("ただいまから会議を開きます。").digest("hex"),
    );

    expect(result[1]!.kind).toBe("question");
    expect(result[1]!.speakerName).toBe("鈴木辰也");
    expect(result[1]!.speakerRole).toBe("議員");
    expect(result[1]!.content).toBe("質問いたします。");

    expect(result[2]!.kind).toBe("answer");
    expect(result[2]!.speakerName).toBe("白石治和");
    expect(result[2]!.speakerRole).toBe("町長");
    expect(result[2]!.content).toBe("お答えいたします。");
  });

  it("ト書き（登壇等）をスキップする", () => {
    const text = [
      "○議長（青木悦子）　発言を許します。",
      "○（鈴木辰也議員登壇）",
      "○１番（鈴木辰也）　質問いたします。",
    ].join("\n");

    const result = parseStatements(text);

    expect(result).toHaveLength(2);
    expect(result[0]!.speakerRole).toBe("議長");
    expect(result[1]!.speakerRole).toBe("議員");
  });

  it("○マーカーのないテキストは空配列を返す", () => {
    const text = "これはマーカーなしのテキストです。";
    const result = parseStatements(text);
    expect(result).toHaveLength(0);
  });

  it("startOffset と endOffset が連続する", () => {
    const text = [
      "○議長（青木悦子）　開会します。",
      "○町長（白石治和）　答弁します。",
    ].join("\n");

    const result = parseStatements(text);

    expect(result[0]!.startOffset).toBe(0);
    expect(result[0]!.endOffset).toBe("開会します。".length);
    expect(result[1]!.startOffset).toBe("開会します。".length + 1);
  });

  it("contentHash が生成される", () => {
    const text = "○議長（青木悦子）　ただいまから会議を開きます。";
    const result = parseStatements(text);
    expect(result[0]!.contentHash).toMatch(/^[a-f0-9]{64}$/);
  });
});
