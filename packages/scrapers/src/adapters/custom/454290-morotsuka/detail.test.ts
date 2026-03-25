import { describe, expect, it } from "vitest";
import {
  classifyKind,
  extractSpeakerBeforeMarker,
  parseDateFromPdfText,
  parseSpeakerText,
  parseStatements,
} from "./detail";

/** 質問マーカー (U+2C27) */
const Q = "\u2C27";
/** 答弁マーカー (U+2C28) */
const A = "\u2C28";

describe("parseSpeakerText", () => {
  it("議員（文字間スペースあり）を解析する", () => {
    const result = parseSpeakerText("甲 斐 弘 昭 議 員");
    expect(result.speakerRole).toBe("議員");
    expect(result.speakerName).toBe("甲斐弘昭");
  });

  it("村長を解析する", () => {
    const result = parseSpeakerText("藤 﨑 村 長");
    expect(result.speakerRole).toBe("村長");
    expect(result.speakerName).toBe("藤﨑");
  });

  it("教育長を解析する", () => {
    const result = parseSpeakerText("竹 内 教 育 長");
    expect(result.speakerRole).toBe("教育長");
    expect(result.speakerName).toBe("竹内");
  });

  it("課長を解析する", () => {
    const result = parseSpeakerText("総 務 課 長");
    expect(result.speakerRole).toBe("課長");
    expect(result.speakerName).toBe("総務");
  });

  it("副村長を解析する", () => {
    const result = parseSpeakerText("副 村 長");
    expect(result.speakerRole).toBe("副村長");
    expect(result.speakerName).toBeNull();
  });

  it("役職のみの場合は name が null になる", () => {
    const result = parseSpeakerText("村 長");
    expect(result.speakerRole).toBe("村長");
    expect(result.speakerName).toBeNull();
  });

  it("空文字列は null を返す", () => {
    const result = parseSpeakerText("");
    expect(result.speakerRole).toBeNull();
    expect(result.speakerName).toBeNull();
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

  it("村長は answer", () => {
    expect(classifyKind("村長")).toBe("answer");
  });

  it("副村長は answer", () => {
    expect(classifyKind("副村長")).toBe("answer");
  });

  it("教育長は answer", () => {
    expect(classifyKind("教育長")).toBe("answer");
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

describe("extractSpeakerBeforeMarker", () => {
  it("句読点の後の話者テキストを抽出する", () => {
    const text = "答弁内容がここで終わる。\n 甲 斐 弘 昭 議 員 ";
    const speaker = extractSpeakerBeforeMarker(text);
    expect(speaker).toContain("議 員");
  });

  it("話者テキストを役職サフィックスで特定する", () => {
    const text = "前の答弁内容。 竹 内 教 育 長 ";
    const speaker = extractSpeakerBeforeMarker(text);
    expect(speaker).toContain("教 育 長");
  });
});

describe("parseDateFromPdfText", () => {
  it("令和年月日パターンを処理する", () => {
    const text = "令和6年11月発行";
    expect(parseDateFromPdfText(text, 2024, 11)).toBe("2024-11-01");
  });

  it("令和年月日パターンで具体的な日付を処理する", () => {
    const text = "令和6年11月12日発行";
    expect(parseDateFromPdfText(text, 2024, 11)).toBe("2024-11-12");
  });

  it("全角数字を処理する", () => {
    const text = "令和６年１１月１２日発行";
    expect(parseDateFromPdfText(text, 2024, 11)).toBe("2024-11-12");
  });

  it("日付が見つからない場合は月初日を返す", () => {
    expect(parseDateFromPdfText("テキストのみ", 2024, 11)).toBe("2024-11-01");
  });
});

describe("parseStatements", () => {
  it("Ⱗ/Ⱘ マーカーで発言を分割する", () => {
    const text = [
      "前文",
      `甲 斐 弘 昭 議 員 ${Q} 今後の本村自治公民館活動の在り方について伺う。`,
      `竹 内 教 育 長 ${A} 令和四年十一月に公民館長会主導で会を発足した。`,
    ].join("\n");

    const statements = parseStatements(text);

    expect(statements.length).toBeGreaterThanOrEqual(1);
    expect(statements[0]!.kind).toBe("question");
    expect(statements[0]!.speakerRole).toBe("議員");
    expect(statements[0]!.speakerName).toBe("甲斐弘昭");
    expect(statements[0]!.content).toContain("今後の本村自治公民館活動");
  });

  it("村長答弁を正しく分類する", () => {
    const text = [
      "前文",
      `尾 形 浩 一 議 員 ${Q} 農作物への影響について伺う。`,
      `藤 﨑 村 長 ${A} 本村の基幹作物であるしいたけは気温に影響を受ける。`,
    ].join("\n");

    const statements = parseStatements(text);

    expect(statements.length).toBeGreaterThanOrEqual(2);
    const villageChief = statements.find((s) => s.speakerRole === "村長");
    expect(villageChief).toBeDefined();
    expect(villageChief!.kind).toBe("answer");
  });

  it("各 statement に contentHash が付与される", () => {
    const text = `甲 斐 弘 昭 議 員 ${Q} テスト発言。`;
    const statements = parseStatements(text);
    expect(statements[0]!.contentHash).toMatch(/^[a-f0-9]{64}$/);
  });

  it("offset が正しく計算される", () => {
    const text = [
      `甲 斐 弘 昭 議 員 ${Q} 最初の発言。`,
      `藤 﨑 村 長 ${A} 次の発言。`,
    ].join("\n");

    const statements = parseStatements(text);
    expect(statements[0]!.startOffset).toBe(0);
    expect(statements[0]!.endOffset).toBeGreaterThan(0);
  });

  it("空テキストは空配列を返す", () => {
    expect(parseStatements("")).toEqual([]);
  });

  it("マーカーのないテキストは空配列を返す", () => {
    expect(parseStatements("これは通常の文章です。")).toEqual([]);
  });
});
