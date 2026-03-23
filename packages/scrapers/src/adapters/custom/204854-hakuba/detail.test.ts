import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import { classifyKind, parseSpeaker, parseStatements } from "./detail";

describe("parseSpeaker", () => {
  it("議長パターンを抽出する", () => {
    const result = parseSpeaker(
      "議長（太田伸子君） ただいまから会議を開きます。",
    );
    expect(result.speakerName).toBe("太田伸子");
    expect(result.speakerRole).toBe("議長");
    expect(result.content).toBe("ただいまから会議を開きます。");
  });

  it("村長パターンを抽出する", () => {
    const result = parseSpeaker(
      "村長（丸山俊郎君） お答えいたします。",
    );
    expect(result.speakerName).toBe("丸山俊郎");
    expect(result.speakerRole).toBe("村長");
    expect(result.content).toBe("お答えいたします。");
  });

  it("番号付き議員パターンを抽出する", () => {
    const result = parseSpeaker(
      "第８番（津滝俊幸君） 質問いたします。",
    );
    expect(result.speakerName).toBe("津滝俊幸");
    expect(result.speakerRole).toBe("議員");
    expect(result.content).toBe("質問いたします。");
  });

  it("半角番号付き議員パターンを抽出する", () => {
    const result = parseSpeaker(
      "第10番（加藤亮輔君） 質問いたします。",
    );
    expect(result.speakerName).toBe("加藤亮輔");
    expect(result.speakerRole).toBe("議員");
    expect(result.content).toBe("質問いたします。");
  });

  it("課長パターンを抽出する", () => {
    const result = parseSpeaker(
      "総務課長（田中克俊君） お答えいたします。",
    );
    expect(result.speakerName).toBe("田中克俊");
    expect(result.speakerRole).toBe("課長");
    expect(result.content).toBe("お答えいたします。");
  });

  it("参事兼建設課長パターンを抽出する", () => {
    const result = parseSpeaker(
      "参事兼建設課長（矢口俊樹君） お答えいたします。",
    );
    expect(result.speakerName).toBe("矢口俊樹");
    expect(result.speakerRole).toBe("課長");
    expect(result.content).toBe("お答えいたします。");
  });

  it("副村長パターンを抽出する", () => {
    const result = parseSpeaker(
      "副村長（吉田久夫君） お答えします。",
    );
    expect(result.speakerName).toBe("吉田久夫");
    expect(result.speakerRole).toBe("副村長");
    expect(result.content).toBe("お答えします。");
  });

  it("教育長パターンを抽出する", () => {
    const result = parseSpeaker(
      "教育長（横川秀明君） お答えいたします。",
    );
    expect(result.speakerName).toBe("横川秀明");
    expect(result.speakerRole).toBe("教育長");
    expect(result.content).toBe("お答えいたします。");
  });

  it("産業経済委員長パターンを抽出する", () => {
    const result = parseSpeaker(
      "産業経済委員長（切久保達也君） ご報告申し上げます。",
    );
    expect(result.speakerName).toBe("切久保達也");
    expect(result.speakerRole).toBe("委員長");
    expect(result.content).toBe("ご報告申し上げます。");
  });

  it("議会運営委員長パターンを抽出する", () => {
    const result = parseSpeaker(
      "議会運営委員長（津滝俊幸君） ご報告申し上げます。",
    );
    expect(result.speakerName).toBe("津滝俊幸");
    expect(result.speakerRole).toBe("議会運営委員長");
    expect(result.content).toBe("ご報告申し上げます。");
  });

  it("新たな財源確保調査検討特別委員長パターンを抽出する", () => {
    const result = parseSpeaker(
      "新たな財源確保調査検討特別委員長（太谷修助君） ご報告いたします。",
    );
    expect(result.speakerName).toBe("太谷修助");
    expect(result.speakerRole).toBe("特別委員長");
    expect(result.content).toBe("ご報告いたします。");
  });

  it("予算特別委員長パターンを抽出する", () => {
    const result = parseSpeaker(
      "予算特別委員長（丸山勇太郎君） ご報告いたします。",
    );
    expect(result.speakerName).toBe("丸山勇太郎");
    expect(result.speakerRole).toBe("特別委員長");
    expect(result.content).toBe("ご報告いたします。");
  });

  it("議会事務局長パターンを抽出する", () => {
    const result = parseSpeaker(
      "議会事務局長（下川浩毅君） ご報告申し上げます。",
    );
    expect(result.speakerName).toBe("下川浩毅");
    expect(result.speakerRole).toBe("議会事務局長");
    expect(result.content).toBe("ご報告申し上げます。");
  });

  it("生涯学習スポーツ課長パターンを抽出する", () => {
    const result = parseSpeaker(
      "生涯学習スポーツ課長（松澤宏和君） お答えいたします。",
    );
    expect(result.speakerName).toBe("松澤宏和");
    expect(result.speakerRole).toBe("課長");
    expect(result.content).toBe("お答えいたします。");
  });

  it("会計管理者会計室長パターンを抽出する", () => {
    const result = parseSpeaker(
      "会計管理者会計室長（太田俊祉君） お答えいたします。",
    );
    expect(result.speakerName).toBe("太田俊祉");
    expect(result.speakerRole).toBe("会計管理者会計室長");
    expect(result.content).toBe("お答えいたします。");
  });

  it("参事兼教育課長パターンを抽出する", () => {
    const result = parseSpeaker(
      "参事兼教育課長（横川辰彦君） お答えいたします。",
    );
    expect(result.speakerName).toBe("横川辰彦");
    expect(result.speakerRole).toBe("課長");
    expect(result.content).toBe("お答えいたします。");
  });

  it("パターンにマッチしない場合はnullを返す", () => {
    const result = parseSpeaker("これは通常のテキストです。");
    expect(result.speakerName).toBeNull();
    expect(result.speakerRole).toBeNull();
    expect(result.content).toBe("これは通常のテキストです。");
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

  it("委員長は remark に分類する", () => {
    expect(classifyKind("委員長")).toBe("remark");
  });

  it("特別委員長は remark に分類する", () => {
    expect(classifyKind("特別委員長")).toBe("remark");
  });

  it("村長は answer に分類する", () => {
    expect(classifyKind("村長")).toBe("answer");
  });

  it("副村長は answer に分類する", () => {
    expect(classifyKind("副村長")).toBe("answer");
  });

  it("課長は answer に分類する", () => {
    expect(classifyKind("課長")).toBe("answer");
  });

  it("教育長は answer に分類する", () => {
    expect(classifyKind("教育長")).toBe("answer");
  });

  it("議会事務局長は answer に分類する", () => {
    expect(classifyKind("議会事務局長")).toBe("answer");
  });

  it("会計管理者会計室長は answer に分類する", () => {
    expect(classifyKind("会計管理者会計室長")).toBe("answer");
  });

  it("議員は question に分類する", () => {
    expect(classifyKind("議員")).toBe("question");
  });

  it("null は remark に分類する", () => {
    expect(classifyKind(null)).toBe("remark");
  });
});

describe("parseStatements", () => {
  it("発言者パターンで分割して ParsedStatement 配列を生成する", () => {
    const text = [
      "議長（太田伸子君） ただいまから会議を開きます。",
      "第８番（津滝俊幸君） 質問いたします。",
      "村長（丸山俊郎君） お答えいたします。",
    ].join("\n");

    const result = parseStatements(text);

    expect(result).toHaveLength(3);
    expect(result[0]!.kind).toBe("remark");
    expect(result[0]!.speakerName).toBe("太田伸子");
    expect(result[0]!.speakerRole).toBe("議長");
    expect(result[0]!.content).toBe("ただいまから会議を開きます。");
    expect(result[0]!.contentHash).toBe(
      createHash("sha256")
        .update("ただいまから会議を開きます。")
        .digest("hex"),
    );

    expect(result[1]!.kind).toBe("question");
    expect(result[1]!.speakerName).toBe("津滝俊幸");
    expect(result[1]!.speakerRole).toBe("議員");

    expect(result[2]!.kind).toBe("answer");
    expect(result[2]!.speakerName).toBe("丸山俊郎");
    expect(result[2]!.speakerRole).toBe("村長");
  });

  it("課長の発言も正しく抽出する", () => {
    const text = [
      "議長（太田伸子君） 答弁を求めます。",
      "総務課長（田中克俊君） お答えいたします。内容は以下のとおりです。",
    ].join("\n");

    const result = parseStatements(text);

    expect(result).toHaveLength(2);
    expect(result[1]!.kind).toBe("answer");
    expect(result[1]!.speakerName).toBe("田中克俊");
    expect(result[1]!.speakerRole).toBe("課長");
  });

  it("空テキストでは空配列を返す", () => {
    expect(parseStatements("")).toEqual([]);
  });

  it("発言者パターンがないテキストでは空配列を返す", () => {
    expect(parseStatements("ただの説明テキストです。")).toEqual([]);
  });

  it("startOffset / endOffset が連続している", () => {
    const text = [
      "議長（太田伸子君） 開会します。",
      "村長（丸山俊郎君） 答弁します。",
    ].join("\n");

    const result = parseStatements(text);
    expect(result).toHaveLength(2);
    expect(result[0]!.startOffset).toBe(0);
    expect(result[0]!.endOffset).toBe("開会します。".length);
    expect(result[1]!.startOffset).toBe(result[0]!.endOffset + 1);
  });
});
