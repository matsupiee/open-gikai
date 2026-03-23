import { describe, expect, it } from "vitest";
import {
  classifyKind,
  parseDateFromText,
  parseSpeaker,
  parseStatements,
} from "./detail";

describe("parseSpeaker", () => {
  it("議長（名前君）パターンを解析する", () => {
    const result = parseSpeaker("議長（山田太郎君）　ただいまから会議を開きます。");

    expect(result.speakerName).toBe("山田太郎");
    expect(result.speakerRole).toBe("議長");
    expect(result.content).toBe("ただいまから会議を開きます。");
  });

  it("町長（名前君）パターンを解析する", () => {
    const result = parseSpeaker("町長（鈴木一郎君）　お答えいたします。");

    expect(result.speakerName).toBe("鈴木一郎");
    expect(result.speakerRole).toBe("町長");
    expect(result.content).toBe("お答えいたします。");
  });

  it("副町長パターンを解析する", () => {
    const result = parseSpeaker("副町長（田中次郎君）　ご説明いたします。");

    expect(result.speakerName).toBe("田中次郎");
    expect(result.speakerRole).toBe("副町長");
    expect(result.content).toBe("ご説明いたします。");
  });

  it("番号付き議員パターンを解析する", () => {
    const result = parseSpeaker("３番（佐藤三郎君）　質問いたします。");

    expect(result.speakerName).toBe("佐藤三郎");
    expect(result.speakerRole).toBe("議員");
    expect(result.content).toBe("質問いたします。");
  });

  it("課長パターンを解析する", () => {
    const result = parseSpeaker("総務課長（伊藤四郎君）　ご報告いたします。");

    expect(result.speakerName).toBe("伊藤四郎");
    expect(result.speakerRole).toBe("課長");
    expect(result.content).toBe("ご報告いたします。");
  });

  it("教育長パターンを解析する", () => {
    const result = parseSpeaker("教育長（渡辺五郎君）　説明します。");

    expect(result.speakerName).toBe("渡辺五郎");
    expect(result.speakerRole).toBe("教育長");
    expect(result.content).toBe("説明します。");
  });

  it("事務局長パターンを解析する", () => {
    const result = parseSpeaker("事務局長（中村六郎君）　報告いたします。");

    expect(result.speakerName).toBe("中村六郎");
    expect(result.speakerRole).toBe("事務局長");
    expect(result.content).toBe("報告いたします。");
  });

  it("名前に空白を含む場合は除去される", () => {
    const result = parseSpeaker("町長（鈴 木 一 郎君）　答弁します。");

    expect(result.speakerName).toBe("鈴木一郎");
  });

  it("発言者パターンなしのテキスト", () => {
    const result = parseSpeaker("午前10時00分開議");

    expect(result.speakerName).toBeNull();
    expect(result.speakerRole).toBeNull();
    expect(result.content).toBe("午前10時00分開議");
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

describe("parseDateFromText", () => {
  it("令和の日付をパースする", () => {
    expect(parseDateFromText("令和6年9月10日")).toBe("2024-09-10");
  });

  it("令和元年をパースする", () => {
    expect(parseDateFromText("令和元年6月10日")).toBe("2019-06-10");
  });

  it("平成の日付をパースする", () => {
    expect(parseDateFromText("平成30年3月5日")).toBe("2018-03-05");
  });

  it("全角数字の日付をパースする", () => {
    expect(parseDateFromText("令和６年９月１０日")).toBe("2024-09-10");
  });

  it("日付がない場合は null を返す", () => {
    expect(parseDateFromText("川辺町議会")).toBeNull();
  });
});

describe("parseStatements", () => {
  it("連続テキストから発言者パターンで分割する", () => {
    const text =
      "議長（山田太郎君） ただいまから本日の会議を開きます。" +
      "３番（佐藤三郎君） 質問があります。" +
      "町長（鈴木一郎君） お答えします。";
    const statements = parseStatements(text);

    expect(statements).toHaveLength(3);

    expect(statements[0]!.kind).toBe("remark");
    expect(statements[0]!.speakerName).toBe("山田太郎");
    expect(statements[0]!.speakerRole).toBe("議長");

    expect(statements[1]!.kind).toBe("question");
    expect(statements[1]!.speakerName).toBe("佐藤三郎");
    expect(statements[1]!.speakerRole).toBe("議員");

    expect(statements[2]!.kind).toBe("answer");
    expect(statements[2]!.speakerName).toBe("鈴木一郎");
    expect(statements[2]!.speakerRole).toBe("町長");
  });

  it("スペース区切りテキストを正規化して分割する", () => {
    const text =
      "議 長 （ 山 田 太 郎 君 ）  ただいまから会議を開きます。 " +
      "町 長 （ 鈴 木 一 郎 君 ）  お答えします。";
    const statements = parseStatements(text);

    expect(statements).toHaveLength(2);
    expect(statements[0]!.speakerName).toBe("山田太郎");
    expect(statements[0]!.speakerRole).toBe("議長");
    expect(statements[1]!.speakerName).toBe("鈴木一郎");
    expect(statements[1]!.speakerRole).toBe("町長");
  });

  it("各 statement に contentHash が付与される", () => {
    const text = "議長（山田太郎君）　テスト発言。";
    const statements = parseStatements(text);

    expect(statements[0]!.contentHash).toMatch(/^[a-f0-9]{64}$/);
  });

  it("offset が正しく計算される", () => {
    const text =
      "議長（山田太郎君） ただいま。" +
      "３番（佐藤三郎君） 質問です。";

    const statements = parseStatements(text);

    expect(statements[0]!.startOffset).toBe(0);
    expect(statements[0]!.endOffset).toBe("ただいま。".length);
    expect(statements[1]!.startOffset).toBe("ただいま。".length + 1);
  });

  it("登壇表記を除去して発言内容を取得する", () => {
    const text =
      "議長（山田太郎君） 報告を求めます。" +
      "総務課長（伊藤四郎君）（報告のため登壇） ご説明させていただきます。" +
      "議長（山田太郎君） ありがとうございました。";
    const statements = parseStatements(text);

    const chief = statements.find((s) => s.speakerRole === "課長");
    expect(chief).toBeDefined();
    expect(chief!.content).toBe("ご説明させていただきます。");
  });

  it("空テキストは空配列を返す", () => {
    expect(parseStatements("")).toEqual([]);
  });

  it("発言者パターンを含まないテキストは空配列を返す", () => {
    const text = "川辺町議会第３回定例会会議録 招集年月日 令和６年９月１０日";

    expect(parseStatements(text)).toEqual([]);
  });
});
