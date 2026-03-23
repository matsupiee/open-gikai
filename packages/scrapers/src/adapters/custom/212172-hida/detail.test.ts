import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import { extractHeldOnFromText } from "./shared";
import { classifyKind, parseSpeaker, parseStatements } from "./detail";

describe("extractHeldOnFromText", () => {
  it("令和の日付を変換する", () => {
    expect(extractHeldOnFromText("令和6年11月26日（火曜日）")).toBe(
      "2024-11-26",
    );
  });

  it("全角数字の令和日付を変換する", () => {
    expect(extractHeldOnFromText("令和７年３月５日")).toBe("2025-03-05");
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
  it("◎議長パターンを抽出する", () => {
    const result = parseSpeaker(
      "◎議長（井端浩二君） ただいまから会議を開きます。",
    );
    expect(result.speakerName).toBe("井端浩二");
    expect(result.speakerRole).toBe("議長");
    expect(result.content).toBe("ただいまから会議を開きます。");
  });

  it("△市長パターンを抽出する", () => {
    const result = parseSpeaker(
      "△市長（都竹淳也君） お答えいたします。",
    );
    expect(result.speakerName).toBe("都竹淳也");
    expect(result.speakerRole).toBe("市長");
    expect(result.content).toBe("お答えいたします。");
  });

  it("○番号付き議員パターンを抽出する", () => {
    const result = parseSpeaker(
      "○１番（佐藤克成君） 質問いたします。",
    );
    expect(result.speakerName).toBe("佐藤克成");
    expect(result.speakerRole).toBe("議員");
    expect(result.content).toBe("質問いたします。");
  });

  it("半角番号付き議員パターンを抽出する", () => {
    const result = parseSpeaker(
      "○5番（中根洋一君） 質問します。",
    );
    expect(result.speakerName).toBe("中根洋一");
    expect(result.speakerRole).toBe("議員");
    expect(result.content).toBe("質問します。");
  });

  it("□部長パターンを抽出する", () => {
    const result = parseSpeaker(
      "□総務部長（谷尻 剛君） お答えいたします。",
    );
    expect(result.speakerName).toBe("谷尻剛");
    expect(result.speakerRole).toBe("部長");
    expect(result.content).toBe("お答えいたします。");
  });

  it("□課長パターンを抽出する", () => {
    const result = parseSpeaker(
      "□企画課長（田中太郎君） お答えいたします。",
    );
    expect(result.speakerName).toBe("田中太郎");
    expect(result.speakerRole).toBe("課長");
    expect(result.content).toBe("お答えいたします。");
  });

  it("◎副議長パターンを抽出する", () => {
    const result = parseSpeaker(
      "◎副議長（山田花子君） 議事を進めます。",
    );
    expect(result.speakerName).toBe("山田花子");
    expect(result.speakerRole).toBe("副議長");
    expect(result.content).toBe("議事を進めます。");
  });

  it("□教育長パターンを抽出する", () => {
    const result = parseSpeaker(
      "□教育長（下出尚弘君） お答えいたします。",
    );
    expect(result.speakerName).toBe("下出尚弘");
    expect(result.speakerRole).toBe("教育長");
    expect(result.content).toBe("お答えいたします。");
  });

  it("名前にスペースが含まれる場合スペースを除去する", () => {
    const result = parseSpeaker(
      "◎議長（井端　浩二君） 開会します。",
    );
    expect(result.speakerName).toBe("井端浩二");
    expect(result.speakerRole).toBe("議長");
  });

  it("敬称が「様」の場合も抽出する", () => {
    const result = parseSpeaker(
      "□総務部長（谷尻剛様） お答えします。",
    );
    expect(result.speakerName).toBe("谷尻剛");
    expect(result.speakerRole).toBe("部長");
  });

  it("マーカーのみで内容がない場合は content が空になる", () => {
    const result = parseSpeaker("○");
    expect(result.speakerName).toBeNull();
    expect(result.speakerRole).toBeNull();
    expect(result.content).toBe("");
  });
});

describe("classifyKind", () => {
  it("◎マーカーは remark に分類する", () => {
    expect(classifyKind("◎", "議長")).toBe("remark");
  });

  it("△マーカーは answer に分類する", () => {
    expect(classifyKind("△", "市長")).toBe("answer");
  });

  it("□マーカーは answer に分類する", () => {
    expect(classifyKind("□", "部長")).toBe("answer");
  });

  it("○マーカーは question に分類する", () => {
    expect(classifyKind("○", "議員")).toBe("question");
  });

  it("◆マーカーは remark に分類する", () => {
    expect(classifyKind("◆", null)).toBe("remark");
  });

  it("不明なマーカーで議長は remark に分類する", () => {
    expect(classifyKind("?", "議長")).toBe("remark");
  });

  it("不明なマーカーでnullは remark に分類する", () => {
    expect(classifyKind("?", null)).toBe("remark");
  });
});

describe("parseStatements", () => {
  it("各マーカーで分割して正しい kind を割り当てる", () => {
    const text = [
      "◎議長（井端浩二君） ただいまから会議を開きます。",
      "○１番（佐藤克成君） 質問いたします。",
      "△市長（都竹淳也君） お答えいたします。",
      "□総務部長（谷尻剛君） 補足します。",
    ].join("\n");

    const result = parseStatements(text);

    expect(result).toHaveLength(4);

    expect(result[0]!.kind).toBe("remark");
    expect(result[0]!.speakerName).toBe("井端浩二");
    expect(result[0]!.speakerRole).toBe("議長");
    expect(result[0]!.content).toBe("ただいまから会議を開きます。");
    expect(result[0]!.contentHash).toBe(
      createHash("sha256")
        .update("ただいまから会議を開きます。")
        .digest("hex"),
    );

    expect(result[1]!.kind).toBe("question");
    expect(result[1]!.speakerName).toBe("佐藤克成");
    expect(result[1]!.speakerRole).toBe("議員");

    expect(result[2]!.kind).toBe("answer");
    expect(result[2]!.speakerName).toBe("都竹淳也");
    expect(result[2]!.speakerRole).toBe("市長");

    expect(result[3]!.kind).toBe("answer");
    expect(result[3]!.speakerName).toBe("谷尻剛");
    expect(result[3]!.speakerRole).toBe("部長");
  });

  it("◆議事進行見出しをスキップする", () => {
    const text = [
      "◆日程第１ 会議録署名議員の指名",
      "◆日程第２ 会期の決定",
      "◎議長（井端浩二君） ただいまから会議を開きます。",
    ].join("\n");

    const result = parseStatements(text);
    expect(result).toHaveLength(1);
    expect(result[0]!.speakerRole).toBe("議長");
  });

  it("〇(U+3007)メタ情報を含むテキストでもスキップする", () => {
    const text = [
      "〇出席議員（14名）",
      "〇欠席議員（なし）",
      "◎議長（井端浩二君） ただいまから会議を開きます。",
    ].join("\n");

    const result = parseStatements(text);
    expect(result).toHaveLength(1);
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
      "◎議長（井端浩二君） 開会します。",
      "△市長（都竹淳也君） 答弁します。",
    ].join("\n");

    const result = parseStatements(text);
    expect(result).toHaveLength(2);
    expect(result[0]!.startOffset).toBe(0);
    expect(result[0]!.endOffset).toBe("開会します。".length);
    expect(result[1]!.startOffset).toBe(result[0]!.endOffset + 1);
  });

  it("実際のPDFテキストフォーマットをパースする", () => {
    const text = [
      "◎議長（井端浩二） 答弁を求めます。",
      "（「議長」と呼ぶ声あり）",
      "※以下、この「議長」と呼ぶ声の表記は省略する。",
      "◎議長（井端浩二） 畑上商工観光部長。",
      "〔商工観光部長 畑上あづさ 登壇〕",
      "□商工観光部長（畑上あづさ） それではご質問にお答えいたします。",
    ].join("\n");

    const result = parseStatements(text);

    expect(result).toHaveLength(3);
    expect(result[0]!.kind).toBe("remark");
    expect(result[0]!.speakerRole).toBe("議長");
    expect(result[1]!.kind).toBe("remark");
    expect(result[2]!.kind).toBe("answer");
    expect(result[2]!.speakerRole).toBe("部長");
    expect(result[2]!.speakerName).toBe("畑上あづさ");
  });
});
