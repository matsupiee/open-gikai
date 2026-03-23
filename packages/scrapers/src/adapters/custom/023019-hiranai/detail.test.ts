import { describe, expect, it } from "vitest";
import { classifyKind, parseDateFromPdfText, parseSpeaker, parseStatements } from "./detail";

describe("parseSpeaker", () => {
  it("議長（名前君）パターンを解析する", () => {
    const result = parseSpeaker(
      "○議長（工藤 雄次君）　ただいまから会議を開きます。",
    );
    expect(result.speakerName).toBe("工藤雄次");
    expect(result.speakerRole).toBe("議長");
    expect(result.content).toBe("ただいまから会議を開きます。");
  });

  it("町長（名前君）パターンを解析する", () => {
    const result = parseSpeaker(
      "○町長（蛯名 正樹君）　お答えいたします。",
    );
    expect(result.speakerName).toBe("蛯名正樹");
    expect(result.speakerRole).toBe("町長");
    expect(result.content).toBe("お答えいたします。");
  });

  it("副町長パターンを解析する", () => {
    const result = parseSpeaker(
      "○副町長（田中 一郎君）　答弁します。",
    );
    expect(result.speakerName).toBe("田中一郎");
    expect(result.speakerRole).toBe("副町長");
    expect(result.content).toBe("答弁します。");
  });

  it("番号付き議員（○５番（名前君））パターンを解析する", () => {
    const result = parseSpeaker(
      "○５番（山田 太郎君）　質問いたします。",
    );
    expect(result.speakerName).toBe("山田太郎");
    expect(result.speakerRole).toBe("議員");
    expect(result.content).toBe("質問いたします。");
  });

  it("議員（番号 名前君）パターンを解析する", () => {
    const result = parseSpeaker(
      "○議員（８番 安達 幸博君）　質問します。",
    );
    expect(result.speakerName).toBe("安達幸博");
    expect(result.speakerRole).toBe("議員");
    expect(result.content).toBe("質問します。");
  });

  it("課長パターンを解析する", () => {
    const result = parseSpeaker(
      "○総務課長（佐藤 二郎君）　ご説明いたします。",
    );
    expect(result.speakerName).toBe("佐藤二郎");
    expect(result.speakerRole).toBe("課長");
    expect(result.content).toBe("ご説明いたします。");
  });

  it("教育長パターンを解析する", () => {
    const result = parseSpeaker(
      "○教育長（鈴木 花子君）　ご説明いたします。",
    );
    expect(result.speakerName).toBe("鈴木花子");
    expect(result.speakerRole).toBe("教育長");
    expect(result.content).toBe("ご説明いたします。");
  });

  it("名前の空白が除去される", () => {
    const result = parseSpeaker("○町長（蛯名　正樹君）　お答えします。");
    expect(result.speakerName).toBe("蛯名正樹");
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
○議長（工藤 雄次君）　ただいまから本日の会議を開きます。
○５番（山田 太郎君）　質問があります。
○町長（蛯名 正樹君）　お答えします。
`;
    const statements = parseStatements(text);

    expect(statements).toHaveLength(3);

    expect(statements[0]!.kind).toBe("remark");
    expect(statements[0]!.speakerName).toBe("工藤雄次");
    expect(statements[0]!.speakerRole).toBe("議長");

    expect(statements[1]!.kind).toBe("question");
    expect(statements[1]!.speakerName).toBe("山田太郎");
    expect(statements[1]!.speakerRole).toBe("議員");

    expect(statements[2]!.kind).toBe("answer");
    expect(statements[2]!.speakerName).toBe("蛯名正樹");
    expect(statements[2]!.speakerRole).toBe("町長");
  });

  it("各 statement に contentHash が付与される", () => {
    const statements = parseStatements(
      "○議長（工藤 雄次君）　テスト発言。",
    );
    expect(statements[0]!.contentHash).toMatch(/^[a-f0-9]{64}$/);
  });

  it("offset が正しく計算される", () => {
    const text = `○議長（工藤 雄次君）　ただいま。
○５番（山田 太郎君）　質問です。`;

    const statements = parseStatements(text);

    expect(statements[0]!.startOffset).toBe(0);
    expect(statements[0]!.endOffset).toBe("ただいま。".length);
    expect(statements[1]!.startOffset).toBe("ただいま。".length + 1);
  });

  it("ページ番号（－1－）が除去される", () => {
    const text = `○議長（工藤 雄次君）　ただいまから会議を開きます。
－1－
○５番（山田 太郎君）　質問があります。`;

    const statements = parseStatements(text);
    expect(statements).toHaveLength(2);
    expect(statements[0]!.content).not.toContain("－1－");
  });

  it("空テキストは空配列を返す", () => {
    expect(parseStatements("")).toEqual([]);
  });

  it("課長の発言が answer に分類される", () => {
    const text = "○総務課長（佐藤 二郎君）　ご説明いたします。";
    const statements = parseStatements(text);

    expect(statements).toHaveLength(1);
    expect(statements[0]!.kind).toBe("answer");
    expect(statements[0]!.speakerRole).toBe("課長");
  });
});

describe("parseDateFromPdfText", () => {
  it("令和の開催日を抽出する", () => {
    const text =
      "令和６年第１回平内町議会定例会会議録\n令和６年２月20日（月曜日）";
    expect(parseDateFromPdfText(text)).toBe("2024-02-20");
  });

  it("全角数字を含む日付を正しくパースする", () => {
    const text = "令和７年１２月５日（金曜日）";
    expect(parseDateFromPdfText(text)).toBe("2025-12-05");
  });

  it("令和元年をパースする", () => {
    const text = "令和元年９月10日（火曜日）";
    expect(parseDateFromPdfText(text)).toBe("2019-09-10");
  });

  it("日付がない場合は null を返す", () => {
    expect(parseDateFromPdfText("議事日程")).toBeNull();
  });
});
