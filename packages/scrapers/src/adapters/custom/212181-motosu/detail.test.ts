import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import { extractHeldOnFromText } from "./shared";
import { classifyKind, parseSpeaker, parseStatements } from "./detail";

describe("extractHeldOnFromText", () => {
  it("令和の日付を変換する", () => {
    expect(extractHeldOnFromText("令和6年11月25日（月曜日）午前9時 開議")).toBe(
      "2024-11-25",
    );
  });

  it("全角数字の令和日付を変換する", () => {
    expect(extractHeldOnFromText("令和６年１１月２５日")).toBe("2024-11-25");
  });

  it("令和元年に対応する", () => {
    expect(extractHeldOnFromText("令和元年6月10日")).toBe("2019-06-10");
  });

  it("平成の日付を変換する", () => {
    expect(extractHeldOnFromText("平成30年12月10日")).toBe("2018-12-10");
  });

  it("平成元年に対応する", () => {
    expect(extractHeldOnFromText("平成元年3月15日")).toBe("1989-03-15");
  });

  it("マッチしない場合はnullを返す", () => {
    expect(extractHeldOnFromText("2024年3月1日")).toBeNull();
  });
});

describe("parseSpeaker", () => {
  it("○議長パターンを抽出する", () => {
    const result = parseSpeaker(
      "○議長（大西德三郎君） ただいまから会議を開きます。",
    );
    expect(result.speakerName).toBe("大西德三郎");
    expect(result.speakerRole).toBe("議長");
    expect(result.content).toBe("ただいまから会議を開きます。");
  });

  it("○市長パターンを抽出する", () => {
    const result = parseSpeaker(
      "○市長（藤原 勉君） お答えいたします。",
    );
    expect(result.speakerName).toBe("藤原勉");
    expect(result.speakerRole).toBe("市長");
    expect(result.content).toBe("お答えいたします。");
  });

  it("○番号付き議員パターンを抽出する（全角）", () => {
    const result = parseSpeaker(
      "○１０番（今枝和子君） 質問いたします。",
    );
    expect(result.speakerName).toBe("今枝和子");
    expect(result.speakerRole).toBe("議員");
    expect(result.content).toBe("質問いたします。");
  });

  it("○さん敬称パターンを抽出する", () => {
    const result = parseSpeaker(
      "○５番（山田花子さん） 質問します。",
    );
    expect(result.speakerName).toBe("山田花子");
    expect(result.speakerRole).toBe("議員");
    expect(result.content).toBe("質問します。");
  });

  it("○副市長パターンを抽出する", () => {
    const result = parseSpeaker(
      "○副市長（谷口博文君） お答えいたします。",
    );
    expect(result.speakerName).toBe("谷口博文");
    expect(result.speakerRole).toBe("副市長");
    expect(result.content).toBe("お答えいたします。");
  });

  it("○総務部長パターンを抽出する", () => {
    const result = parseSpeaker(
      "○総務部長（村澤 勲君） お答えいたします。",
    );
    expect(result.speakerName).toBe("村澤勲");
    expect(result.speakerRole).toBe("部長");
    expect(result.content).toBe("お答えいたします。");
  });

  it("○市民部長パターンを抽出する", () => {
    const result = parseSpeaker(
      "○市民部長（加納正康君） お答えいたします。",
    );
    expect(result.speakerName).toBe("加納正康");
    expect(result.speakerRole).toBe("部長");
    expect(result.content).toBe("お答えいたします。");
  });

  it("○議会だより編集特別委員会委員長パターンを抽出する", () => {
    const result = parseSpeaker(
      "○議会だより編集特別委員会委員長（寺町 茂君） 報告いたします。",
    );
    expect(result.speakerName).toBe("寺町茂");
    expect(result.speakerRole).toBe("議会だより編集特別委員会委員長");
    expect(result.content).toBe("報告いたします。");
  });

  it("名前にスペースが含まれる場合スペースを除去する", () => {
    const result = parseSpeaker(
      "○議長（大西　德三郎君） 開会します。",
    );
    expect(result.speakerName).toBe("大西德三郎");
    expect(result.speakerRole).toBe("議長");
  });

  it("マーカーのみで内容がない場合は content が空になる", () => {
    const result = parseSpeaker("○");
    expect(result.speakerName).toBeNull();
    expect(result.speakerRole).toBeNull();
    expect(result.content).toBe("");
  });
});

describe("classifyKind", () => {
  it("議長は remark に分類する", () => {
    expect(classifyKind("議長")).toBe("remark");
  });

  it("副議長は remark に分類する", () => {
    expect(classifyKind("副議長")).toBe("remark");
  });

  it("委員長は remark に分類する", () => {
    expect(classifyKind("委員長")).toBe("remark");
  });

  it("議会だより編集特別委員会委員長は remark に分類する", () => {
    expect(classifyKind("議会だより編集特別委員会委員長")).toBe("remark");
  });

  it("市長は answer に分類する", () => {
    expect(classifyKind("市長")).toBe("answer");
  });

  it("副市長は answer に分類する", () => {
    expect(classifyKind("副市長")).toBe("answer");
  });

  it("部長は answer に分類する", () => {
    expect(classifyKind("部長")).toBe("answer");
  });

  it("教育長は answer に分類する", () => {
    expect(classifyKind("教育長")).toBe("answer");
  });

  it("課長は answer に分類する", () => {
    expect(classifyKind("課長")).toBe("answer");
  });

  it("議員は question に分類する", () => {
    expect(classifyKind("議員")).toBe("question");
  });

  it("nullは question に分類する", () => {
    expect(classifyKind(null)).toBe("question");
  });
});

describe("parseStatements", () => {
  it("各マーカーで分割して正しい kind を割り当てる", () => {
    const text = [
      "○議長（大西德三郎君） ただいまから会議を開きます。",
      "○１０番（今枝和子君） 質問いたします。",
      "○市長（藤原勉君） お答えいたします。",
      "○総務部長（村澤勲君） 補足します。",
    ].join("\n");

    const result = parseStatements(text);

    expect(result).toHaveLength(4);

    expect(result[0]!.kind).toBe("remark");
    expect(result[0]!.speakerName).toBe("大西德三郎");
    expect(result[0]!.speakerRole).toBe("議長");
    expect(result[0]!.content).toBe("ただいまから会議を開きます。");
    expect(result[0]!.contentHash).toBe(
      createHash("sha256")
        .update("ただいまから会議を開きます。")
        .digest("hex"),
    );

    expect(result[1]!.kind).toBe("question");
    expect(result[1]!.speakerName).toBe("今枝和子");
    expect(result[1]!.speakerRole).toBe("議員");

    expect(result[2]!.kind).toBe("answer");
    expect(result[2]!.speakerName).toBe("藤原勉");
    expect(result[2]!.speakerRole).toBe("市長");

    expect(result[3]!.kind).toBe("answer");
    expect(result[3]!.speakerName).toBe("村澤勲");
    expect(result[3]!.speakerRole).toBe("部長");
  });

  it("メタ情報行をスキップする", () => {
    const text = [
      "○出席議員（18名）",
      "○欠席議員（なし）",
      "○議長（大西德三郎君） ただいまから会議を開きます。",
    ].join("\n");

    const result = parseStatements(text);
    expect(result).toHaveLength(1);
    expect(result[0]!.speakerRole).toBe("議長");
  });

  it("ページ番号ノイズを除去してパースする", () => {
    const text = "○議長（大西德三郎君） ただいまから－ １－会議を開きます。";

    const result = parseStatements(text);
    expect(result).toHaveLength(1);
    // ページ番号除去後にパース
    expect(result[0]!.speakerRole).toBe("議長");
  });

  it("空テキストでは空配列を返す", () => {
    expect(parseStatements("")).toEqual([]);
  });

  it("マーカーがないテキストでは空配列を返す", () => {
    expect(parseStatements("ただの説明テキストです。")).toEqual([]);
  });

  it("startOffset / endOffset が連続している", () => {
    const text = [
      "○議長（大西德三郎君） 開会します。",
      "○市長（藤原勉君） 答弁します。",
    ].join("\n");

    const result = parseStatements(text);
    expect(result).toHaveLength(2);
    expect(result[0]!.startOffset).toBe(0);
    expect(result[0]!.endOffset).toBe("開会します。".length);
    expect(result[1]!.startOffset).toBe(result[0]!.endOffset + 1);
  });

  it("content が空の発言はスキップする", () => {
    const text = [
      "○議長（大西德三郎君）",
      "○１０番（今枝和子君） 質問いたします。",
    ].join("\n");

    const result = parseStatements(text);
    expect(result).toHaveLength(1);
    expect(result[0]!.speakerRole).toBe("議員");
  });
});
