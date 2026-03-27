import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import {
  classifyKind,
  findProceedingsStart,
  normalizeContent,
  parseSpeaker,
  parseStatements,
} from "./detail";

describe("findProceedingsStart", () => {
  it("開会時刻から議事本文開始位置を返す", () => {
    const text = [
      "○開会日に応招した議員",
      "林 英明君",
      "午前10時00分開会",
      "○議長（林 英明君） おはようございます。",
    ].join("\n");

    expect(findProceedingsStart(text)).toBe(text.indexOf("午前10時00分開会"));
  });
});

describe("parseSpeaker", () => {
  it("議長パターンを抽出する", () => {
    const result = parseSpeaker(
      "○議長（林 英明君） ただいまから本日の会議を開きます。",
    );
    expect(result.speakerName).toBe("林英明");
    expect(result.speakerRole).toBe("議長");
    expect(result.content).toBe("ただいまから本日の会議を開きます。");
  });

  it("番号付き議員パターンを抽出する", () => {
    const result = parseSpeaker("○３番（柴田 正彦君） 質問します。");
    expect(result.speakerName).toBe("柴田正彦");
    expect(result.speakerRole).toBe("議員");
    expect(result.content).toBe("質問します。");
  });

  it("課長補佐パターンを抽出する", () => {
    const result = parseSpeaker(
      "○社会教育課長補佐（吉貝 英貴君） ご説明いたします。",
    );
    expect(result.speakerName).toBe("吉貝英貴");
    expect(result.speakerRole).toBe("課長補佐");
    expect(result.content).toBe("ご説明いたします。");
  });
});

describe("classifyKind", () => {
  it("議長は remark に分類する", () => {
    expect(classifyKind("議長")).toBe("remark");
  });

  it("町長は answer に分類する", () => {
    expect(classifyKind("町長")).toBe("answer");
  });

  it("議員は question に分類する", () => {
    expect(classifyKind("議員")).toBe("question");
  });
});

describe("normalizeContent", () => {
  it("ページ装飾や日程見出しを除去する", () => {
    const text = [
      "おはようございます。",
      "癩癩癩癩癩癩・癩癩癩癩",
      "日程第１．署名議員の指名",
      "会議録署名議員の指名を行います。",
    ].join("\n");

    expect(normalizeContent(text)).toBe(
      "おはようございます。 会議録署名議員の指名を行います。",
    );
  });
});

describe("parseStatements", () => {
  it("冒頭名簿を飛ばして発言だけを抽出する", () => {
    const text = [
      "○開会日に応招した議員",
      "林 英明君",
      "午前10時00分開会",
      "○議長（林 英明君） おはようございます。",
      "ただいまの出席議員は１０人です。",
      "癩癩癩癩癩癩・癩癩癩癩",
      "日程第１．署名議員の指名",
      "○３番（柴田 正彦君） 質問いたします。",
      "○町長（井上 利一君） お答えいたします。",
    ].join("\n");

    const result = parseStatements(text);

    expect(result).toHaveLength(3);
    expect(result[0]!.kind).toBe("remark");
    expect(result[0]!.speakerName).toBe("林英明");
    expect(result[0]!.content).toBe(
      "おはようございます。 ただいまの出席議員は１０人です。",
    );
    expect(result[1]!.kind).toBe("question");
    expect(result[1]!.speakerRole).toBe("議員");
    expect(result[2]!.kind).toBe("answer");
    expect(result[2]!.speakerRole).toBe("町長");
    expect(result[2]!.contentHash).toBe(
      createHash("sha256").update("お答えいたします。").digest("hex"),
    );
  });

  it("空文字なら空配列を返す", () => {
    expect(parseStatements("")).toEqual([]);
  });
});
