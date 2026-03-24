import { describe, expect, it } from "vitest";
import { parseSpeaker, classifyKind, parseStatements, parseHeldOn } from "./detail";

describe("parseHeldOn", () => {
  it("令和の日付を YYYY-MM-DD に変換する", () => {
    expect(parseHeldOn("令和6年3月4日（月曜日）開会")).toBe("2024-03-04");
    expect(parseHeldOn("令和7年6月12日")).toBe("2025-06-12");
  });

  it("平成の日付を変換する", () => {
    expect(parseHeldOn("平成30年12月10日開会")).toBe("2018-12-10");
  });

  it("令和元年を変換する", () => {
    expect(parseHeldOn("令和元年9月3日")).toBe("2019-09-03");
  });

  it("全角数字の日付も変換する", () => {
    expect(parseHeldOn("令和６年３月４日")).toBe("2024-03-04");
  });

  it("日付が解析できない場合は null を返す", () => {
    expect(parseHeldOn("会議録")).toBeNull();
    expect(parseHeldOn("")).toBeNull();
    expect(parseHeldOn("3月4日")).toBeNull();
  });
});

describe("parseSpeaker", () => {
  it("議長パターンを解析する（フルネーム+役職）", () => {
    const result = parseSpeaker(
      "入江康仁議長 ただいまから本日の会議を開きます。"
    );
    expect(result.speakerName).toBe("入江康仁");
    expect(result.speakerRole).toBe("議長");
    expect(result.content).toBe("ただいまから本日の会議を開きます。");
  });

  it("町長パターンを解析する", () => {
    const result = parseSpeaker(
      "尾上壽一町長 お答えいたします。"
    );
    expect(result.speakerName).toBe("尾上壽一");
    expect(result.speakerRole).toBe("町長");
    expect(result.content).toBe("お答えいたします。");
  });

  it("副町長パターンを解析する", () => {
    const result = parseSpeaker(
      "中場副町長 ご説明いたします。"
    );
    expect(result.speakerName).toBe("中場");
    expect(result.speakerRole).toBe("副町長");
    expect(result.content).toBe("ご説明いたします。");
  });

  it("教育長パターンを解析する", () => {
    const result = parseSpeaker(
      "中井教育長 お答えいたします。"
    );
    expect(result.speakerName).toBe("中井");
    expect(result.speakerRole).toBe("教育長");
    expect(result.content).toBe("お答えいたします。");
  });

  it("委員長パターンを解析する", () => {
    const result = parseSpeaker(
      "佐藤総務委員長 委員会の審議結果を報告します。"
    );
    expect(result.speakerName).toBe("佐藤総務");
    expect(result.speakerRole).toBe("委員長");
    expect(result.content).toBe("委員会の審議結果を報告します。");
  });

  it("番号付き議員パターンを解析する", () => {
    const result = parseSpeaker(
      "８番 樋口泰生議員 質問いたします。"
    );
    expect(result.speakerName).toBe("樋口泰生");
    expect(result.speakerRole).toBe("議員");
    expect(result.content).toBe("質問いたします。");
  });

  it("課長パターンを解析する", () => {
    const result = parseSpeaker(
      "水谷総務課長 ご説明いたします。"
    );
    expect(result.speakerName).toBe("水谷総務");
    expect(result.speakerRole).toBe("課長");
    expect(result.content).toBe("ご説明いたします。");
  });

  it("事務局長パターンを解析する（局長より先にマッチ）", () => {
    const result = parseSpeaker(
      "上野隆志事務局長 おはようございます。"
    );
    expect(result.speakerName).toBe("上野隆志");
    expect(result.speakerRole).toBe("事務局長");
    expect(result.content).toBe("おはようございます。");
  });

  it("日程番号プレフィックスを除去してパースする", () => {
    const result = parseSpeaker(
      "日程第１ 入江康仁議長 会議録署名議員の指名を行います。"
    );
    expect(result.speakerName).toBe("入江康仁");
    expect(result.speakerRole).toBe("議長");
    expect(result.content).toBe("会議録署名議員の指名を行います。");
  });

  it("役職が不明なテキストは speakerRole=null を返す", () => {
    const result = parseSpeaker("午前１０時００分 開会");
    expect(result.speakerName).toBeNull();
    expect(result.speakerRole).toBeNull();
    expect(result.content).toBe("午前１０時００分 開会");
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

  it("部長は answer", () => {
    expect(classifyKind("部長")).toBe("answer");
  });

  it("課長は answer", () => {
    expect(classifyKind("課長")).toBe("answer");
  });

  it("理事は answer", () => {
    expect(classifyKind("理事")).toBe("answer");
  });

  it("議員は question", () => {
    expect(classifyKind("議員")).toBe("question");
  });

  it("null は remark", () => {
    expect(classifyKind(null)).toBe("remark");
  });
});

describe("parseStatements", () => {
  it("────区切り線でブロックを分割して発言を抽出する", () => {
    const text = [
      "──────────────────────────────────────────",
      "入江康仁議長 ただいまから本日の会議を開きます。",
      "──────────────────────────────────────────",
      "８番 樋口泰生議員 質問があります。",
      "──────────────────────────────────────────",
      "尾上壽一町長 お答えします。",
    ].join("\n");

    const statements = parseStatements(text);

    expect(statements).toHaveLength(3);

    expect(statements[0]!.kind).toBe("remark");
    expect(statements[0]!.speakerName).toBe("入江康仁");
    expect(statements[0]!.speakerRole).toBe("議長");

    expect(statements[1]!.kind).toBe("question");
    expect(statements[1]!.speakerName).toBe("樋口泰生");
    expect(statements[1]!.speakerRole).toBe("議員");

    expect(statements[2]!.kind).toBe("answer");
    expect(statements[2]!.speakerName).toBe("尾上壽一");
    expect(statements[2]!.speakerRole).toBe("町長");
  });

  it("各 statement に contentHash が付与される", () => {
    const text = [
      "──────────────────────────────────────────",
      "入江康仁議長 テスト発言。",
    ].join("\n");
    const statements = parseStatements(text);
    expect(statements[0]!.contentHash).toMatch(/^[a-f0-9]{64}$/);
  });

  it("offset が正しく計算される", () => {
    const text = [
      "──────────────────────────────────────────",
      "入江康仁議長 ただいま。",
      "──────────────────────────────────────────",
      "８番 中村一郎議員 質問です。",
    ].join("\n");

    const statements = parseStatements(text);

    expect(statements[0]!.startOffset).toBe(0);
    expect(statements[0]!.endOffset).toBe("ただいま。".length);
    expect(statements[1]!.startOffset).toBe("ただいま。".length + 1);
  });

  it("日程番号付きブロックも正しくパースする", () => {
    const text = [
      "──────────────────────────────────────────",
      "日程第２ 入江康仁議長 次に、日程第２ 一般質問を行います。",
    ].join("\n");

    const statements = parseStatements(text);
    expect(statements).toHaveLength(1);
    expect(statements[0]!.speakerRole).toBe("議長");
    expect(statements[0]!.content).toBe("次に、日程第２ 一般質問を行います。");
  });

  it("空テキストは空配列を返す", () => {
    expect(parseStatements("")).toEqual([]);
  });

  it("行政側の役職を正しく分類する", () => {
    const text = [
      "──────────────────────────────────────────",
      "水谷総務課長 ご説明いたします。",
      "──────────────────────────────────────────",
      "中場副町長 お答えします。",
      "──────────────────────────────────────────",
      "中井教育長 お答えいたします。",
    ].join("\n");

    const statements = parseStatements(text);

    expect(statements).toHaveLength(3);
    expect(statements[0]!.kind).toBe("answer");
    expect(statements[0]!.speakerRole).toBe("課長");
    expect(statements[1]!.kind).toBe("answer");
    expect(statements[1]!.speakerRole).toBe("副町長");
    expect(statements[2]!.kind).toBe("answer");
    expect(statements[2]!.speakerRole).toBe("教育長");
  });
});
