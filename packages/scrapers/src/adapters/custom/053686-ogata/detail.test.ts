import { describe, it, expect } from "vitest";
import {
  classifyKind,
  normalizeRole,
  parseMarker,
  parseStatements,
  extractHeldOn,
} from "./detail";

describe("normalizeRole", () => {
  it("議長はそのまま返す", () => {
    expect(normalizeRole("議長")).toBe("議長");
  });

  it("副議長はそのまま返す", () => {
    expect(normalizeRole("副議長")).toBe("副議長");
  });

  it("総務企画課長は課長に正規化する", () => {
    expect(normalizeRole("総務企画課長")).toBe("課長");
  });

  it("副委員長はそのまま返す", () => {
    expect(normalizeRole("副委員長")).toBe("副委員長");
  });

  it("議会運営委員長は委員長に正規化する", () => {
    expect(normalizeRole("議会運営委員長")).toBe("委員長");
  });

  it("村長はそのまま返す", () => {
    expect(normalizeRole("村長")).toBe("村長");
  });

  it("教育長はそのまま返す", () => {
    expect(normalizeRole("教育長")).toBe("教育長");
  });

  it("農業委員会事務局長は事務局長に正規化する", () => {
    expect(normalizeRole("農業委員会事務局長")).toBe("事務局長");
  });

  it("産業振興課長は課長に正規化する", () => {
    expect(normalizeRole("産業振興課長")).toBe("課長");
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

  it("副委員長は remark", () => {
    expect(classifyKind("副委員長")).toBe("remark");
  });

  it("村長は answer", () => {
    expect(classifyKind("村長")).toBe("answer");
  });

  it("副村長は answer", () => {
    expect(classifyKind("副村長")).toBe("answer");
  });

  it("教育長は answer", () => {
    expect(classifyKind("教育長")).toBe("answer");
  });

  it("課長は answer", () => {
    expect(classifyKind("課長")).toBe("answer");
  });

  it("議員は question", () => {
    expect(classifyKind("議員")).toBe("question");
  });

  it("null は remark", () => {
    expect(classifyKind(null)).toBe("remark");
  });
});

describe("parseMarker", () => {
  it("【議長：丹野敏彦】を解析する", () => {
    const result = parseMarker("【議長：丹野敏彦】");

    expect(result).not.toBeNull();
    expect(result!.speakerRole).toBe("議長");
    expect(result!.speakerName).toBe("丹野敏彦");
  });

  it("【村長：髙橋浩人】を解析する", () => {
    const result = parseMarker("【村長：髙橋浩人】");

    expect(result).not.toBeNull();
    expect(result!.speakerRole).toBe("村長");
    expect(result!.speakerName).toBe("髙橋浩人");
  });

  it("【総務企画課長：石川歳男】を解析して役職を正規化する", () => {
    const result = parseMarker("【総務企画課長：石川歳男】");

    expect(result).not.toBeNull();
    expect(result!.speakerRole).toBe("課長");
    expect(result!.speakerName).toBe("石川歳男");
  });

  it("【議会運営委員長：黒瀬友基】を解析して役職を正規化する", () => {
    const result = parseMarker("【議会運営委員長：黒瀬友基】");

    expect(result).not.toBeNull();
    expect(result!.speakerRole).toBe("委員長");
    expect(result!.speakerName).toBe("黒瀬友基");
  });

  it("マーカー形式でない文字列は null を返す", () => {
    expect(parseMarker("普通のテキスト")).toBeNull();
    expect(parseMarker("【不完全")).toBeNull();
  });
});

describe("parseStatements", () => {
  it("複数の発言者を持つテキストを分割する", () => {
    const text =
      "事前テキスト【議長：丹野敏彦】 ただいまから本日の会議を開きます。【議会運営委員長：黒瀬友基】 ご報告いたします。【村長：髙橋浩人】 お答えします。";

    const statements = parseStatements(text);

    expect(statements).toHaveLength(3);

    expect(statements[0]!.kind).toBe("remark");
    expect(statements[0]!.speakerRole).toBe("議長");
    expect(statements[0]!.speakerName).toBe("丹野敏彦");
    expect(statements[0]!.content).toBe(
      "ただいまから本日の会議を開きます。",
    );

    expect(statements[1]!.kind).toBe("remark");
    expect(statements[1]!.speakerRole).toBe("委員長");
    expect(statements[1]!.speakerName).toBe("黒瀬友基");

    expect(statements[2]!.kind).toBe("answer");
    expect(statements[2]!.speakerRole).toBe("村長");
    expect(statements[2]!.speakerName).toBe("髙橋浩人");
  });

  it("課長の発言を answer として分類する", () => {
    const text =
      "【議長：丹野敏彦】 総務企画課長。【総務企画課長：石川歳男】 ご説明いたします。";

    const statements = parseStatements(text);

    expect(statements).toHaveLength(2);
    expect(statements[1]!.kind).toBe("answer");
    expect(statements[1]!.speakerRole).toBe("課長");
    expect(statements[1]!.speakerName).toBe("石川歳男");
  });

  it("各 statement に contentHash が付与される", () => {
    const text = "【議長：丹野敏彦】 テスト発言。";
    const statements = parseStatements(text);

    expect(statements[0]!.contentHash).toMatch(/^[a-f0-9]{64}$/);
  });

  it("offset が正しく計算される", () => {
    const text =
      "【議長：丹野敏彦】 ただいま。【村長：髙橋浩人】 お答えします。";

    const statements = parseStatements(text);

    expect(statements[0]!.startOffset).toBe(0);
    expect(statements[0]!.endOffset).toBe("ただいま。".length);
    expect(statements[1]!.startOffset).toBe("ただいま。".length + 1);
  });

  it("空テキストは空配列を返す", () => {
    expect(parseStatements("")).toEqual([]);
  });

  it("【】マーカーがないテキストは空配列を返す", () => {
    expect(parseStatements("これは議事録ではありません。")).toEqual([]);
  });

  it("内容が空の発言はスキップする", () => {
    const text = "【議長：丹野敏彦】【村長：髙橋浩人】 お答えします。";

    const statements = parseStatements(text);

    expect(statements).toHaveLength(1);
    expect(statements[0]!.speakerRole).toBe("村長");
  });
});

describe("extractHeldOn", () => {
  it("PDF テキストから令和の日付を抽出する", () => {
    const text =
      "令和6年12月5日（木）午前10時00分 大潟村議会12月定例会会議録";
    expect(
      extractHeldOn(text, "令和6年第8回（12月）定例会 会議録"),
    ).toBe("2024-12-05");
  });

  it("全角数字の日付にも対応する", () => {
    const text =
      "令和６年１２月５日（木）午前10時00分 大潟村議会12月定例会会議録";
    expect(
      extractHeldOn(text, "令和6年第8回（12月）定例会 会議録"),
    ).toBe("2024-12-05");
  });

  it("令和元年に対応する", () => {
    const text = "令和元年9月10日（火） 大潟村議会9月定例会会議録";
    expect(
      extractHeldOn(text, "令和元年第3回（9月）定例会 会議録"),
    ).toBe("2019-09-10");
  });

  it("平成の日付にも対応する", () => {
    const text = "平成30年3月5日（月） 大潟村議会3月定例会会議録";
    expect(
      extractHeldOn(text, "平成30年第1回（3月）定例会 会議録"),
    ).toBe("2018-03-05");
  });

  it("PDF に日付がない場合はタイトルから月初日を推定する", () => {
    const text = "大潟村議会議事録テキスト";
    expect(
      extractHeldOn(text, "令和6年第8回（12月）定例会 会議録"),
    ).toBe("2024-12-01");
  });

  it("タイトルからも日付が取れない場合は null を返す", () => {
    expect(extractHeldOn("テキスト", "不明な会議")).toBeNull();
  });
});
