import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import { extractHeldOnFromText } from "./shared";
import { classifyKind, parseSpeaker, parseStatements } from "./detail";

describe("extractHeldOnFromText", () => {
  it("令和の日付を変換する", () => {
    expect(extractHeldOnFromText("令和6年11月28日（木曜日）")).toBe(
      "2024-11-28",
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
  it("○議長パターンを抽出する", () => {
    const result = parseSpeaker(
      "○議長（山田太郎君） ただいまから会議を開きます。",
    );
    expect(result.speakerName).toBe("山田太郎");
    expect(result.speakerRole).toBe("議長");
    expect(result.content).toBe("ただいまから会議を開きます。");
  });

  it("○市長パターンを抽出する", () => {
    const result = parseSpeaker(
      "○市長（鈴木一郎君） お答えいたします。",
    );
    expect(result.speakerName).toBe("鈴木一郎");
    expect(result.speakerRole).toBe("市長");
    expect(result.content).toBe("お答えいたします。");
  });

  it("○番号付き議員パターンを抽出する", () => {
    const result = parseSpeaker(
      "○１番（田中花子君） 質問いたします。",
    );
    expect(result.speakerName).toBe("田中花子");
    expect(result.speakerRole).toBe("議員");
    expect(result.content).toBe("質問いたします。");
  });

  it("半角番号付き議員パターンを抽出する", () => {
    const result = parseSpeaker(
      "○5番（佐藤次郎君） 質問します。",
    );
    expect(result.speakerName).toBe("佐藤次郎");
    expect(result.speakerRole).toBe("議員");
    expect(result.content).toBe("質問します。");
  });

  it("○部長パターンを抽出する", () => {
    const result = parseSpeaker(
      "○総務部長（伊藤三郎君） お答えいたします。",
    );
    expect(result.speakerName).toBe("伊藤三郎");
    expect(result.speakerRole).toBe("部長");
    expect(result.content).toBe("お答えいたします。");
  });

  it("○課長パターンを抽出する", () => {
    const result = parseSpeaker(
      "○企画課長（渡辺四郎君） お答えいたします。",
    );
    expect(result.speakerName).toBe("渡辺四郎");
    expect(result.speakerRole).toBe("課長");
    expect(result.content).toBe("お答えいたします。");
  });

  it("○副議長パターンを抽出する", () => {
    const result = parseSpeaker(
      "○副議長（中村五郎君） 議事を進めます。",
    );
    expect(result.speakerName).toBe("中村五郎");
    expect(result.speakerRole).toBe("副議長");
    expect(result.content).toBe("議事を進めます。");
  });

  it("敬称なしパターンも抽出する", () => {
    const result = parseSpeaker(
      "○議長（山田太郎） ただいまから会議を開きます。",
    );
    expect(result.speakerName).toBe("山田太郎");
    expect(result.speakerRole).toBe("議長");
    expect(result.content).toBe("ただいまから会議を開きます。");
  });

  it("名前にスペースが含まれる場合スペースを除去する", () => {
    const result = parseSpeaker(
      "○議長（山田　太郎君） 開会します。",
    );
    expect(result.speakerName).toBe("山田太郎");
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
  it("◎マーカーは remark に分類する", () => {
    expect(classifyKind("◎", "議長")).toBe("remark");
  });

  it("△マーカーは answer に分類する", () => {
    expect(classifyKind("△", "市長")).toBe("answer");
  });

  it("□マーカーは answer に分類する", () => {
    expect(classifyKind("□", "部長")).toBe("answer");
  });

  it("○マーカーで議長は remark に分類する", () => {
    expect(classifyKind("○", "議長")).toBe("remark");
  });

  it("○マーカーで副議長は remark に分類する", () => {
    expect(classifyKind("○", "副議長")).toBe("remark");
  });

  it("○マーカーで市長は answer に分類する", () => {
    expect(classifyKind("○", "市長")).toBe("answer");
  });

  it("○マーカーで部長は answer に分類する", () => {
    expect(classifyKind("○", "部長")).toBe("answer");
  });

  it("○マーカーで議員は question に分類する", () => {
    expect(classifyKind("○", "議員")).toBe("question");
  });

  it("◆マーカーは remark に分類する", () => {
    expect(classifyKind("◆", null)).toBe("remark");
  });

  it("不明なマーカーでnullは remark に分類する", () => {
    expect(classifyKind("?", null)).toBe("remark");
  });
});

describe("parseStatements", () => {
  it("各マーカーで分割して正しい kind を割り当てる", () => {
    const text = [
      "○議長（山田太郎君） ただいまから会議を開きます。",
      "○１番（田中花子君） 質問いたします。",
      "○市長（鈴木一郎君） お答えいたします。",
      "○総務部長（伊藤三郎君） 補足します。",
    ].join("\n");

    const result = parseStatements(text);

    expect(result).toHaveLength(4);

    expect(result[0]!.kind).toBe("remark");
    expect(result[0]!.speakerName).toBe("山田太郎");
    expect(result[0]!.speakerRole).toBe("議長");
    expect(result[0]!.content).toBe("ただいまから会議を開きます。");
    expect(result[0]!.contentHash).toBe(
      createHash("sha256")
        .update("ただいまから会議を開きます。")
        .digest("hex"),
    );

    expect(result[1]!.kind).toBe("question");
    expect(result[1]!.speakerName).toBe("田中花子");
    expect(result[1]!.speakerRole).toBe("議員");

    expect(result[2]!.kind).toBe("answer");
    expect(result[2]!.speakerName).toBe("鈴木一郎");
    expect(result[2]!.speakerRole).toBe("市長");

    expect(result[3]!.kind).toBe("answer");
    expect(result[3]!.speakerName).toBe("伊藤三郎");
    expect(result[3]!.speakerRole).toBe("部長");
  });

  it("◆議事進行見出しをスキップする", () => {
    const text = [
      "◆日程第１ 会議録署名議員の指名",
      "◆日程第２ 会期の決定",
      "○議長（山田太郎君） ただいまから会議を開きます。",
    ].join("\n");

    const result = parseStatements(text);
    expect(result).toHaveLength(1);
    expect(result[0]!.speakerRole).toBe("議長");
  });

  it("メタ情報行をスキップする", () => {
    const text = [
      "○出席議員（18名）",
      "○欠席議員（なし）",
      "○議長（山田太郎君） ただいまから会議を開きます。",
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
      "○議長（山田太郎君） 開会します。",
      "○市長（鈴木一郎君） 答弁します。",
    ].join("\n");

    const result = parseStatements(text);
    expect(result).toHaveLength(2);
    expect(result[0]!.startOffset).toBe(0);
    expect(result[0]!.endOffset).toBe("開会します。".length);
    expect(result[1]!.startOffset).toBe(result[0]!.endOffset + 1);
  });

  it("content が空の発言はスキップする", () => {
    const text = [
      "○議長（山田太郎君）",
      "○１番（田中花子君） 質問いたします。",
    ].join("\n");

    const result = parseStatements(text);
    expect(result).toHaveLength(1);
    expect(result[0]!.speakerRole).toBe("議員");
  });
});
