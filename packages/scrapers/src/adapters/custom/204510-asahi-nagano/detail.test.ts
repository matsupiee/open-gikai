import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import { classifyKind, parseHeldOn, parseSpeaker, parseStatements } from "./detail";
import { normalizePdfText } from "./shared";

describe("parseHeldOn", () => {
  it("開会日の和暦日付を抽出する", () => {
    const text = "令和７年 朝日村議会 ６ 月 定 例 会 会 議 録 令 和 ７ 年 ６月 ３ 日 開 会";
    expect(parseHeldOn(normalizePdfText(text))).toBe("2025-06-03");
  });

  it("令和元年に対応する", () => {
    const text = "令和元年９月９日開議";
    expect(parseHeldOn(text)).toBe("2019-09-09");
  });

  it("平成元年に対応する", () => {
    const text = "平成元年４月１日開会";
    expect(parseHeldOn(text)).toBe("1989-04-01");
  });

  it("日付がない場合は null を返す", () => {
    expect(parseHeldOn("会議録")).toBeNull();
  });
});

describe("parseSpeaker", () => {
  it("議長の発言を抽出する", () => {
    const result = parseSpeaker("○議長（小林弘之君）皆さん、おはようございます。");
    expect(result.speakerName).toBe("小林弘之");
    expect(result.speakerRole).toBe("議長");
    expect(result.content).toBe("皆さん、おはようございます。");
  });

  it("番号付き議員の発言を抽出する", () => {
    const result = parseSpeaker("○１０番（清沢敬子君）本日は２問の質問をさせていただきます。");
    expect(result.speakerName).toBe("清沢敬子");
    expect(result.speakerRole).toBe("議員");
  });

  it("複合役職はサフィックスで分類する", () => {
    const result = parseSpeaker("○会計管理者兼総務課長（上條晴彦君）お答えいたします。");
    expect(result.speakerName).toBe("上條晴彦");
    expect(result.speakerRole).toBe("課長");
  });

  it("園長も答弁者として扱える", () => {
    const result = parseSpeaker("○保育園長（上條浩充君）お答えいたします。");
    expect(result.speakerRole).toBe("園長");
  });
});

describe("classifyKind", () => {
  it("議長は remark を返す", () => {
    expect(classifyKind("議長")).toBe("remark");
  });

  it("議員は question を返す", () => {
    expect(classifyKind("議員")).toBe("question");
  });

  it("課長と園長は answer を返す", () => {
    expect(classifyKind("課長")).toBe("answer");
    expect(classifyKind("園長")).toBe("answer");
  });
});

describe("parseStatements", () => {
  it("目次の○項目を無視して実際の発言だけを抽出する", () => {
    const text = normalizePdfText(`
      令和７年朝日村議会６月定例会会議録目次
      ○招集告示
      ○議事日程
      ○議長（小林弘之君）皆さん、おはようございます。
      ◎議事日程の報告
      ○議長（小林弘之君）本日の議事日程は、お手元に配付のとおりです。
      ◇清沢敬子君
      〔１０番 清沢敬子君登壇〕
      ○１０番（清沢敬子君）本日は２問の質問をさせていただきます。
    `);

    const result = parseStatements(text);

    expect(result).toHaveLength(3);
    expect(result[0]!.speakerRole).toBe("議長");
    expect(result[0]!.content).toBe("皆さん、おはようございます。");
    expect(result[1]!.content).toBe("本日の議事日程は、お手元に配付のとおりです。");
    expect(result[2]!.speakerRole).toBe("議員");
  });

  it("contentHash が SHA-256 で生成される", () => {
    const text = "○村長（小林弘幸君）お答えいたします。";
    const result = parseStatements(text);

    expect(result[0]!.contentHash).toBe(
      createHash("sha256").update("お答えいたします。").digest("hex"),
    );
  });

  it("startOffset と endOffset が連続する", () => {
    const text = ["○議長（小林弘之君）開会します。", "○村長（小林弘幸君）お答えいたします。"].join(
      "\n",
    );

    const result = parseStatements(text);

    expect(result[0]!.startOffset).toBe(0);
    expect(result[0]!.endOffset).toBe("開会します。".length);
    expect(result[1]!.startOffset).toBe("開会します。".length + 1);
  });
});
