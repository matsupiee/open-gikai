import { describe, expect, it } from "vitest";
import {
  classifyKind,
  parseDateFromPdf,
  parseSpeaker,
  parseStatements,
} from "./detail";

describe("parseSpeaker", () => {
  it("議長（名前君）パターンを解析する", () => {
    const result = parseSpeaker(
      "○議長（山田太郎君）　それでは、ただいまから会議を開きます。",
    );
    expect(result.speakerName).toBe("山田太郎");
    expect(result.speakerRole).toBe("議長");
    expect(result.content).toBe("それでは、ただいまから会議を開きます。");
  });

  it("町長（名前君）パターンを解析する", () => {
    const result = parseSpeaker("○町長（鈴木花子君）　お答えいたします。");
    expect(result.speakerName).toBe("鈴木花子");
    expect(result.speakerRole).toBe("町長");
    expect(result.content).toBe("お答えいたします。");
  });

  it("番号議員パターンを解析する", () => {
    const result = parseSpeaker("○3番（田中一郎君）　質問いたします。");
    expect(result.speakerName).toBe("田中一郎");
    expect(result.speakerRole).toBe("議員");
    expect(result.content).toBe("質問いたします。");
  });

  it("教育長パターンを解析する", () => {
    const result = parseSpeaker(
      "○教育長（佐藤美咲君）　お答えいたします。",
    );
    expect(result.speakerName).toBe("佐藤美咲");
    expect(result.speakerRole).toBe("教育長");
    expect(result.content).toBe("お答えいたします。");
  });

  it("課長パターンを解析する", () => {
    const result = parseSpeaker(
      "○総務課長（高橋次郎君）　ご説明いたします。",
    );
    expect(result.speakerName).toBe("高橋次郎");
    expect(result.speakerRole).toBe("課長");
    expect(result.content).toBe("ご説明いたします。");
  });

  it("副町長パターンを解析する", () => {
    const result = parseSpeaker(
      "○副町長（渡辺三郎君）　ご報告いたします。",
    );
    expect(result.speakerName).toBe("渡辺三郎");
    expect(result.speakerRole).toBe("副町長");
    expect(result.content).toBe("ご報告いたします。");
  });

  it("名前に空白を含む場合は除去される", () => {
    const result = parseSpeaker("○町長（鈴 木 花 子君）　答弁します。");
    expect(result.speakerName).toBe("鈴木花子");
  });

  it("○ マーカーなしのテキスト", () => {
    const result = parseSpeaker("午後１時開議");
    expect(result.speakerName).toBeNull();
    expect(result.speakerRole).toBeNull();
    expect(result.content).toBe("午後１時開議");
  });

  it("副委員長は副委員長として解析される", () => {
    const result = parseSpeaker("○副委員長（木村四郎君）　発言します。");
    expect(result.speakerRole).toBe("副委員長");
  });

  it("委員長は委員長として解析される", () => {
    const result = parseSpeaker("○委員長（中村五郎君）　開会します。");
    expect(result.speakerRole).toBe("委員長");
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

  it("町長は answer", () => {
    expect(classifyKind("町長")).toBe("answer");
  });

  it("副町長は answer", () => {
    expect(classifyKind("副町長")).toBe("answer");
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

  it("〇〇課長のような複合役職は answer", () => {
    expect(classifyKind("総務課長")).toBe("answer");
  });
});

describe("parseStatements", () => {
  it("○ マーカーでテキストを分割する", () => {
    const text = `
○議長（山田太郎君）　ただいまから本日の会議を開きます。
○3番（田中一郎君）　質問があります。
○町長（鈴木花子君）　お答えします。
`;
    const statements = parseStatements(text);

    expect(statements).toHaveLength(3);

    expect(statements[0]!.kind).toBe("remark");
    expect(statements[0]!.speakerName).toBe("山田太郎");
    expect(statements[0]!.speakerRole).toBe("議長");

    expect(statements[1]!.kind).toBe("question");
    expect(statements[1]!.speakerName).toBe("田中一郎");
    expect(statements[1]!.speakerRole).toBe("議員");

    expect(statements[2]!.kind).toBe("answer");
    expect(statements[2]!.speakerName).toBe("鈴木花子");
    expect(statements[2]!.speakerRole).toBe("町長");
  });

  it("各 statement に contentHash が付与される", () => {
    const statements = parseStatements(
      "○議長（山田太郎君）　テスト発言。",
    );
    expect(statements[0]!.contentHash).toMatch(/^[a-f0-9]{64}$/);
  });

  it("offset が正しく計算される", () => {
    const text = `○議長（山田太郎君）　ただいま。
○3番（田中一郎君）　質問です。`;

    const statements = parseStatements(text);

    expect(statements[0]!.startOffset).toBe(0);
    expect(statements[0]!.endOffset).toBe("ただいま。".length);
    expect(statements[1]!.startOffset).toBe("ただいま。".length + 1);
  });

  it("空テキストは空配列を返す", () => {
    expect(parseStatements("")).toEqual([]);
  });

  it("ト書きをスキップする", () => {
    const text = `○議長（山田太郎君）　開会します。
○（3番　田中一郎登壇）
○3番（田中一郎君）　質問です。`;

    const statements = parseStatements(text);
    expect(statements).toHaveLength(2);
    expect(statements[0]!.speakerRole).toBe("議長");
    expect(statements[1]!.speakerRole).toBe("議員");
  });
});

describe("parseDateFromPdf", () => {
  it("令和の日付をパースする", () => {
    expect(
      parseDateFromPdf("令和6年12月5日（木曜日）午後1時開会"),
    ).toBe("2024-12-05");
  });

  it("全角数字を含む日付をパースする", () => {
    expect(
      parseDateFromPdf("令和６年１２月５日（木曜日）午後１時開会"),
    ).toBe("2024-12-05");
  });

  it("令和元年をパースする", () => {
    expect(
      parseDateFromPdf("令和元年９月９日（月曜日）午後１時開会"),
    ).toBe("2019-09-09");
  });

  it("平成の日付をパースする", () => {
    expect(
      parseDateFromPdf("平成31年3月5日（火曜日）午前10時開会"),
    ).toBe("2019-03-05");
  });

  it("日付がない場合は null を返す", () => {
    expect(parseDateFromPdf("議事日程")).toBeNull();
  });

  it("スペースが含まれる日付もパースする", () => {
    expect(
      parseDateFromPdf("令和 6 年 12 月 5 日"),
    ).toBe("2024-12-05");
  });
});
