import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import { extractHeldOnFromText } from "./shared";
import { classifyKind, parseSpeaker, parseStatements } from "./detail";

describe("extractHeldOnFromText", () => {
  it("文書タイトルと第1日目ヘッダーから日付を抽出する", () => {
    const text =
      "令和元年第4回(12月)波佐見町議会定例会 会期日程\n第1日目（12月9日）（月曜日）";
    expect(extractHeldOnFromText(text)).toBe("2019-12-09");
  });

  it("全角数字の文書タイトルにも対応する", () => {
    const text =
      "令和５年第１回(３月)波佐見町議会定例会 会期日程\n第1日目（３月３日）（金曜日）";
    expect(extractHeldOnFromText(text)).toBe("2023-03-03");
  });

  it("平成の文書から日付を抽出する", () => {
    const text =
      "平成30年第2回(6月)波佐見町議会定例会 会期日程\n第1日目（6月12日）（火曜日）";
    expect(extractHeldOnFromText(text)).toBe("2018-06-12");
  });

  it("日ごと分割PDFから日付を抽出する（第1日目ヘッダーが先頭にある場合）", () => {
    const text =
      "-1- 第1日目（3月6日）（火曜日）\n○議長（今井泰照君） 平成30年第1回波佐見町議会定例会を開会します。";
    expect(extractHeldOnFromText(text)).toBe("2018-03-06");
  });

  it("臨時会の「開会：令和5年2月2日」形式から日付を抽出する", () => {
    const text =
      "令 和 5 年 波 佐 見 町 議 会 臨 時 会 会 議 録 開 会：令和 5年 2月 2日 第1回";
    expect(extractHeldOnFromText(text)).toBe("2023-02-02");
  });

  it("令和元年に対応する", () => {
    const text =
      "令和元年第2回(6月)波佐見町議会定例会\n第1日目（6月12日）（水曜日）";
    expect(extractHeldOnFromText(text)).toBe("2019-06-12");
  });

  it("マッチしない場合はnullを返す", () => {
    expect(extractHeldOnFromText("2024年3月1日")).toBeNull();
  });
});

describe("parseSpeaker", () => {
  it("議長パターンを抽出する", () => {
    const result = parseSpeaker(
      "○議長（今井泰照君） ただいまから会議を開きます。",
    );
    expect(result.speakerName).toBe("今井泰照");
    expect(result.speakerRole).toBe("議長");
    expect(result.content).toBe("ただいまから会議を開きます。");
  });

  it("町長パターンを抽出する", () => {
    const result = parseSpeaker(
      "○町長（一瀬政太君） お答えいたします。",
    );
    expect(result.speakerName).toBe("一瀬政太");
    expect(result.speakerRole).toBe("町長");
    expect(result.content).toBe("お答えいたします。");
  });

  it("副町長パターンを抽出する", () => {
    const result = parseSpeaker("○副町長（松下幸人君） お答えします。");
    expect(result.speakerName).toBe("松下幸人");
    expect(result.speakerRole).toBe("副町長");
    expect(result.content).toBe("お答えします。");
  });

  it("番号付き議員パターンを抽出する", () => {
    const result = parseSpeaker("○２番（城後光君） 質問いたします。");
    expect(result.speakerName).toBe("城後光");
    expect(result.speakerRole).toBe("議員");
    expect(result.content).toBe("質問いたします。");
  });

  it("半角番号付き議員パターンを抽出する", () => {
    const result = parseSpeaker("○10番（川田保則君） 質問いたします。");
    expect(result.speakerName).toBe("川田保則");
    expect(result.speakerRole).toBe("議員");
    expect(result.content).toBe("質問いたします。");
  });

  it("課長パターンを抽出する", () => {
    const result = parseSpeaker(
      "○総務課長（村川浩記君） お答えいたします。",
    );
    expect(result.speakerName).toBe("村川浩記");
    expect(result.speakerRole).toBe("課長");
    expect(result.content).toBe("お答えいたします。");
  });

  it("教育長パターンを抽出する", () => {
    const result = parseSpeaker(
      "○教育長（中嶋健蔵君） お答えいたします。",
    );
    expect(result.speakerName).toBe("中嶋健蔵");
    expect(result.speakerRole).toBe("教育長");
    expect(result.content).toBe("お答えいたします。");
  });

  it("教育次長パターンを抽出する", () => {
    const result = parseSpeaker(
      "○教育次長（福田博治君） お答えいたします。",
    );
    expect(result.speakerName).toBe("福田博治");
    expect(result.speakerRole).toBe("教育次長");
    expect(result.content).toBe("お答えいたします。");
  });

  it("会計管理者兼パターンを抽出する", () => {
    const result = parseSpeaker(
      "○会計管理者兼会計課長（宮田和子君） お答えいたします。",
    );
    expect(result.speakerName).toBe("宮田和子");
    expect(result.speakerRole).toBe("課長");
    expect(result.content).toBe("お答えいたします。");
  });

  it("議会事務局長パターンを抽出する", () => {
    const result = parseSpeaker(
      "○議会事務局長（中村和彦君） ご報告申し上げます。",
    );
    expect(result.speakerName).toBe("中村和彦");
    expect(result.speakerRole).toBe("事務局長");
    expect(result.content).toBe("ご報告申し上げます。");
  });

  it("名前にスペースが含まれる場合スペースを除去する", () => {
    const result = parseSpeaker("○議長（今井 泰照君） 開会します。");
    expect(result.speakerName).toBe("今井泰照");
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

  it("議会運営委員長は remark に分類する", () => {
    expect(classifyKind("議会運営委員長")).toBe("remark");
  });

  it("町長は answer に分類する", () => {
    expect(classifyKind("町長")).toBe("answer");
  });

  it("副町長は answer に分類する", () => {
    expect(classifyKind("副町長")).toBe("answer");
  });

  it("課長は answer に分類する", () => {
    expect(classifyKind("課長")).toBe("answer");
  });

  it("教育長は answer に分類する", () => {
    expect(classifyKind("教育長")).toBe("answer");
  });

  it("教育次長は answer に分類する", () => {
    expect(classifyKind("教育次長")).toBe("answer");
  });

  it("事務局長は answer に分類する", () => {
    expect(classifyKind("事務局長")).toBe("answer");
  });

  it("会計管理者は answer に分類する", () => {
    expect(classifyKind("会計管理者")).toBe("answer");
  });

  it("議員は question に分類する", () => {
    expect(classifyKind("議員")).toBe("question");
  });

  it("null は remark に分類する", () => {
    expect(classifyKind(null)).toBe("remark");
  });
});

describe("parseStatements", () => {
  it("○マーカーで分割して ParsedStatement 配列を生成する", () => {
    const text = [
      "○議長（今井泰照君） ただいまから会議を開きます。",
      "○２番（城後光君） 質問いたします。",
      "○町長（一瀬政太君） お答えいたします。",
    ].join("\n");

    const result = parseStatements(text);

    expect(result).toHaveLength(3);
    expect(result[0]!.kind).toBe("remark");
    expect(result[0]!.speakerName).toBe("今井泰照");
    expect(result[0]!.speakerRole).toBe("議長");
    expect(result[0]!.content).toBe("ただいまから会議を開きます。");
    expect(result[0]!.contentHash).toBe(
      createHash("sha256")
        .update("ただいまから会議を開きます。")
        .digest("hex"),
    );

    expect(result[1]!.kind).toBe("question");
    expect(result[1]!.speakerName).toBe("城後光");
    expect(result[1]!.speakerRole).toBe("議員");

    expect(result[2]!.kind).toBe("answer");
    expect(result[2]!.speakerName).toBe("一瀬政太");
    expect(result[2]!.speakerRole).toBe("町長");
  });

  it("議事日程などの見出し項目をスキップする", () => {
    const text = [
      "○議事日程 第１ 会議録署名議員の指名",
      "○出席議員（14名）",
      "○議長（今井泰照君） ただいまから会議を開きます。",
    ].join("\n");

    const result = parseStatements(text);
    expect(result).toHaveLength(1);
    expect(result[0]!.speakerRole).toBe("議長");
  });

  it("説明のため出席した者をスキップする", () => {
    const text = [
      "○説明のため出席した者",
      "○議会事務局職員出席者",
      "○議長（今井泰照君） 開会します。",
    ].join("\n");

    const result = parseStatements(text);
    expect(result).toHaveLength(1);
    expect(result[0]!.speakerRole).toBe("議長");
  });

  it("空テキストでは空配列を返す", () => {
    expect(parseStatements("")).toEqual([]);
  });

  it("○マーカーがないテキストでは空配列を返す", () => {
    expect(parseStatements("ただの説明テキストです。")).toEqual([]);
  });

  it("startOffset / endOffset が連続している", () => {
    const text = [
      "○議長（今井泰照君） 開会します。",
      "○町長（一瀬政太君） 答弁します。",
    ].join("\n");

    const result = parseStatements(text);
    expect(result).toHaveLength(2);
    expect(result[0]!.startOffset).toBe(0);
    expect(result[0]!.endOffset).toBe("開会します。".length);
    expect(result[1]!.startOffset).toBe(result[0]!.endOffset + 1);
  });
});
