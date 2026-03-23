import { describe, expect, it } from "vitest";
import { parseSpeaker, classifyKind, parseStatements } from "./detail";

describe("parseSpeaker", () => {
  it("議長（姓名+役職）パターンを解析する", () => {
    const result = parseSpeaker(
      "〇小林武雄議長 ただいまから告示第113号をもって招集されました令和６年第４回板倉町議会定例会を開会いたします。"
    );
    expect(result.speakerName).toBe("小林武雄");
    expect(result.speakerRole).toBe("議長");
    expect(result.content).toBe(
      "ただいまから告示第113号をもって招集されました令和６年第４回板倉町議会定例会を開会いたします。"
    );
  });

  it("町長（姓名+役職）パターンを解析する", () => {
    const result = parseSpeaker(
      "〇小野田富康町長 皆さん、おはようございます。"
    );
    expect(result.speakerName).toBe("小野田富康");
    expect(result.speakerRole).toBe("町長");
    expect(result.content).toBe("皆さん、おはようございます。");
  });

  it("議会運営委員長パターンを解析する", () => {
    const result = parseSpeaker(
      "〇延山宗一議会運営委員長 おはようございます。それでは、今定例会の会期についてご報告申し上げます。"
    );
    expect(result.speakerName).toBe("延山宗一");
    expect(result.speakerRole).toBe("議会運営委員長");
    expect(result.content).toBe(
      "おはようございます。それでは、今定例会の会期についてご報告申し上げます。"
    );
  });

  it("課長（姓名+課名+役職）パターンを解析する", () => {
    const result = parseSpeaker(
      "〇玉水美由紀健康介護課長 それでは、まず板倉町国民健康保険条例の一部を改正する条例について説明します。"
    );
    expect(result.speakerName).toBe("玉水美由紀健康介護");
    expect(result.speakerRole).toBe("課長");
    expect(result.content).toBe(
      "それでは、まず板倉町国民健康保険条例の一部を改正する条例について説明します。"
    );
  });

  it("番号付き議員パターンを解析する", () => {
    const result = parseSpeaker(
      "〇８番 荒井英世議員 ８番、荒井です。"
    );
    expect(result.speakerName).toBe("荒井英世");
    expect(result.speakerRole).toBe("議員");
    expect(result.content).toBe("８番、荒井です。");
  });

  it("教育長パターンを解析する", () => {
    const result = parseSpeaker(
      "〇赤坂文弘教育長 お答えいたします。"
    );
    expect(result.speakerName).toBe("赤坂文弘");
    expect(result.speakerRole).toBe("教育長");
    expect(result.content).toBe("お答えいたします。");
  });

  it("副議長パターンを解析する", () => {
    const result = parseSpeaker(
      "〇田中副議長 暫時休憩いたします。"
    );
    expect(result.speakerName).toBe("田中");
    expect(result.speakerRole).toBe("副議長");
    expect(result.content).toBe("暫時休憩いたします。");
  });

  it("〇マーカーなしのテキスト", () => {
    const result = parseSpeaker("開会　（午前 ９時００分）");
    expect(result.speakerName).toBeNull();
    expect(result.speakerRole).toBeNull();
    expect(result.content).toBe("開会　（午前 ９時００分）");
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

  it("議会運営委員長は remark", () => {
    expect(classifyKind("議会運営委員長")).toBe("remark");
  });

  it("町長は answer", () => {
    expect(classifyKind("町長")).toBe("answer");
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
  it("〇マーカーで発言を分割する", () => {
    const text =
      "〇小林武雄議長 ただいまから本日の会議を開きます。\n" +
      "〇小野田富康町長 皆さん、おはようございます。\n" +
      "〇８番 荒井英世議員 ８番、荒井です。質問いたします。";

    const statements = parseStatements(text);

    expect(statements).toHaveLength(3);

    expect(statements[0]!.speakerName).toBe("小林武雄");
    expect(statements[0]!.speakerRole).toBe("議長");
    expect(statements[0]!.kind).toBe("remark");
    expect(statements[0]!.content).toBe("ただいまから本日の会議を開きます。");

    expect(statements[1]!.speakerName).toBe("小野田富康");
    expect(statements[1]!.speakerRole).toBe("町長");
    expect(statements[1]!.kind).toBe("answer");

    expect(statements[2]!.speakerName).toBe("荒井英世");
    expect(statements[2]!.speakerRole).toBe("議員");
    expect(statements[2]!.kind).toBe("question");
  });

  it("各 statement に contentHash が付与される", () => {
    const statements = parseStatements(
      "〇小林武雄議長 ただいまから本日の会議を開きます。"
    );
    expect(statements[0]!.contentHash).toMatch(/^[a-f0-9]{64}$/);
  });

  it("offset が正しく計算される", () => {
    const text =
      "〇小林武雄議長 ただいま。\n〇荒井英世議員 質問です。";

    const statements = parseStatements(text);

    expect(statements[0]!.startOffset).toBe(0);
    expect(statements[0]!.endOffset).toBe("ただいま。".length);
    expect(statements[1]!.startOffset).toBe("ただいま。".length + 1);
  });

  it("ト書き（登壇）はスキップする", () => {
    const text =
      "〇小林武雄議長 ただいまから会議を開きます。\n" +
      "〇（小野田富康町長登壇）\n" +
      "〇小野田富康町長 皆さん、おはようございます。";

    const statements = parseStatements(text);
    expect(statements).toHaveLength(2);
    expect(statements[0]!.speakerRole).toBe("議長");
    expect(statements[1]!.speakerRole).toBe("町長");
  });

  it("空テキストは空配列を返す", () => {
    expect(parseStatements("")).toEqual([]);
  });

  it("内容が短すぎる発言はスキップする", () => {
    const text =
      "〇小林武雄議長 はい。\n" +
      "〇荒井英世議員 それでは質問を始めます。よろしくお願いいたします。";

    const statements = parseStatements(text);
    // 「はい。」（3文字）はスキップされ、長い発言のみ残る
    expect(statements).toHaveLength(1);
    expect(statements[0]!.content).toBe(
      "それでは質問を始めます。よろしくお願いいたします。"
    );
  });

  it("行政側の役職を answer に分類する", () => {
    const text =
      "〇玉水美由紀健康介護課長 それでは説明いたします。\n" +
      "〇橋本貴弘企画財政課長 ご説明いたします。";

    const statements = parseStatements(text);

    expect(statements).toHaveLength(2);
    expect(statements[0]!.kind).toBe("answer");
    expect(statements[0]!.speakerRole).toBe("課長");
    expect(statements[1]!.kind).toBe("answer");
    expect(statements[1]!.speakerRole).toBe("課長");
  });
});
