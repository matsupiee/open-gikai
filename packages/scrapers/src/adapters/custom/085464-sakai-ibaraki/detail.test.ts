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
      "○議長（倉持　功君）　それでは、ただいまから会議を開きます。",
    );
    expect(result.speakerName).toBe("倉持功");
    expect(result.speakerRole).toBe("議長");
    expect(result.content).toBe("それでは、ただいまから会議を開きます。");
  });

  it("町長（名前君）パターンを解析する", () => {
    const result = parseSpeaker("○町長（橋本正裕君）　お答えいたします。");
    expect(result.speakerName).toBe("橋本正裕");
    expect(result.speakerRole).toBe("町長");
    expect(result.content).toBe("お答えいたします。");
  });

  it("全角番号議員パターンを解析する", () => {
    const result = parseSpeaker("○３番（枝　史子君）　質問いたします。");
    expect(result.speakerName).toBe("枝史子");
    expect(result.speakerRole).toBe("議員");
    expect(result.content).toBe("質問いたします。");
  });

  it("半角番号議員パターンを解析する", () => {
    const result = parseSpeaker("○5番（田中　一郎君）　質問いたします。");
    expect(result.speakerName).toBe("田中一郎");
    expect(result.speakerRole).toBe("議員");
    expect(result.content).toBe("質問いたします。");
  });

  it("教育長パターンを解析する", () => {
    const result = parseSpeaker("○教育長（山田花子君）　お答えいたします。");
    expect(result.speakerName).toBe("山田花子");
    expect(result.speakerRole).toBe("教育長");
    expect(result.content).toBe("お答えいたします。");
  });

  it("副町長パターンを解析する", () => {
    const result = parseSpeaker("○副町長（鈴木次郎君）　ご報告いたします。");
    expect(result.speakerName).toBe("鈴木次郎");
    expect(result.speakerRole).toBe("副町長");
    expect(result.content).toBe("ご報告いたします。");
  });

  it("課長パターンを解析する", () => {
    const result = parseSpeaker(
      "○建設課長（高橋三郎君）　ご説明いたします。",
    );
    expect(result.speakerName).toBe("高橋三郎");
    expect(result.speakerRole).toBe("課長");
    expect(result.content).toBe("ご説明いたします。");
  });

  it("名前に空白を含む場合は除去される", () => {
    const result = parseSpeaker("○町長（橋本　正裕君）　答弁します。");
    expect(result.speakerName).toBe("橋本正裕");
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

  it("部長は answer", () => {
    expect(classifyKind("部長")).toBe("answer");
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
○議長（倉持　功君）　ただいまから本日の会議を開きます。
○３番（枝　史子君）　質問があります。
○町長（橋本正裕君）　お答えします。
`;
    const statements = parseStatements(text);

    expect(statements).toHaveLength(3);

    expect(statements[0]!.kind).toBe("remark");
    expect(statements[0]!.speakerName).toBe("倉持功");
    expect(statements[0]!.speakerRole).toBe("議長");

    expect(statements[1]!.kind).toBe("question");
    expect(statements[1]!.speakerName).toBe("枝史子");
    expect(statements[1]!.speakerRole).toBe("議員");

    expect(statements[2]!.kind).toBe("answer");
    expect(statements[2]!.speakerName).toBe("橋本正裕");
    expect(statements[2]!.speakerRole).toBe("町長");
  });

  it("各 statement に contentHash が付与される", () => {
    const statements = parseStatements(
      "○議長（倉持　功君）　テスト発言。",
    );
    expect(statements[0]!.contentHash).toMatch(/^[a-f0-9]{64}$/);
  });

  it("offset が正しく計算される", () => {
    const text = `○議長（倉持　功君）　ただいま。
○３番（枝　史子君）　質問です。`;

    const statements = parseStatements(text);

    expect(statements[0]!.startOffset).toBe(0);
    expect(statements[0]!.endOffset).toBe("ただいま。".length);
    expect(statements[1]!.startOffset).toBe("ただいま。".length + 1);
  });

  it("空テキストは空配列を返す", () => {
    expect(parseStatements("")).toEqual([]);
  });

  it("議場注記 ［ ］ を除去してパースする", () => {
    const text = `○３番（枝　史子君）　質問します。［「そうですね」と言う者あり］続けます。
○町長（橋本正裕君）　お答えします。`;

    const statements = parseStatements(text);
    expect(statements).toHaveLength(2);
    expect(statements[0]!.content).not.toContain("「そうですね」");
  });

  it("登壇の注記付きブロックをスキップする", () => {
    const text = `○議長（倉持　功君）　開会します。
○（橋本正裕君登壇）
○町長（橋本正裕君）　お答えします。`;

    const statements = parseStatements(text);
    // 登壇行はスキップされる
    const hasLoginNote = statements.some((s) => s.content.includes("登壇"));
    expect(hasLoginNote).toBe(false);
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
      parseDateFromPdf("平成30年3月5日（月曜日）午前10時開会"),
    ).toBe("2018-03-05");
  });

  it("日付がない場合は null を返す", () => {
    expect(parseDateFromPdf("議事日程")).toBeNull();
  });

  it("全角数字を含む日付をパースする", () => {
    expect(
      parseDateFromPdf("令和７年１２月３日（水曜日）"),
    ).toBe("2025-12-03");
  });
});
