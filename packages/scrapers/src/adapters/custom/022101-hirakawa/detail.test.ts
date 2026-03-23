import { describe, expect, it } from "vitest";
import { classifyKind, parseSpeaker, parseStatements } from "./detail";

describe("parseSpeaker", () => {
  it("議長（名前議員）パターンを解析する", () => {
    const result = parseSpeaker(
      "〇議長（石田隆芳議員） これより本日の会議を開きます。"
    );
    expect(result.speakerName).toBe("石田隆芳");
    expect(result.speakerRole).toBe("議長");
    expect(result.content).toBe("これより本日の会議を開きます。");
  });

  it("番号議員パターンを解析する", () => {
    const result = parseSpeaker(
      "〇２番（葛西厚平議員） 質問いたします。"
    );
    expect(result.speakerName).toBe("葛西厚平");
    expect(result.speakerRole).toBe("議員");
    expect(result.content).toBe("質問いたします。");
  });

  it("教育長パターンを解析する（敬称なし）", () => {
    const result = parseSpeaker(
      "〇教育長（須々田孝聖） お答えいたします。"
    );
    expect(result.speakerName).toBe("須々田孝聖");
    expect(result.speakerRole).toBe("教育長");
    expect(result.content).toBe("お答えいたします。");
  });

  it("教育委員会事務局長パターンを解析する", () => {
    const result = parseSpeaker(
      "〇教育委員会事務局長（工藤伸吾） 説明いたします。"
    );
    expect(result.speakerName).toBe("工藤伸吾");
    expect(result.speakerRole).toBe("事務局長");
    expect(result.content).toBe("説明いたします。");
  });

  it("部長パターンを解析する", () => {
    const result = parseSpeaker(
      "〇健康福祉部長（佐藤 崇） お答えいたします。"
    );
    expect(result.speakerName).toBe("佐藤崇");
    expect(result.speakerRole).toBe("部長");
    expect(result.content).toBe("お答えいたします。");
  });

  it("市長職務代理者副市長パターンを解析する", () => {
    const result = parseSpeaker(
      "〇市長職務代理者副市長（古川洋文） お答えいたします。"
    );
    expect(result.speakerName).toBe("古川洋文");
    expect(result.speakerRole).toBe("副市長");
    expect(result.content).toBe("お答えいたします。");
  });

  it("総務部長パターンを解析する", () => {
    const result = parseSpeaker(
      "〇総務部長（對馬一俊） 説明いたします。"
    );
    expect(result.speakerName).toBe("對馬一俊");
    expect(result.speakerRole).toBe("部長");
    expect(result.content).toBe("説明いたします。");
  });

  it("○（U+25CB）マーカーも処理する", () => {
    const result = parseSpeaker(
      "○教育委員会事務局長（工藤伸吾） 説明いたします。"
    );
    expect(result.speakerName).toBe("工藤伸吾");
    expect(result.speakerRole).toBe("事務局長");
    expect(result.content).toBe("説明いたします。");
  });

  it("名前に空白を含む場合は除去される", () => {
    const result = parseSpeaker(
      "〇健康福祉部長（佐藤　崇） 答弁します。"
    );
    expect(result.speakerName).toBe("佐藤崇");
  });

  it("マーカーなしのテキスト", () => {
    const result = parseSpeaker("午前10時00分 開議");
    expect(result.speakerName).toBeNull();
    expect(result.speakerRole).toBeNull();
    expect(result.content).toBe("午前10時00分 開議");
  });

  it("経済部長パターンを解析する", () => {
    const result = parseSpeaker(
      "〇経済部長（田中 純） お答えいたします。"
    );
    expect(result.speakerName).toBe("田中純");
    expect(result.speakerRole).toBe("部長");
    expect(result.content).toBe("お答えいたします。");
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

  it("市長は answer", () => {
    expect(classifyKind("市長")).toBe("answer");
  });

  it("副市長は answer", () => {
    expect(classifyKind("副市長")).toBe("answer");
  });

  it("教育長は answer", () => {
    expect(classifyKind("教育長")).toBe("answer");
  });

  it("部長は answer", () => {
    expect(classifyKind("部長")).toBe("answer");
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
  it("〇 マーカーでテキストを分割する", () => {
    const text = `
〇議長（石田隆芳議員） これより本日の会議を開きます。
〇２番（葛西厚平議員） 質問があります。
〇教育長（須々田孝聖） お答えします。
`;
    const statements = parseStatements(text);

    expect(statements).toHaveLength(3);

    expect(statements[0]!.kind).toBe("remark");
    expect(statements[0]!.speakerName).toBe("石田隆芳");
    expect(statements[0]!.speakerRole).toBe("議長");

    expect(statements[1]!.kind).toBe("question");
    expect(statements[1]!.speakerName).toBe("葛西厚平");
    expect(statements[1]!.speakerRole).toBe("議員");

    expect(statements[2]!.kind).toBe("answer");
    expect(statements[2]!.speakerName).toBe("須々田孝聖");
    expect(statements[2]!.speakerRole).toBe("教育長");
  });

  it("○ と 〇 の混在を処理する", () => {
    const text = `
〇議長（石田隆芳議員） 開きます。
○教育委員会事務局長（工藤伸吾） 説明します。
`;
    const statements = parseStatements(text);

    expect(statements).toHaveLength(2);
    expect(statements[0]!.speakerRole).toBe("議長");
    expect(statements[1]!.speakerRole).toBe("事務局長");
  });

  it("議事日程等の構造行をスキップする", () => {
    const text = `
○議事日程（第２号）令和７年12月４日（木） 第１ 一般質問
○本日の会議に付した事件 議事日程に同じ
○出席議員（16名） １番 水木悟志
〇議長（石田隆芳議員） これより本日の会議を開きます。
`;
    const statements = parseStatements(text);

    expect(statements).toHaveLength(1);
    expect(statements[0]!.speakerRole).toBe("議長");
  });

  it("各 statement に contentHash が付与される", () => {
    const statements = parseStatements(
      "〇議長（石田隆芳議員） テスト発言。"
    );
    expect(statements[0]!.contentHash).toMatch(/^[a-f0-9]{64}$/);
  });

  it("offset が正しく計算される", () => {
    const text = `〇議長（石田隆芳議員） ただいま。
〇２番（葛西厚平議員） 質問です。`;

    const statements = parseStatements(text);

    expect(statements[0]!.startOffset).toBe(0);
    expect(statements[0]!.endOffset).toBe("ただいま。".length);
    expect(statements[1]!.startOffset).toBe("ただいま。".length + 1);
  });

  it("ト書き（移動）はスキップする", () => {
    const text = `〇議長（石田隆芳議員） 質問席へ移動願います。
（葛西厚平議員、質問席へ移動）
〇２番（葛西厚平議員） 質問があります。`;

    const statements = parseStatements(text);
    expect(statements).toHaveLength(2);
    expect(statements[0]!.speakerRole).toBe("議長");
    expect(statements[1]!.speakerRole).toBe("議員");
  });

  it("空テキストは空配列を返す", () => {
    expect(parseStatements("")).toEqual([]);
  });
});
