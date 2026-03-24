import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import { classifyKind, parseSpeaker, parseStatements } from "./detail";

describe("parseSpeaker", () => {
  it("議長パターンを抽出する", () => {
    const result = parseSpeaker(
      "〇議長（鈴木一郎君） ただいまから会議を開きます。",
    );
    expect(result.speakerName).toBe("鈴木一郎");
    expect(result.speakerRole).toBe("議長");
    expect(result.content).toBe("ただいまから会議を開きます。");
  });

  it("町長パターンを抽出する", () => {
    const result = parseSpeaker(
      "〇町長（田中次郎君） お答えいたします。",
    );
    expect(result.speakerName).toBe("田中次郎");
    expect(result.speakerRole).toBe("町長");
    expect(result.content).toBe("お答えいたします。");
  });

  it("副町長パターンを抽出する", () => {
    const result = parseSpeaker(
      "〇副町長（山田花子君） お答えします。",
    );
    expect(result.speakerName).toBe("山田花子");
    expect(result.speakerRole).toBe("副町長");
    expect(result.content).toBe("お答えします。");
  });

  it("番号付き議員パターンを抽出する（全角）", () => {
    const result = parseSpeaker(
      "〇３番（佐藤太郎君） 質問いたします。",
    );
    expect(result.speakerName).toBe("佐藤太郎");
    expect(result.speakerRole).toBe("議員");
    expect(result.content).toBe("質問いたします。");
  });

  it("番号付き議員パターンを抽出する（半角）", () => {
    const result = parseSpeaker(
      "〇10番（高橋一夫君） 質問いたします。",
    );
    expect(result.speakerName).toBe("高橋一夫");
    expect(result.speakerRole).toBe("議員");
    expect(result.content).toBe("質問いたします。");
  });

  it("課長パターンを抽出する", () => {
    const result = parseSpeaker(
      "〇総務課長（佐藤花子君） お答えいたします。",
    );
    expect(result.speakerName).toBe("佐藤花子");
    expect(result.speakerRole).toBe("課長");
    expect(result.content).toBe("お答えいたします。");
  });

  it("教育長パターンを抽出する", () => {
    const result = parseSpeaker(
      "〇教育長（山本次郎君） ご説明いたします。",
    );
    expect(result.speakerName).toBe("山本次郎");
    expect(result.speakerRole).toBe("教育長");
    expect(result.content).toBe("ご説明いたします。");
  });

  it("議会運営委員長パターンを抽出する", () => {
    const result = parseSpeaker(
      "〇議会運営委員長（中村一男君） ご報告申し上げます。",
    );
    expect(result.speakerName).toBe("中村一男");
    expect(result.speakerRole).toBe("議会運営委員長");
    expect(result.content).toBe("ご報告申し上げます。");
  });

  it("特別委員長パターンを抽出する", () => {
    const result = parseSpeaker(
      "〇予算特別委員長（伊藤太郎君） ご報告いたします。",
    );
    expect(result.speakerName).toBe("伊藤太郎");
    expect(result.speakerRole).toBe("特別委員長");
    expect(result.content).toBe("ご報告いたします。");
  });

  it("副委員長パターンを抽出する", () => {
    const result = parseSpeaker(
      "〇副委員長（加藤次郎君） 説明いたします。",
    );
    expect(result.speakerName).toBe("加藤次郎");
    expect(result.speakerRole).toBe("副委員長");
    expect(result.content).toBe("説明いたします。");
  });

  it("参事兼課長パターンを抽出する", () => {
    const result = parseSpeaker(
      "〇参事兼住民課長（木村三郎君） お答えいたします。",
    );
    expect(result.speakerName).toBe("木村三郎");
    expect(result.speakerRole).toBe("課長");
    expect(result.content).toBe("お答えいたします。");
  });

  it("議会事務局長パターンを抽出する", () => {
    const result = parseSpeaker(
      "〇議会事務局長（斎藤一郎君） ご報告します。",
    );
    expect(result.speakerName).toBe("斎藤一郎");
    expect(result.speakerRole).toBe("議会事務局長");
    expect(result.content).toBe("ご報告します。");
  });

  it("〇マーカーなしのパターンも対応する", () => {
    const result = parseSpeaker(
      "議長（鈴木一郎君） ただいまから会議を開きます。",
    );
    expect(result.speakerName).toBe("鈴木一郎");
    expect(result.speakerRole).toBe("議長");
    expect(result.content).toBe("ただいまから会議を開きます。");
  });

  it("パターンにマッチしない場合はnullを返す", () => {
    const result = parseSpeaker("これは通常のテキストです。");
    expect(result.speakerName).toBeNull();
    expect(result.speakerRole).toBeNull();
    expect(result.content).toBe("これは通常のテキストです。");
  });
});

describe("classifyKind", () => {
  it("議長はremarkに分類する", () => {
    expect(classifyKind("議長")).toBe("remark");
  });

  it("副議長はremarkに分類する", () => {
    expect(classifyKind("副議長")).toBe("remark");
  });

  it("委員長はremarkに分類する", () => {
    expect(classifyKind("委員長")).toBe("remark");
  });

  it("副委員長はremarkに分類する", () => {
    expect(classifyKind("副委員長")).toBe("remark");
  });

  it("議会運営委員長はremarkに分類する", () => {
    expect(classifyKind("議会運営委員長")).toBe("remark");
  });

  it("特別委員長はremarkに分類する", () => {
    expect(classifyKind("特別委員長")).toBe("remark");
  });

  it("町長はanswerに分類する", () => {
    expect(classifyKind("町長")).toBe("answer");
  });

  it("副町長はanswerに分類する", () => {
    expect(classifyKind("副町長")).toBe("answer");
  });

  it("課長はanswerに分類する", () => {
    expect(classifyKind("課長")).toBe("answer");
  });

  it("教育長はanswerに分類する", () => {
    expect(classifyKind("教育長")).toBe("answer");
  });

  it("議会事務局長はanswerに分類する", () => {
    expect(classifyKind("議会事務局長")).toBe("answer");
  });

  it("会計管理者はanswerに分類する", () => {
    expect(classifyKind("会計管理者")).toBe("answer");
  });

  it("議員はquestionに分類する", () => {
    expect(classifyKind("議員")).toBe("question");
  });

  it("nullはremarkに分類する", () => {
    expect(classifyKind(null)).toBe("remark");
  });
});

describe("parseStatements", () => {
  it("〇マーカーで発言を分割してParsedStatement配列を生成する", () => {
    const text = [
      "〇議長（鈴木一郎君） ただいまから会議を開きます。",
      "〇3番（佐藤太郎君） 質問いたします。",
      "〇町長（田中次郎君） お答えいたします。",
    ].join("\n");

    const result = parseStatements(text);

    expect(result).toHaveLength(3);
    expect(result[0]!.kind).toBe("remark");
    expect(result[0]!.speakerName).toBe("鈴木一郎");
    expect(result[0]!.speakerRole).toBe("議長");
    expect(result[0]!.content).toBe("ただいまから会議を開きます。");
    expect(result[0]!.contentHash).toBe(
      createHash("sha256")
        .update("ただいまから会議を開きます。")
        .digest("hex"),
    );

    expect(result[1]!.kind).toBe("question");
    expect(result[1]!.speakerName).toBe("佐藤太郎");
    expect(result[1]!.speakerRole).toBe("議員");

    expect(result[2]!.kind).toBe("answer");
    expect(result[2]!.speakerName).toBe("田中次郎");
    expect(result[2]!.speakerRole).toBe("町長");
  });

  it("課長の発言も正しく抽出する", () => {
    const text = [
      "〇議長（鈴木一郎君） 答弁を求めます。",
      "〇総務課長（佐藤花子君） お答えいたします。内容は以下のとおりです。",
    ].join("\n");

    const result = parseStatements(text);

    expect(result).toHaveLength(2);
    expect(result[1]!.kind).toBe("answer");
    expect(result[1]!.speakerName).toBe("佐藤花子");
    expect(result[1]!.speakerRole).toBe("課長");
  });

  it("全角数字の番号付き議員も抽出する", () => {
    const text = "〇３番（山田花子君） 質問いたします。〇議長（鈴木一郎君） ありがとうございます。";

    const result = parseStatements(text);

    expect(result).toHaveLength(2);
    expect(result[0]!.speakerRole).toBe("議員");
    expect(result[0]!.speakerName).toBe("山田花子");
  });

  it("空テキストでは空配列を返す", () => {
    expect(parseStatements("")).toEqual([]);
  });

  it("発言者パターンがないテキストでは空配列を返す", () => {
    expect(parseStatements("ただの説明テキストです。")).toEqual([]);
  });

  it("startOffset / endOffset が連続している", () => {
    const text = [
      "〇議長（鈴木一郎君） 開会します。",
      "〇町長（田中次郎君） 答弁します。",
    ].join("\n");

    const result = parseStatements(text);
    expect(result).toHaveLength(2);
    expect(result[0]!.startOffset).toBe(0);
    expect(result[0]!.endOffset).toBe("開会します。".length);
    expect(result[1]!.startOffset).toBe(result[0]!.endOffset + 1);
  });
});
