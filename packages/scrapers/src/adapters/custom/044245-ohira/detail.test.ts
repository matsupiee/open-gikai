import { describe, it, expect } from "vitest";
import { parseSpeaker, classifyKind, parseStatements, extractHeldOnFromPdfText } from "./detail";

describe("parseSpeaker", () => {
  it("議長（氏名君）パターンを解析する", () => {
    const result = parseSpeaker("議長（髙橋浩之君）　ただいまから本日の会議を開きます。");
    expect(result.speakerName).toBe("髙橋浩之");
    expect(result.speakerRole).toBe("議長");
    expect(result.content).toBe("ただいまから本日の会議を開きます。");
  });

  it("村長（氏名君）パターンを解析する", () => {
    const result = parseSpeaker("村長（小川ひろみ君）　お答えいたします。");
    expect(result.speakerName).toBe("小川ひろみ");
    expect(result.speakerRole).toBe("村長");
    expect(result.content).toBe("お答えいたします。");
  });

  it("番号付き議員パターンを解析する", () => {
    const result = parseSpeaker("10番（佐々木金彌君）　質問いたします。");
    expect(result.speakerName).toBe("佐々木金彌");
    expect(result.speakerRole).toBe("議員");
    expect(result.content).toBe("質問いたします。");
  });

  it("課長パターンを解析する", () => {
    const result = parseSpeaker("税務課長（堀籠淳君）　ご説明いたします。");
    expect(result.speakerName).toBe("堀籠淳");
    expect(result.speakerRole).toBe("課長");
    expect(result.content).toBe("ご説明いたします。");
  });

  it("副村長パターンを解析する", () => {
    const result = parseSpeaker("副村長（山田太郎君）　答弁します。");
    expect(result.speakerName).toBe("山田太郎");
    expect(result.speakerRole).toBe("副村長");
    expect(result.content).toBe("答弁します。");
  });

  it("全角番号の議員パターンを解析する", () => {
    const result = parseSpeaker("１番（田中一郎君）　質問します。");
    expect(result.speakerName).toBe("田中一郎");
    expect(result.speakerRole).toBe("議員");
    expect(result.content).toBe("質問します。");
  });

  it("名前に空白を含む場合は除去される", () => {
    const result = parseSpeaker("村長（佐藤　太郎君）　答弁します。");
    expect(result.speakerName).toBe("佐藤太郎");
  });

  it("発言者パターンに合致しないテキスト", () => {
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

  it("事務局長は answer", () => {
    expect(classifyKind("事務局長")).toBe("answer");
  });

  it("議員は question", () => {
    expect(classifyKind("議員")).toBe("question");
  });

  it("null は remark", () => {
    expect(classifyKind(null)).toBe("remark");
  });
});

describe("parseStatements", () => {
  it("発言者パターンでテキストを分割する", () => {
    const text = `議長（髙橋浩之君）　ただいまから本日の会議を開きます。
10番（佐々木金彌君）　質問があります。
村長（小川ひろみ君）　お答えします。
`;
    const statements = parseStatements(text);

    expect(statements).toHaveLength(3);

    expect(statements[0]!.kind).toBe("remark");
    expect(statements[0]!.speakerName).toBe("髙橋浩之");
    expect(statements[0]!.speakerRole).toBe("議長");
    expect(statements[0]!.content).toBe("ただいまから本日の会議を開きます。");

    expect(statements[1]!.kind).toBe("question");
    expect(statements[1]!.speakerName).toBe("佐々木金彌");
    expect(statements[1]!.speakerRole).toBe("議員");

    expect(statements[2]!.kind).toBe("answer");
    expect(statements[2]!.speakerName).toBe("小川ひろみ");
    expect(statements[2]!.speakerRole).toBe("村長");
  });

  it("複数行にわたる発言内容を結合する", () => {
    const text = `議長（髙橋浩之君）　ただいまから
本日の会議を開きます。
10番（佐々木金彌君）　質問します。`;

    const statements = parseStatements(text);
    expect(statements).toHaveLength(2);
    expect(statements[0]!.content).toBe("ただいまから 本日の会議を開きます。");
  });

  it("各 statement に contentHash が付与される", () => {
    const statements = parseStatements(
      "議長（髙橋浩之君）　テスト発言。"
    );
    expect(statements[0]!.contentHash).toMatch(/^[a-f0-9]{64}$/);
  });

  it("ト書き（登壇）はスキップする", () => {
    const text = `議長（髙橋浩之君）　ただいまから会議を開きます。
（1番　佐々木金彌君登壇）
10番（佐々木金彌君）　質問があります。`;

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
    const text = `令和６年２月５日（月曜日）　午前１１時００分開議

令和６年第１回大衡村議会臨時会会議録　第１号`;
    expect(extractHeldOnFromPdfText(text)).toBe("2024-02-05");
  });

  it("令和元年を正しく変換する", () => {
    const text = "令和元年6月1日";
    expect(extractHeldOnFromPdfText(text)).toBe("2019-06-01");
  });

  it("平成の日付を抽出する", () => {
    const text = "平成30年3月5日（月曜日）午前10時開議";
    expect(extractHeldOnFromPdfText(text)).toBe("2018-03-05");
  });

  it("日付がない場合は null を返す", () => {
    const text = "大衡村議会会議録";
    expect(extractHeldOnFromPdfText(text)).toBeNull();
  });
});
