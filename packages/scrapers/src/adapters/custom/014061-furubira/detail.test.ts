import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import { extractHeldOnFromText } from "./shared";
import { classifyKind, parseSpeaker, parseStatements } from "./detail";

describe("extractHeldOnFromText", () => {
  it("令和の日付を変換する", () => {
    expect(
      extractHeldOnFromText("令和７年３月７日（金曜日）"),
    ).toBe("2025-03-07");
  });

  it("半角数字の令和日付を変換する", () => {
    expect(extractHeldOnFromText("令和7年3月7日")).toBe("2025-03-07");
  });

  it("令和元年に対応する", () => {
    expect(extractHeldOnFromText("令和元年6月10日")).toBe("2019-06-10");
  });

  it("平成の日付を変換する", () => {
    expect(extractHeldOnFromText("平成30年12月10日")).toBe("2018-12-10");
  });

  it("マッチしない場合はnullを返す", () => {
    expect(extractHeldOnFromText("2024年3月1日")).toBeNull();
  });
});

describe("parseSpeaker", () => {
  it("議長パターンを抽出する", () => {
    const result = parseSpeaker(
      "〇議長（堀 清君） ただいまから会議を開きます。",
    );
    expect(result.speakerName).toBe("堀清");
    expect(result.speakerRole).toBe("議長");
    expect(result.content).toBe("ただいまから会議を開きます。");
  });

  it("町長パターンを抽出する", () => {
    const result = parseSpeaker(
      "〇町長（成田昭彦君） お答えいたします。",
    );
    expect(result.speakerName).toBe("成田昭彦");
    expect(result.speakerRole).toBe("町長");
    expect(result.content).toBe("お答えいたします。");
  });

  it("番号付き議員パターンを抽出する", () => {
    const result = parseSpeaker(
      "〇５番（真貝政昭君） 質問いたします。",
    );
    expect(result.speakerName).toBe("真貝政昭");
    expect(result.speakerRole).toBe("議員");
    expect(result.content).toBe("質問いたします。");
  });

  it("課長パターンを抽出する", () => {
    const result = parseSpeaker(
      "〇総務課長（細川正善君） お答えいたします。",
    );
    expect(result.speakerName).toBe("細川正善");
    expect(result.speakerRole).toBe("課長");
    expect(result.content).toBe("お答えいたします。");
  });

  it("議会事務局長パターンを抽出する", () => {
    const result = parseSpeaker(
      "〇議会事務局長（白岩 豊君） ご報告申し上げます。",
    );
    expect(result.speakerName).toBe("白岩豊");
    expect(result.speakerRole).toBe("事務局長");
    expect(result.content).toBe("ご報告申し上げます。");
  });

  it("議会運営委員長パターンを抽出する", () => {
    const result = parseSpeaker(
      "〇議会運営委員長（工藤澄男君） ご報告申し上げます。",
    );
    expect(result.speakerName).toBe("工藤澄男");
    expect(result.speakerRole).toBe("議会運営委員長");
    expect(result.content).toBe("ご報告申し上げます。");
  });

  it("会計管理者パターンを抽出する", () => {
    const result = parseSpeaker(
      "〇会計管理者（関口央昌君） お答えいたします。",
    );
    expect(result.speakerName).toBe("関口央昌");
    expect(result.speakerRole).toBe("管理者");
    expect(result.content).toBe("お答えいたします。");
  });

  it("教育次長パターンを抽出する", () => {
    const result = parseSpeaker(
      "〇教育次長（小原和之君） お答えいたします。",
    );
    expect(result.speakerName).toBe("小原和之");
    expect(result.speakerRole).toBe("教育次長");
    expect(result.content).toBe("お答えいたします。");
  });

  it("副町長パターンを抽出する", () => {
    const result = parseSpeaker(
      "〇副町長（奥山均君） お答えします。",
    );
    expect(result.speakerName).toBe("奥山均");
    expect(result.speakerRole).toBe("副町長");
    expect(result.content).toBe("お答えします。");
  });

  it("名前にスペースが含まれる場合スペースを除去する", () => {
    const result = parseSpeaker(
      "〇議長（堀　清君） 開会します。",
    );
    expect(result.speakerName).toBe("堀清");
    expect(result.speakerRole).toBe("議長");
  });

  it("マーカーのみで内容がない場合は content が空になる", () => {
    const result = parseSpeaker("〇");
    expect(result.speakerName).toBeNull();
    expect(result.speakerRole).toBeNull();
    expect(result.content).toBe("");
  });

  it("産業課観光室長パターンを抽出する", () => {
    const result = parseSpeaker(
      "〇産業課観光室長（岩戸真二君） お答えいたします。",
    );
    expect(result.speakerName).toBe("岩戸真二");
    expect(result.speakerRole).toBe("観光室長");
    expect(result.content).toBe("お答えいたします。");
  });
});

describe("classifyKind", () => {
  it("議長は remark に分類する", () => {
    expect(classifyKind("議長")).toBe("remark");
  });

  it("副議長は remark に分類する", () => {
    expect(classifyKind("副議長")).toBe("remark");
  });

  it("議会運営委員長は remark に分類する", () => {
    expect(classifyKind("議会運営委員長")).toBe("remark");
  });

  it("町長は answer に分類する", () => {
    expect(classifyKind("町長")).toBe("answer");
  });

  it("副町長は answer に分類する", () => {
    expect(classifyKind("副町長")).toBe("answer");
  });

  it("課長は answer に分類する", () => {
    expect(classifyKind("課長")).toBe("answer");
  });

  it("教育長は answer に分類する", () => {
    expect(classifyKind("教育長")).toBe("answer");
  });

  it("教育次長は answer に分類する", () => {
    expect(classifyKind("教育次長")).toBe("answer");
  });

  it("事務局長は answer に分類する", () => {
    expect(classifyKind("事務局長")).toBe("answer");
  });

  it("管理者は answer に分類する", () => {
    expect(classifyKind("管理者")).toBe("answer");
  });

  it("観光室長は answer に分類する", () => {
    expect(classifyKind("観光室長")).toBe("answer");
  });

  it("議員は question に分類する", () => {
    expect(classifyKind("議員")).toBe("question");
  });

  it("null は remark に分類する", () => {
    expect(classifyKind(null)).toBe("remark");
  });
});

describe("parseStatements", () => {
  it("〇マーカーで分割して ParsedStatement 配列を生成する", () => {
    const text = [
      "〇議長（堀 清君） ただいまから会議を開きます。",
      "〇５番（真貝政昭君） 質問いたします。",
      "〇町長（成田昭彦君） お答えいたします。",
    ].join("\n");

    const result = parseStatements(text);

    expect(result).toHaveLength(3);
    expect(result[0]!.kind).toBe("remark");
    expect(result[0]!.speakerName).toBe("堀清");
    expect(result[0]!.speakerRole).toBe("議長");
    expect(result[0]!.content).toBe("ただいまから会議を開きます。");
    expect(result[0]!.contentHash).toBe(
      createHash("sha256")
        .update("ただいまから会議を開きます。")
        .digest("hex"),
    );

    expect(result[1]!.kind).toBe("question");
    expect(result[1]!.speakerName).toBe("真貝政昭");
    expect(result[1]!.speakerRole).toBe("議員");

    expect(result[2]!.kind).toBe("answer");
    expect(result[2]!.speakerName).toBe("成田昭彦");
    expect(result[2]!.speakerRole).toBe("町長");
  });

  it("議事日程などの見出し項目をスキップする", () => {
    const text = [
      "〇議事日程 １ 会議録署名議員の指名 ２ 会期の決定",
      "〇出席議員（10名）",
      "〇議長（堀 清君） ただいまから会議を開きます。",
    ].join("\n");

    const result = parseStatements(text);
    expect(result).toHaveLength(1);
    expect(result[0]!.speakerRole).toBe("議長");
  });

  it("空テキストでは空配列を返す", () => {
    expect(parseStatements("")).toEqual([]);
  });

  it("〇マーカーがないテキストでは空配列を返す", () => {
    expect(parseStatements("ただの説明テキストです。")).toEqual([]);
  });

  it("startOffset / endOffset が連続している", () => {
    const text = [
      "〇議長（堀 清君） 開会します。",
      "〇町長（成田昭彦君） 答弁します。",
    ].join("\n");

    const result = parseStatements(text);
    expect(result).toHaveLength(2);
    expect(result[0]!.startOffset).toBe(0);
    expect(result[0]!.endOffset).toBe("開会します。".length);
    expect(result[1]!.startOffset).toBe(result[0]!.endOffset + 1);
  });
});
