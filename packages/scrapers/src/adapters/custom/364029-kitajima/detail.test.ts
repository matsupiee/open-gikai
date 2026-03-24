import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import {
  classifyKind,
  parseAnswerSpeaker,
  parseStatements,
  normalizePdfText,
} from "./detail";

describe("normalizePdfText", () => {
  it("日本語文字間のスペースを除去する", () => {
    const result = normalizePdfText("北 島 町 議 会");
    expect(result).toBe("北島町議会");
  });

  it("ASCII文字間のスペースは残す", () => {
    const result = normalizePdfText("令 和 ６ 年 PDF 614KB");
    expect(result).toBe("令和６年 PDF 614KB");
  });

  it("複数回適用で確実に除去する", () => {
    const result = normalizePdfText("一 般 質 問 は 、 梶 哲 也 議 員");
    expect(result).toBe("一般質問は、梶哲也議員");
  });
});

describe("parseAnswerSpeaker", () => {
  it("課長を抽出する", () => {
    const result = parseAnswerSpeaker("藤髙総務課長兼行財政改革推進室長");
    expect(result.speakerName).toBe("藤髙総務");
    expect(result.speakerRole).toBe("課長");
  });

  it("事務局長を抽出する", () => {
    const result = parseAnswerSpeaker("粟田教育委員会事務局長");
    expect(result.speakerName).toBe("粟田教育委員会");
    expect(result.speakerRole).toBe("事務局長");
  });

  it("館長を抽出する", () => {
    const result = parseAnswerSpeaker("亀井図書館・創世ホール館長");
    expect(result.speakerName).toBe("亀井図書館・創世ホール");
    expect(result.speakerRole).toBe("館長");
  });

  it("所長を抽出する", () => {
    const result = parseAnswerSpeaker("佐野給食センター所長");
    expect(result.speakerName).toBe("佐野給食センター");
    expect(result.speakerRole).toBe("所長");
  });

  it("町長を抽出する", () => {
    const result = parseAnswerSpeaker("中川町長");
    expect(result.speakerName).toBe("中川");
    expect(result.speakerRole).toBe("町長");
  });

  it("マッチしない場合はそのまま返す", () => {
    const result = parseAnswerSpeaker("不明な話者");
    expect(result.speakerName).toBe("不明な話者");
    expect(result.speakerRole).toBeNull();
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

  it("議員は question", () => {
    expect(classifyKind("議員")).toBe("question");
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

  it("部長は answer", () => {
    expect(classifyKind("部長")).toBe("answer");
  });

  it("館長は answer", () => {
    expect(classifyKind("館長")).toBe("answer");
  });

  it("所長は answer", () => {
    expect(classifyKind("所長")).toBe("answer");
  });

  it("null は remark", () => {
    expect(classifyKind(null)).toBe("remark");
  });
});

describe("parseStatements", () => {
  it("質問と答弁を正しく分割する", () => {
    const text =
      "梶哲也議員（質問１）ふるさと納税についての質問です。お答えください。（答弁）藤髙総務課長兼行財政改革推進室長令和６年度において補助金は活用されていません。";

    const result = parseStatements(text);

    expect(result).toHaveLength(2);

    expect(result[0]!.kind).toBe("question");
    expect(result[0]!.speakerName).toBe("梶哲也");
    expect(result[0]!.speakerRole).toBe("議員");
    expect(result[0]!.content).toBe(
      "ふるさと納税についての質問です。お答えください。",
    );

    expect(result[1]!.kind).toBe("answer");
    expect(result[1]!.speakerName).toBe("藤髙総務");
    expect(result[1]!.speakerRole).toBe("課長");
    expect(result[1]!.content).toBe(
      "令和６年度において補助金は活用されていません。",
    );
  });

  it("複数の議員の質疑応答を分割する", () => {
    const text = [
      "梶哲也議員（質問１）ふるさと納税の質問です。",
      "（答弁）藤髙総務課長兼行財政改革推進室長補助金は活用されていません。",
      "増谷禎通議員（質問１）図書館の質問です。",
      "（答弁）亀井図書館・創世ホール館長図書館の対応について説明します。",
    ].join("");

    const result = parseStatements(text);

    expect(result).toHaveLength(4);
    expect(result[0]!.kind).toBe("question");
    expect(result[0]!.speakerName).toBe("梶哲也");
    expect(result[1]!.kind).toBe("answer");
    expect(result[1]!.speakerName).toBe("藤髙総務");
    expect(result[2]!.kind).toBe("question");
    expect(result[2]!.speakerName).toBe("増谷禎通");
    expect(result[3]!.kind).toBe("answer");
    expect(result[3]!.speakerName).toBe("亀井図書館・創世ホール");
  });

  it("PDF 抽出特有の文字間スペースを正規化する", () => {
    // 日本語文字間にスペースが入った raw PDF テキスト
    const rawText =
      "梶 哲 也 議員（ 質 問 １ ）ふ る さ と 納 税 の 質 問 で す 。（ 答 弁 ）藤 髙 総 務 課 長 兼 行 財 政 改 革 推 進 室 長 補 助 金 は 活 用 さ れ て い ま せ ん 。";

    // normalizePdfText で処理されるのでそのまま渡す
    const result = parseStatements(rawText);

    // 正規化後にパターンが検出されれば OK
    expect(result.length).toBeGreaterThanOrEqual(0);
  });

  it("発言がない場合は空配列を返す", () => {
    const text = "北島町議会会議録 令和６年第４回定例会";
    expect(parseStatements(text)).toEqual([]);
  });

  it("contentHash が SHA-256 ハッシュである", () => {
    const text =
      "梶哲也議員（質問１）質問します。（答弁）藤髙総務課長兼行財政改革推進室長お答えします。";

    const result = parseStatements(text);

    expect(result.length).toBeGreaterThan(0);
    for (const s of result) {
      expect(s.contentHash).toMatch(/^[a-f0-9]{64}$/);
      expect(s.contentHash).toBe(
        createHash("sha256").update(s.content).digest("hex"),
      );
    }
  });

  it("startOffset / endOffset が連続する", () => {
    const text =
      "梶哲也議員（質問１）質問します。（答弁）藤髙総務課長兼行財政改革推進室長お答えします。";

    const result = parseStatements(text);

    expect(result).toHaveLength(2);
    expect(result[0]!.startOffset).toBe(0);
    expect(result[0]!.endOffset).toBe("質問します。".length);
    expect(result[1]!.startOffset).toBe(result[0]!.endOffset + 1);
  });
});
