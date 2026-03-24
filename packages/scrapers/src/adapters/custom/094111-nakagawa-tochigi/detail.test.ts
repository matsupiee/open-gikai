import { describe, it, expect } from "vitest";
import {
  parseSpeaker,
  classifyKind,
  parseStatements,
  extractHeldOnFromPdfText,
} from "./detail";

describe("parseSpeaker", () => {
  it("議長（名前君）パターンを解析する", () => {
    const result = parseSpeaker(
      "○議長（矢後紀夫君）　ただいまから本日の会議を開きます。"
    );
    expect(result.speakerName).toBe("矢後紀夫");
    expect(result.speakerRole).toBe("議長");
    expect(result.content).toBe("ただいまから本日の会議を開きます。");
  });

  it("町長（名前君）パターンを解析する", () => {
    const result = parseSpeaker(
      "○町長（大澤良治君）　お答えいたします。"
    );
    expect(result.speakerName).toBe("大澤良治");
    expect(result.speakerRole).toBe("町長");
    expect(result.content).toBe("お答えいたします。");
  });

  it("副町長パターンを解析する", () => {
    const result = parseSpeaker(
      "○副町長（山本一郎君）　ご報告いたします。"
    );
    expect(result.speakerName).toBe("山本一郎");
    expect(result.speakerRole).toBe("副町長");
    expect(result.content).toBe("ご報告いたします。");
  });

  it("教育長パターンを解析する", () => {
    const result = parseSpeaker(
      "○教育長（鈴木次郎君）　お答えいたします。"
    );
    expect(result.speakerName).toBe("鈴木次郎");
    expect(result.speakerRole).toBe("教育長");
    expect(result.content).toBe("お答えいたします。");
  });

  it("番号付き議員パターンを解析する（全角数字）", () => {
    const result = parseSpeaker(
      "○３番（鈴木太郎君）　質問いたします。"
    );
    expect(result.speakerName).toBe("鈴木太郎");
    expect(result.speakerRole).toBe("議員");
    expect(result.content).toBe("質問いたします。");
  });

  it("番号付き議員パターンを解析する（半角数字）", () => {
    const result = parseSpeaker(
      "○3番（田中太郎君）　動議を提出します。"
    );
    expect(result.speakerName).toBe("田中太郎");
    expect(result.speakerRole).toBe("議員");
    expect(result.content).toBe("動議を提出します。");
  });

  it("課長パターンを解析する", () => {
    const result = parseSpeaker(
      "○総務課長（佐藤一郎君）　ご説明いたします。"
    );
    expect(result.speakerName).toBe("佐藤一郎");
    expect(result.speakerRole).toBe("課長");
    expect(result.content).toBe("ご説明いたします。");
  });

  it("委員長パターンを解析する", () => {
    const result = parseSpeaker(
      "○議会運営委員長（磯　稲藏君）　報告いたします。"
    );
    expect(result.speakerName).toBe("磯稲藏");
    expect(result.speakerRole).toBe("委員長");
    expect(result.content).toBe("報告いたします。");
  });

  it("名前に全角スペースを含む場合は除去される", () => {
    const result = parseSpeaker(
      "○町長（大澤　良治君）　答弁します。"
    );
    expect(result.speakerName).toBe("大澤良治");
  });

  it("○ マーカーなしのテキスト", () => {
    const result = parseSpeaker("午前　９時００分");
    expect(result.speakerName).toBeNull();
    expect(result.speakerRole).toBeNull();
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

  it("総務課長など複合役職も answer", () => {
    expect(classifyKind("総務課長")).toBe("answer");
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
○議長（矢後紀夫君）　ただいまから本日の会議を開きます。
○３番（鈴木太郎君）　質問があります。
○町長（大澤良治君）　お答えします。
`;
    const statements = parseStatements(text);

    expect(statements).toHaveLength(3);

    expect(statements[0]!.kind).toBe("remark");
    expect(statements[0]!.speakerName).toBe("矢後紀夫");
    expect(statements[0]!.speakerRole).toBe("議長");
    expect(statements[0]!.content).toBe("ただいまから本日の会議を開きます。");

    expect(statements[1]!.kind).toBe("question");
    expect(statements[1]!.speakerName).toBe("鈴木太郎");
    expect(statements[1]!.speakerRole).toBe("議員");

    expect(statements[2]!.kind).toBe("answer");
    expect(statements[2]!.speakerName).toBe("大澤良治");
    expect(statements[2]!.speakerRole).toBe("町長");
  });

  it("各 statement に contentHash が付与される", () => {
    const statements = parseStatements(
      "○議長（矢後紀夫君）　テスト発言。"
    );
    expect(statements[0]!.contentHash).toMatch(/^[a-f0-9]{64}$/);
  });

  it("offset が正しく計算される", () => {
    const text = `○議長（矢後紀夫君）　ただいま。
○３番（鈴木太郎君）　質問です。`;

    const statements = parseStatements(text);

    expect(statements[0]!.startOffset).toBe(0);
    expect(statements[0]!.endOffset).toBe("ただいま。".length);
    expect(statements[1]!.startOffset).toBe("ただいま。".length + 1);
  });

  it("ト書き（登壇）はスキップする", () => {
    const text = `○議長（矢後紀夫君）　ただいまから会議を開きます。
○（大澤良治君登壇）
○３番（鈴木太郎君）　質問があります。`;

    const statements = parseStatements(text);
    // ト書きはスキップされる
    expect(statements.length).toBeGreaterThanOrEqual(2);
  });

  it("空テキストは空配列を返す", () => {
    expect(parseStatements("")).toEqual([]);
  });
});

describe("extractHeldOnFromPdfText", () => {
  it("「期　日」に続く和暦日付を抽出する", () => {
    const text = `
那珂川町告示第12号
１．期　日　令和6年12月3日
２．場　所　那珂川町議会議事堂
`;
    expect(extractHeldOnFromPdfText(text)).toBe("2024-12-03");
  });

  it("「期日」（スペースなし）に続く和暦日付を抽出する", () => {
    const text = `
１．期日　令和6年9月10日
２．場所　那珂川町議会議事堂
`;
    expect(extractHeldOnFromPdfText(text)).toBe("2024-09-10");
  });

  it("議事日程行から日付を抽出する", () => {
    const text = `
議事日程（第1号）
令和6年12月3日（火）午前10時00分開会
`;
    expect(extractHeldOnFromPdfText(text)).toBe("2024-12-03");
  });

  it("令和元年を正しく変換する", () => {
    const text = `
１．期　日　令和元年6月10日
`;
    expect(extractHeldOnFromPdfText(text)).toBe("2019-06-10");
  });

  it("平成年号を正しく変換する", () => {
    const text = `
１．期　日　平成21年3月4日
`;
    expect(extractHeldOnFromPdfText(text)).toBe("2009-03-04");
  });

  it("全角数字を含む日付も処理する", () => {
    const text = `
１．期　日　令和６年１２月３日
`;
    expect(extractHeldOnFromPdfText(text)).toBe("2024-12-03");
  });

  it("日付が見つからない場合は null を返す", () => {
    const text = `議事録の内容のみで日付情報なし`;
    expect(extractHeldOnFromPdfText(text)).toBeNull();
  });

  it("フォールバックで冒頭の和暦日付を抽出する", () => {
    const text = `令和6年6月4日（火曜日）
那珂川町議会定例会会議録`;
    expect(extractHeldOnFromPdfText(text)).toBe("2024-06-04");
  });
});
