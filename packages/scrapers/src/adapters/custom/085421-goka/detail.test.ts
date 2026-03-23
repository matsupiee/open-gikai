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
      "○議長（鈴木喜一郎君）　それでは、ただいまから会議を開きます。",
    );
    expect(result.speakerName).toBe("鈴木喜一郎");
    expect(result.speakerRole).toBe("議長");
    expect(result.content).toBe("それでは、ただいまから会議を開きます。");
  });

  it("町長（名前君）パターンを解析する", () => {
    const result = parseSpeaker("○町長（染谷森雄君）　お答えいたします。");
    expect(result.speakerName).toBe("染谷森雄");
    expect(result.speakerRole).toBe("町長");
    expect(result.content).toBe("お答えいたします。");
  });

  it("番号議員パターンを解析する", () => {
    const result = parseSpeaker("○6番（新井　庫君）　質問いたします。");
    expect(result.speakerName).toBe("新井庫");
    expect(result.speakerRole).toBe("議員");
    expect(result.content).toBe("質問いたします。");
  });

  it("教育長パターンを解析する", () => {
    const result = parseSpeaker(
      "○教育長（森田恵美子君）　お答えいたします。",
    );
    expect(result.speakerName).toBe("森田恵美子");
    expect(result.speakerRole).toBe("教育長");
    expect(result.content).toBe("お答えいたします。");
  });

  it("課長パターンを解析する", () => {
    const result = parseSpeaker(
      "○都市建設課長（大橋　勝君）　ご説明いたします。",
    );
    expect(result.speakerName).toBe("大橋勝");
    expect(result.speakerRole).toBe("課長");
    expect(result.content).toBe("ご説明いたします。");
  });

  it("副町長パターンを解析する", () => {
    const result = parseSpeaker(
      "○副町長（田神文明君）　ご報告いたします。",
    );
    expect(result.speakerName).toBe("田神文明");
    expect(result.speakerRole).toBe("副町長");
    expect(result.content).toBe("ご報告いたします。");
  });

  it("名前に空白を含む場合は除去される", () => {
    const result = parseSpeaker("○町長（染 谷 森 雄君）　答弁します。");
    expect(result.speakerName).toBe("染谷森雄");
  });

  it("○ マーカーなしのテキスト", () => {
    const result = parseSpeaker("午後１時開議");
    expect(result.speakerName).toBeNull();
    expect(result.speakerRole).toBeNull();
    expect(result.content).toBe("午後１時開議");
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
});

describe("parseStatements", () => {
  it("○ マーカーでテキストを分割する", () => {
    const text = `
○議長（鈴木喜一郎君）　ただいまから本日の会議を開きます。
○6番（新井　庫君）　質問があります。
○町長（染谷森雄君）　お答えします。
`;
    const statements = parseStatements(text);

    expect(statements).toHaveLength(3);

    expect(statements[0]!.kind).toBe("remark");
    expect(statements[0]!.speakerName).toBe("鈴木喜一郎");
    expect(statements[0]!.speakerRole).toBe("議長");

    expect(statements[1]!.kind).toBe("question");
    expect(statements[1]!.speakerName).toBe("新井庫");
    expect(statements[1]!.speakerRole).toBe("議員");

    expect(statements[2]!.kind).toBe("answer");
    expect(statements[2]!.speakerName).toBe("染谷森雄");
    expect(statements[2]!.speakerRole).toBe("町長");
  });

  it("各 statement に contentHash が付与される", () => {
    const statements = parseStatements(
      "○議長（鈴木喜一郎君）　テスト発言。",
    );
    expect(statements[0]!.contentHash).toMatch(/^[a-f0-9]{64}$/);
  });

  it("offset が正しく計算される", () => {
    const text = `○議長（鈴木喜一郎君）　ただいま。
○6番（新井　庫君）　質問です。`;

    const statements = parseStatements(text);

    expect(statements[0]!.startOffset).toBe(0);
    expect(statements[0]!.endOffset).toBe("ただいま。".length);
    expect(statements[1]!.startOffset).toBe("ただいま。".length + 1);
  });

  it("空テキストは空配列を返す", () => {
    expect(parseStatements("")).toEqual([]);
  });

  it("セクション見出し（◎）や議事メモはスキップする", () => {
    const text = `○議長（鈴木喜一郎君）　開会します。
◎一般質問
○6番（新井　庫君）　質問です。`;

    const statements = parseStatements(text);
    expect(statements).toHaveLength(2);
    expect(statements[0]!.speakerRole).toBe("議長");
    expect(statements[1]!.speakerRole).toBe("議員");
  });
});

describe("parseDateFromPdf", () => {
  it("令和の日付をパースする", () => {
    expect(
      parseDateFromPdf("令和7年12月3日（水曜日）午後1時開会"),
    ).toBe("2025-12-03");
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
      parseDateFromPdf("令和 7 年 12 月 3 日"),
    ).toBe("2025-12-03");
  });
});
