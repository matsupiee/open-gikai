import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import { classifyKind, parseSpeaker, parseStatements } from "./detail";

describe("parseSpeaker", () => {
  it("議長の発言を抽出する", () => {
    const result = parseSpeaker(
      "○議長（松澤正登君） 皆さん、おはようございます。",
    );
    expect(result.speakerName).toBe("松澤正登");
    expect(result.speakerRole).toBe("議長");
    expect(result.content).toBe("皆さん、おはようございます。");
  });

  it("番号付き議員を議員として抽出する", () => {
    const result = parseSpeaker("○９番（沓掛計三君） 質問いたします。");
    expect(result.speakerName).toBe("沓掛計三");
    expect(result.speakerRole).toBe("議員");
    expect(result.content).toBe("質問いたします。");
  });

  it("複合役職を末尾サフィックスで抽出する", () => {
    const result = parseSpeaker(
      "○参事兼総務企画課長（片田幸男君） それでは、御説明いたします。",
    );
    expect(result.speakerName).toBe("片田幸男");
    expect(result.speakerRole).toBe("課長");
    expect(result.content).toBe("それでは、御説明いたします。");
  });

  it("通常テキストは話者なしで返す", () => {
    const result = parseSpeaker("○議事日程……………………………………………………");
    expect(result.speakerName).toBeNull();
    expect(result.speakerRole).toBeNull();
    expect(result.content).toContain("議事日程");
  });
});

describe("classifyKind", () => {
  it("議長を remark に分類する", () => {
    expect(classifyKind("議長")).toBe("remark");
  });

  it("村長を answer に分類する", () => {
    expect(classifyKind("村長")).toBe("answer");
  });

  it("課長を answer に分類する", () => {
    expect(classifyKind("課長")).toBe("answer");
  });

  it("議員を question に分類する", () => {
    expect(classifyKind("議員")).toBe("question");
  });
});

describe("parseStatements", () => {
  it("話者ブロックだけを抽出し、◎見出しや目次項目を除外する", () => {
    const text = [
      "○議事日程……………………………………………………１",
      "○出席議員……………………………………………………２",
      "◎開会の宣告",
      "○議長（松澤正登君） 皆さん、おはようございます。",
      "◎村長挨拶",
      "○村長（北村政夫君） おはようございます。",
    ].join("\n");

    const result = parseStatements(text);

    expect(result).toHaveLength(2);
    expect(result[0]!.speakerRole).toBe("議長");
    expect(result[0]!.kind).toBe("remark");
    expect(result[0]!.content).toBe("皆さん、おはようございます。");
    expect(result[1]!.speakerRole).toBe("村長");
    expect(result[1]!.kind).toBe("answer");
  });

  it("ページ番号ノイズを除去する", () => {
    const text = [
      "○議長（松澤正登君） 会期は３月17日までの14日間と決定しました。 －5－",
      "◎村長挨拶",
      "○村長（北村政夫君） おはようございます。",
    ].join("\n");

    const result = parseStatements(text);

    expect(result).toHaveLength(2);
    expect(result[0]!.content).toBe("会期は３月17日までの14日間と決定しました。");
  });

  it("署名フッターを末尾から除去する", () => {
    const text = [
      "○議長（松澤正登君） 閉会いたします。 以上会議のてん末を記載し、地方自治法第１２３条第２項の規定により署名する。 令和 年 月 日 青木村議会議長",
    ].join("\n");

    const result = parseStatements(text);

    expect(result).toHaveLength(1);
    expect(result[0]!.content).toBe("閉会いたします。");
  });

  it("contentHash と offset を連続して設定する", () => {
    const text = [
      "○議長（松澤正登君） 開会いたします。",
      "○９番（沓掛計三君） 質問いたします。",
    ].join("\n");

    const result = parseStatements(text);

    expect(result).toHaveLength(2);
    expect(result[0]!.contentHash).toBe(
      createHash("sha256").update("開会いたします。").digest("hex"),
    );
    expect(result[0]!.startOffset).toBe(0);
    expect(result[0]!.endOffset).toBe("開会いたします。".length);
    expect(result[1]!.startOffset).toBe(result[0]!.endOffset + 1);
  });

  it("発言者がないテキストでは空配列を返す", () => {
    expect(parseStatements("青木村議会会議録")).toEqual([]);
  });
});
