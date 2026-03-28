import { describe, expect, it } from "vitest";
import {
  classifyKind,
  extractHeldOn,
  extractTitle,
  parseSpeaker,
  parseStatements,
} from "./detail";

describe("parseSpeaker", () => {
  it("議長（氏名君）形式を解析する", () => {
    const result = parseSpeaker("○議長（西 昭夫君） 皆さん、おはようございます。");
    expect(result.speakerName).toBe("西昭夫");
    expect(result.speakerRole).toBe("議長");
    expect(result.content).toBe("皆さん、おはようございます。");
  });

  it("番号議員を議員として扱う", () => {
    const result = parseSpeaker("○７番（由本好史君） ７番、由本です。");
    expect(result.speakerName).toBe("由本好史");
    expect(result.speakerRole).toBe("議員");
    expect(result.content).toBe("7番、由本です。");
  });

  it("担当課長を長い suffix で優先判定する", () => {
    const result = parseSpeaker("○総務財政課 担当課長（吉田和秀君） ご説明します。");
    expect(result.speakerName).toBe("吉田和秀");
    expect(result.speakerRole).toBe("担当課長");
  });

  it("課長事務取扱を解析する", () => {
    const result = parseSpeaker(
      "○参事兼希望のまち推進課長事務取扱（田中邦男君） 報告します。",
    );
    expect(result.speakerName).toBe("田中邦男");
    expect(result.speakerRole).toBe("課長事務取扱");
  });
});

describe("classifyKind", () => {
  it("議長は remark", () => {
    expect(classifyKind("議長")).toBe("remark");
  });

  it("町長は answer", () => {
    expect(classifyKind("町長")).toBe("answer");
  });

  it("担当課長は answer", () => {
    expect(classifyKind("担当課長")).toBe("answer");
  });

  it("議員は question", () => {
    expect(classifyKind("議員")).toBe("question");
  });
});

describe("parseStatements", () => {
  it("○ マーカーごとに発言を分割する", () => {
    const text = `
      ○議長（西 昭夫君） ただいまから会議を開きます。
      ○７番（由本好史君） 質問します。
      ○税住民課長（草水英行君） お答えします。
    `;

    const statements = parseStatements(text);

    expect(statements).toHaveLength(3);
    expect(statements[0]!.kind).toBe("remark");
    expect(statements[1]!.kind).toBe("question");
    expect(statements[2]!.kind).toBe("answer");
    expect(statements[2]!.speakerRole).toBe("課長");
  });

  it("○ がない話者ヘッダでも発言を抽出する", () => {
    const text = `
      議長（西 昭夫君） ただいまから会議を開きます。
      ７番（由本好史君） 質問します。
      税住民課長（草水英行君） お答えします。
    `;

    const statements = parseStatements(text);

    expect(statements).toHaveLength(3);
    expect(statements[0]!.speakerRole).toBe("議長");
    expect(statements[1]!.speakerRole).toBe("議員");
    expect(statements[2]!.speakerRole).toBe("課長");
  });

  it("contentHash と offset を付与する", () => {
    const statements = parseStatements("○議長（西 昭夫君） ただいま。");
    expect(statements[0]!.contentHash).toMatch(/^[a-f0-9]{64}$/);
    expect(statements[0]!.startOffset).toBe(0);
    expect(statements[0]!.endOffset).toBe("ただいま。".length);
  });
});

describe("extractHeldOn", () => {
  it("招集年月日から開催日を抽出する", () => {
    const text =
      "令和７年第３回（定例会） 笠置町議会 会議録（第１号） 招 集 年 月 日 令和７年９月11日 木曜日";
    expect(extractHeldOn(text)).toBe("2025-09-11");
  });

  it("通常の和暦日付も抽出できる", () => {
    const text = "令和6年2月27日 笠置町議会会議録";
    expect(extractHeldOn(text)).toBe("2024-02-27");
  });

  it("日付がない場合は null を返す", () => {
    expect(extractHeldOn("会議録")).toBeNull();
  });
});

describe("extractTitle", () => {
  it("PDF 冒頭から会議録タイトルを抽出する", () => {
    const text =
      "１ 令和７年第３回（定例会） 笠置町議会 会議録（第１号） 招 集 年 月 日 令和７年９月11日";
    expect(extractTitle(text, "fallback")).toBe(
      "令和7年第3回（定例会） 笠置町議会 会議録（第1号）",
    );
  });

  it("抽出できない場合は fallback を返す", () => {
    expect(extractTitle("会議録", "fallback title")).toBe("fallback title");
  });
});
