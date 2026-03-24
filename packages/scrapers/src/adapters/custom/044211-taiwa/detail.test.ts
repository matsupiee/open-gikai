import { describe, it, expect } from "vitest";
import {
  parseSpeaker,
  classifyKind,
  parseStatements,
  extractHeldOnFromPdfText,
} from "./detail";

describe("parseSpeaker", () => {
  it("議長（氏名君）パターンを解析する", () => {
    const result = parseSpeaker("○議長（佐々木義章君）　ただいまから本日の会議を開きます。");
    expect(result.speakerName).toBe("佐々木義章");
    expect(result.speakerRole).toBe("議長");
    expect(result.content).toBe("ただいまから本日の会議を開きます。");
  });

  it("町長（氏名君）パターンを解析する", () => {
    const result = parseSpeaker("○町長（浅野元君）　お答えいたします。");
    expect(result.speakerName).toBe("浅野元");
    expect(result.speakerRole).toBe("町長");
    expect(result.content).toBe("お答えいたします。");
  });

  it("番号付き議員パターンを解析する", () => {
    const result = parseSpeaker("○１番（田中一郎君）　質問いたします。");
    expect(result.speakerName).toBe("田中一郎");
    expect(result.speakerRole).toBe("議員");
    expect(result.content).toBe("質問いたします。");
  });

  it("総務課長パターンを解析する", () => {
    const result = parseSpeaker("○総務課長（鈴木次郎君）　ご説明いたします。");
    expect(result.speakerName).toBe("鈴木次郎");
    expect(result.speakerRole).toBe("課長");
    expect(result.content).toBe("ご説明いたします。");
  });

  it("副議長パターンを解析する", () => {
    const result = parseSpeaker("○副議長（山田花子君）　発言してください。");
    expect(result.speakerName).toBe("山田花子");
    expect(result.speakerRole).toBe("副議長");
    expect(result.content).toBe("発言してください。");
  });

  it("教育長パターンを解析する", () => {
    const result = parseSpeaker("○教育長（高橋三郎君）　説明いたします。");
    expect(result.speakerName).toBe("高橋三郎");
    expect(result.speakerRole).toBe("教育長");
    expect(result.content).toBe("説明いたします。");
  });

  it("名前に空白を含む場合は除去される", () => {
    const result = parseSpeaker("○町長（佐藤　太郎君）　答弁します。");
    expect(result.speakerName).toBe("佐藤太郎");
  });

  it("○ マーカーなしのテキスト", () => {
    const result = parseSpeaker("午前１０時０２分　休　憩");
    expect(result.speakerName).toBeNull();
    expect(result.speakerRole).toBeNull();
    expect(result.content).toBe("午前１０時０２分　休　憩");
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

  it("事務局長は answer", () => {
    expect(classifyKind("事務局長")).toBe("answer");
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
○議長（佐々木義章君）　ただいまから本日の会議を開きます。
○１番（田中一郎君）　質問があります。
○町長（浅野元君）　お答えします。
`;
    const statements = parseStatements(text);

    expect(statements).toHaveLength(3);

    expect(statements[0]!.kind).toBe("remark");
    expect(statements[0]!.speakerName).toBe("佐々木義章");
    expect(statements[0]!.speakerRole).toBe("議長");
    expect(statements[0]!.content).toBe("ただいまから本日の会議を開きます。");

    expect(statements[1]!.kind).toBe("question");
    expect(statements[1]!.speakerName).toBe("田中一郎");
    expect(statements[1]!.speakerRole).toBe("議員");

    expect(statements[2]!.kind).toBe("answer");
    expect(statements[2]!.speakerName).toBe("浅野元");
    expect(statements[2]!.speakerRole).toBe("町長");
  });

  it("各 statement に contentHash が付与される", () => {
    const statements = parseStatements(
      "○議長（佐々木義章君）　テスト発言。"
    );
    expect(statements[0]!.contentHash).toMatch(/^[a-f0-9]{64}$/);
  });

  it("offset が正しく計算される", () => {
    const text = `○議長（佐々木義章君）　ただいま。
○１番（田中一郎君）　質問です。`;

    const statements = parseStatements(text);

    expect(statements[0]!.startOffset).toBe(0);
    expect(statements[0]!.endOffset).toBe("ただいま。".length);
    expect(statements[1]!.startOffset).toBe("ただいま。".length + 1);
  });

  it("ト書き（登壇）はスキップする", () => {
    const text = `○議長（佐々木義章君）　ただいまから会議を開きます。
（１番　田中一郎君登壇）
○１番（田中一郎君）　質問があります。`;

    const statements = parseStatements(text);
    expect(statements).toHaveLength(2);
    expect(statements[0]!.speakerRole).toBe("議長");
    expect(statements[1]!.speakerRole).toBe("議員");
  });

  it("空テキストは空配列を返す", () => {
    expect(parseStatements("")).toEqual([]);
  });
});

describe("extractHeldOnFromPdfText", () => {
  it("令和の日付を抽出する（全角数字）", () => {
    const text = `令和６年１２月２日（月曜日）

第4回大和町議会定例会議会議録`;
    expect(extractHeldOnFromPdfText(text)).toBe("2024-12-02");
  });

  it("令和元年を正しく変換する", () => {
    const text = "令和元年6月1日";
    expect(extractHeldOnFromPdfText(text)).toBe("2019-06-01");
  });

  it("平成の日付を抽出する", () => {
    const text = "平成30年3月5日";
    expect(extractHeldOnFromPdfText(text)).toBe("2018-03-05");
  });

  it("日付がない場合は null を返す", () => {
    const text = "会議録テスト";
    expect(extractHeldOnFromPdfText(text)).toBeNull();
  });
});
