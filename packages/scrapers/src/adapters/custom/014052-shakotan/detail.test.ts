import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import { extractHeldOnFromText } from "./shared";
import { parseQuestions, parseStatements } from "./detail";

describe("extractHeldOnFromText", () => {
  it("令和の日付を変換する", () => {
    expect(
      extractHeldOnFromText("令和７年１２月１６日（火）～令和７年１２月１８日（木）"),
    ).toBe("2025-12-16");
  });

  it("半角数字の令和日付を変換する", () => {
    expect(extractHeldOnFromText("令和7年3月10日")).toBe("2025-03-10");
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

describe("parseQuestions", () => {
  it("1行テキストから複数の質問者を抽出する", () => {
    // mergePages: true で抽出された実際のPDFテキスト形式
    const text =
      "令和7年第4回積丹町議会定例会の結果 ■ 定例会日程 令和7年12月16日（火） 一般質問 移住・定住対策について 【岩本幹兒議員】 独居高齢者対策について 【岩本幹兒議員】 一連の熊騒動について 【田村雄一議員】 議 案 第1号 積丹町公告式条例の一部改正について 原案可決";

    const result = parseQuestions(text);

    expect(result).toHaveLength(3);
    expect(result[0]!.speakerName).toBe("岩本幹兒");
    expect(result[1]!.speakerName).toBe("岩本幹兒");
    expect(result[2]!.speakerName).toBe("田村雄一");
  });

  it("質問テーマを抽出する", () => {
    const text =
      "一般質問 移住・定住対策について 【岩本幹兒議員】 議 案 第1号 積丹町公告式条例について 原案可決";

    const result = parseQuestions(text);

    expect(result).toHaveLength(1);
    expect(result[0]!.topic).toBe("移住・定住対策について");
  });

  it("議員名の前後のスペースを除去する", () => {
    // 実際のPDFには「【 坂節子議員】」のようにスペースがある
    const text = "一般質問 ＧＩＧＡスクール構想について 【 坂節子議員】 議 案";

    const result = parseQuestions(text);

    expect(result).toHaveLength(1);
    expect(result[0]!.speakerName).toBe("坂節子");
  });

  it("議員名パターンがない場合は空配列を返す", () => {
    const text = "議案第1号  積丹町公告式条例の一部改正について  原案可決";
    expect(parseQuestions(text)).toEqual([]);
  });

  it("一般質問セクションがない場合は空配列を返す", () => {
    const text = "行政報告 教育行政報告 議 案 第1号 条例改正 原案可決";
    expect(parseQuestions(text)).toEqual([]);
  });
});

describe("parseStatements", () => {
  it("一般質問を question として生成する", () => {
    const text =
      "令和7年第4回積丹町議会定例会の結果 一般質問 移住・定住対策について 【岩本幹兒議員】 一連の熊騒動について 【田村雄一議員】 議 案 第1号 条例改正 原案可決";

    const result = parseStatements(text);

    expect(result).toHaveLength(2);
    expect(result[0]!.kind).toBe("question");
    expect(result[0]!.speakerName).toBe("岩本幹兒");
    expect(result[0]!.speakerRole).toBe("議員");
    expect(result[0]!.content).toBe("移住・定住対策について");
    expect(result[0]!.contentHash).toBe(
      createHash("sha256").update("移住・定住対策について").digest("hex"),
    );

    expect(result[1]!.kind).toBe("question");
    expect(result[1]!.speakerName).toBe("田村雄一");
  });

  it("startOffset / endOffset が連続している", () => {
    const text =
      "一般質問 移住・定住対策について 【岩本幹兒議員】 一連の熊騒動について 【田村雄一議員】 議 案";

    const result = parseStatements(text);

    expect(result).toHaveLength(2);
    expect(result[0]!.startOffset).toBe(0);
    expect(result[0]!.endOffset).toBe("移住・定住対策について".length);
    expect(result[1]!.startOffset).toBe(result[0]!.endOffset + 1);
  });

  it("質問がない場合は空配列を返す", () => {
    const text = "議案第1号  積丹町公告式条例の一部改正について  原案可決";
    expect(parseStatements(text)).toEqual([]);
  });
});
