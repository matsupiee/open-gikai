import { describe, it, expect } from "vitest";
import {
  parseSpeaker,
  classifyKind,
  parseStatements,
  extractHeldOnFromPdfText,
} from "./detail";

describe("parseSpeaker", () => {
  it("議長（氏名君）パターンを解析する", () => {
    const result = parseSpeaker("議長（石垣正博君）　ただいまから本日の会議を開きます。");
    expect(result.speakerName).toBe("石垣正博");
    expect(result.speakerRole).toBe("議長");
    expect(result.content).toBe("ただいまから本日の会議を開きます。");
  });

  it("町長（氏名君）パターンを解析する", () => {
    const result = parseSpeaker("町長（佐藤一郎君）　お答えいたします。");
    expect(result.speakerName).toBe("佐藤一郎");
    expect(result.speakerRole).toBe("町長");
    expect(result.content).toBe("お答えいたします。");
  });

  it("番号付き議員パターンを解析する（全角）", () => {
    const result = parseSpeaker("７番（鈴木恵子君）　質問いたします。");
    expect(result.speakerName).toBe("鈴木恵子");
    expect(result.speakerRole).toBe("議員");
    expect(result.content).toBe("質問いたします。");
  });

  it("課長パターンを解析する", () => {
    const result = parseSpeaker("保健福祉課長（小野純一君）　ご説明いたします。");
    expect(result.speakerName).toBe("小野純一");
    expect(result.speakerRole).toBe("課長");
    expect(result.content).toBe("ご説明いたします。");
  });

  it("副議長パターンを解析する", () => {
    const result = parseSpeaker("副議長（田中光君）　発言してください。");
    expect(result.speakerName).toBe("田中光");
    expect(result.speakerRole).toBe("副議長");
    expect(result.content).toBe("発言してください。");
  });

  it("名前に空白を含む場合は除去される", () => {
    const result = parseSpeaker("町長（佐藤　太郎君）　答弁します。");
    expect(result.speakerName).toBe("佐藤太郎");
  });

  it("発言者パターンに合致しないテキスト", () => {
    const result = parseSpeaker("午前１０時０２分　休　憩");
    expect(result.speakerName).toBeNull();
    expect(result.speakerRole).toBeNull();
    expect(result.content).toBe("午前１０時０２分　休　憩");
  });

  it("半角括弧パターンも解析する", () => {
    const result = parseSpeaker("議長(石垣正博君) ただいまから会議を開きます。");
    expect(result.speakerName).toBe("石垣正博");
    expect(result.speakerRole).toBe("議長");
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

  it("保健福祉課長は answer（endsWith）", () => {
    expect(classifyKind("保健福祉課長")).toBe("answer");
  });

  it("議員は question", () => {
    expect(classifyKind("議員")).toBe("question");
  });

  it("null は remark", () => {
    expect(classifyKind(null)).toBe("remark");
  });
});

describe("parseStatements", () => {
  it("発言者パターンでテキストを分割する（改行なし連続テキスト）", () => {
    const text =
      "議長（石垣正博君） ただいまから本日の会議を開きます。 ７番（鈴木恵子君） 質問があります。 町長（佐藤一郎君） お答えします。";
    const statements = parseStatements(text);

    expect(statements).toHaveLength(3);

    expect(statements[0]!.kind).toBe("remark");
    expect(statements[0]!.speakerName).toBe("石垣正博");
    expect(statements[0]!.speakerRole).toBe("議長");
    expect(statements[0]!.content).toBe("ただいまから本日の会議を開きます。");

    expect(statements[1]!.kind).toBe("question");
    expect(statements[1]!.speakerName).toBe("鈴木恵子");
    expect(statements[1]!.speakerRole).toBe("議員");

    expect(statements[2]!.kind).toBe("answer");
    expect(statements[2]!.speakerName).toBe("佐藤一郎");
    expect(statements[2]!.speakerRole).toBe("町長");
  });

  it("各 statement に contentHash が付与される", () => {
    const statements = parseStatements("議長（石垣正博君） テスト発言。");
    expect(statements[0]!.contentHash).toMatch(/^[a-f0-9]{64}$/);
  });

  it("offset が正しく計算される", () => {
    const text = "議長（石垣正博君） ただいま。 ７番（鈴木恵子君） 質問です。";

    const statements = parseStatements(text);

    expect(statements[0]!.startOffset).toBe(0);
    expect(statements[0]!.endOffset).toBe("ただいま。".length);
    expect(statements[1]!.startOffset).toBe("ただいま。".length + 1);
  });

  it("ト書き（角カッコ）を内容から除去する", () => {
    const text =
      "議長（石垣正博君） ただいまから会議を開きます。 ［「なし」と呼ぶ者あり］ ７番（鈴木恵子君） 質問があります。";

    const statements = parseStatements(text);
    expect(statements).toHaveLength(2);
    expect(statements[0]!.speakerRole).toBe("議長");
    expect(statements[0]!.content).toBe("ただいまから会議を開きます。");
    expect(statements[1]!.speakerRole).toBe("議員");
  });

  it("〔〕ト書きも内容から除去する", () => {
    const text =
      "議長（石垣正博君） ただいまから会議を開きます。 〔賛成者起立〕 議長（石垣正博君） 着席ください。";

    const statements = parseStatements(text);
    expect(statements).toHaveLength(2);
    expect(statements[0]!.content).toBe("ただいまから会議を開きます。");
    expect(statements[1]!.content).toBe("着席ください。");
  });

  it("課長パターンを正しく分割する", () => {
    const text =
      "議長（石垣正博君） 保健福祉課長。 保健福祉課長（小野純一君） ご説明いたします。";

    const statements = parseStatements(text);
    expect(statements).toHaveLength(2);
    expect(statements[0]!.speakerRole).toBe("議長");
    expect(statements[1]!.speakerRole).toBe("課長");
    expect(statements[1]!.speakerName).toBe("小野純一");
  });

  it("空テキストは空配列を返す", () => {
    expect(parseStatements("")).toEqual([]);
  });

  it("発言者なしのテキストのみの場合は空配列を返す", () => {
    expect(parseStatements("令和7年第3回大郷町議会定例会")).toEqual([]);
  });
});

describe("extractHeldOnFromPdfText", () => {
  it("令和の日付を抽出する（全角数字）", () => {
    const text = `令和７年１２月５日（金）
令和７年第３回（９月）大郷町議会定例会会議録第３号`;
    expect(extractHeldOnFromPdfText(text)).toBe("2025-12-05");
  });

  it("令和元年を正しく変換する", () => {
    const text = "令和元年6月1日";
    expect(extractHeldOnFromPdfText(text)).toBe("2019-06-01");
  });

  it("平成の日付を抽出する", () => {
    const text = "平成28年2月15日";
    expect(extractHeldOnFromPdfText(text)).toBe("2016-02-15");
  });

  it("日付がない場合は null を返す", () => {
    const text = "会議録テスト";
    expect(extractHeldOnFromPdfText(text)).toBeNull();
  });
});
