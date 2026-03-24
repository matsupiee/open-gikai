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
    const text =
      "令和８年１月１４日 午前１０時００分開議";
    expect(extractHeldOn(text)).toBe("2026-01-14");
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
    const result = parseSpeaker("○議長（山田太郎君）　ただいまから会議を開きます。");
    expect(result.speakerName).toBe("山田太郎");
    expect(result.speakerRole).toBe("議長");
    expect(result.content).toBe("ただいまから会議を開きます。");
  });

  it("副議長の発言を抽出する", () => {
    const result = parseSpeaker("○副議長（佐藤花子君）　休憩します。");
    expect(result.speakerName).toBe("佐藤花子");
    expect(result.speakerRole).toBe("副議長");
    expect(result.content).toBe("休憩します。");
  });

  it("町長の発言を抽出する", () => {
    const result = parseSpeaker("○町長（鈴木一郎君）　お答えいたします。");
    expect(result.speakerName).toBe("鈴木一郎");
    expect(result.speakerRole).toBe("町長");
    expect(result.content).toBe("お答えいたします。");
  });

  it("番号付き議員の発言を抽出する", () => {
    const result = parseSpeaker("○３番（田中次郎君）　質問いたします。");
    expect(result.speakerName).toBe("田中次郎");
    expect(result.speakerRole).toBe("議員");
    expect(result.content).toBe("質問いたします。");
  });

  it("課長の発言を抽出する", () => {
    const result = parseSpeaker("○総務課長（高橋三郎君）　お答えいたします。");
    expect(result.speakerName).toBe("高橋三郎");
    expect(result.speakerRole).toBe("課長");
    expect(result.content).toBe("お答えいたします。");
  });

  it("教育長の発言を抽出する", () => {
    const result = parseSpeaker("○教育長（中村四郎君）　お答えいたします。");
    expect(result.speakerName).toBe("中村四郎");
    expect(result.speakerRole).toBe("教育長");
    expect(result.content).toBe("お答えいたします。");
  });

  it("名前の間のスペースを除去する", () => {
    const result = parseSpeaker("○町長（鈴木　一郎君）　お答えします。");
    expect(result.speakerName).toBe("鈴木一郎");
    expect(result.speakerRole).toBe("町長");
  });

  it("副町長の発言を抽出する", () => {
    const result = parseSpeaker("○副町長（伊藤五郎君）　お答えいたします。");
    expect(result.speakerName).toBe("伊藤五郎");
    expect(result.speakerRole).toBe("副町長");
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

  it("委員長は remark を返す", () => {
    expect(classifyKind("委員長")).toBe("remark");
  });

  it("副委員長は remark を返す", () => {
    expect(classifyKind("副委員長")).toBe("remark");
  });

  it("null は remark を返す", () => {
    expect(classifyKind(null)).toBe("remark");
  });
});

describe("parseStatements", () => {
  it("○マーカーで発言を分割して ParsedStatement 配列を返す", () => {
    const text = [
      "○議長（山田太郎君）　ただいまから会議を開きます。",
      "○３番（田中次郎君）　質問いたします。",
      "○町長（鈴木一郎君）　お答えいたします。",
    ].join("\n");

    const result = parseStatements(text);

    expect(result).toHaveLength(3);

    expect(result[0]!.kind).toBe("remark");
    expect(result[0]!.speakerName).toBe("山田太郎");
    expect(result[0]!.speakerRole).toBe("議長");
    expect(result[0]!.content).toBe("ただいまから会議を開きます。");
    expect(result[0]!.contentHash).toBe(
      createHash("sha256").update("ただいまから会議を開きます。").digest("hex"),
    );

    expect(result[1]!.kind).toBe("question");
    expect(result[1]!.speakerName).toBe("田中次郎");
    expect(result[1]!.speakerRole).toBe("議員");
    expect(result[1]!.content).toBe("質問いたします。");

    expect(result[2]!.kind).toBe("answer");
    expect(result[2]!.speakerName).toBe("鈴木一郎");
    expect(result[2]!.speakerRole).toBe("町長");
    expect(result[2]!.content).toBe("お答えいたします。");
  });

  it("ト書き（登壇等）をスキップする", () => {
    const text = [
      "○議長（山田太郎君）　発言を許します。",
      "○（田中次郎議員登壇）",
      "○３番（田中次郎君）　質問いたします。",
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
      "○議長（山田太郎君）　開会します。",
      "○町長（鈴木一郎君）　答弁します。",
    ].join("\n");

    const result = parseStatements(text);

    expect(result[0]!.startOffset).toBe(0);
    expect(result[0]!.endOffset).toBe("開会します。".length);
    expect(result[1]!.startOffset).toBe("開会します。".length + 1);
  });
});
