import { describe, it, expect } from "vitest";
import { parseSpeaker, classifyKind, parseStatements } from "./detail";

describe("parseSpeaker", () => {
  it("議員パターンを解析する", () => {
    const result = parseSpeaker(
      "岩谷議員 今年の国勢調査で約１，０００人の人口減が見込まれる。",
    );
    expect(result.speakerName).toBe("岩谷");
    expect(result.speakerRole).toBe("議員");
    expect(result.content).toBe(
      "今年の国勢調査で約１，０００人の人口減が見込まれる。",
    );
  });

  it("副町長パターンを解析する", () => {
    const result = parseSpeaker(
      "副町長 まず、本年の国勢調査人口は前回より大幅な減少が見込まれる。",
    );
    expect(result.speakerName).toBeNull();
    expect(result.speakerRole).toBe("副町長");
    expect(result.content).toBe(
      "まず、本年の国勢調査人口は前回より大幅な減少が見込まれる。",
    );
  });

  it("町長パターンを解析する", () => {
    const result = parseSpeaker("町長 お答えいたします。");
    expect(result.speakerName).toBeNull();
    expect(result.speakerRole).toBe("町長");
    expect(result.content).toBe("お答えいたします。");
  });

  it("教育長パターンを解析する", () => {
    const result = parseSpeaker("教育長 ご説明いたします。");
    expect(result.speakerName).toBeNull();
    expect(result.speakerRole).toBe("教育長");
    expect(result.content).toBe("ご説明いたします。");
  });

  it("総務課長パターンを解析する", () => {
    const result = parseSpeaker("総務課長 ご報告いたします。");
    expect(result.speakerName).toBeNull();
    expect(result.speakerRole).toBe("総務課長");
    expect(result.content).toBe("ご報告いたします。");
  });

  it("役職も議員名もないテキスト", () => {
    const result = parseSpeaker("ただの本文テキスト");
    expect(result.speakerName).toBeNull();
    expect(result.speakerRole).toBeNull();
    expect(result.content).toBe("ただの本文テキスト");
  });

  it("複数文字の議員名を正しく処理する", () => {
    const result = parseSpeaker("大髙議員 鳥獣被害対策について伺う。");
    expect(result.speakerName).toBe("大髙");
    expect(result.speakerRole).toBe("議員");
    expect(result.content).toBe("鳥獣被害対策について伺う。");
  });
});

describe("classifyKind", () => {
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

  it("総務課長は answer", () => {
    expect(classifyKind("総務課長")).toBe("answer");
  });

  it("課長は answer", () => {
    expect(classifyKind("課長")).toBe("answer");
  });

  it("null は remark", () => {
    expect(classifyKind(null)).toBe("remark");
  });
});

describe("parseStatements", () => {
  it("1行テキストから議員と答弁者のブロックを分割する", () => {
    const text =
      "岩谷議員 今年の国勢調査で約１，０００人の人口減が見込まれる。新年度予算の方針は。 副町長 まず、本年の国勢調査人口は前回より大幅な減少が見込まれる。歳入は依存財源が８割以上を占める構造にある。";

    const statements = parseStatements(text);

    expect(statements).toHaveLength(2);

    expect(statements[0]!.kind).toBe("question");
    expect(statements[0]!.speakerName).toBe("岩谷");
    expect(statements[0]!.speakerRole).toBe("議員");

    expect(statements[1]!.kind).toBe("answer");
    expect(statements[1]!.speakerName).toBeNull();
    expect(statements[1]!.speakerRole).toBe("副町長");
  });

  it("複数の質問と回答を正しく分割する", () => {
    const text =
      "大川議員 ビックイエローは全国的に有名な観光スポットとなったが、来場者への対応に課題がある。 町長 駐車場誘導については、開催時に外部業者へ交通誘導を委託している。 大川議員 海と山の魅力を活かした観光拠点の強化について伺う。 町長 同公園は約47億円をかけて整備された県営の海岸保全施設である。";

    const statements = parseStatements(text);

    expect(statements).toHaveLength(4);
    expect(statements[0]!.kind).toBe("question");
    expect(statements[0]!.speakerName).toBe("大川");
    expect(statements[1]!.kind).toBe("answer");
    expect(statements[1]!.speakerRole).toBe("町長");
    expect(statements[2]!.kind).toBe("question");
    expect(statements[2]!.speakerName).toBe("大川");
    expect(statements[3]!.kind).toBe("answer");
  });

  it("各 statement に contentHash が付与される", () => {
    const text = "岩谷議員 テスト発言です。これは十分な長さのテスト文です。";
    const statements = parseStatements(text);
    expect(statements[0]!.contentHash).toMatch(/^[a-f0-9]{64}$/);
  });

  it("offset が正しく計算される", () => {
    const text =
      "岩谷議員 質問です。これは十分な長さです。 副町長 回答です。これも十分な長さです。";

    const statements = parseStatements(text);

    expect(statements[0]!.startOffset).toBe(0);
    expect(statements[1]!.startOffset).toBe(
      statements[0]!.endOffset + 1,
    );
  });

  it("「問」「答」マーカーをコンテンツから除去する", () => {
    const text =
      "岩谷議員 今年の国勢調査で約１，０００人の人口減が見込まれる。 問 副町長 まず、本年の国勢調査人口は前回より大幅な減少が見込まれる。 答";

    const statements = parseStatements(text);
    expect(statements).toHaveLength(2);
    // 「問」「答」マーカーがコンテンツに含まれないこと
    expect(statements[0]!.content).not.toMatch(/^\s*問\s*$/);
    expect(statements[1]!.content).not.toMatch(/\s+答$/);
  });

  it("ヘッダーテキストを除去する", () => {
    const text =
      "ふかうらまち議会だより №84 2026.2.13発行（8） 岩谷議員 今年の国勢調査で約１，０００人の人口減が見込まれる。新年度予算の方針は。";

    const statements = parseStatements(text);
    expect(statements).toHaveLength(1);
    expect(statements[0]!.content).not.toContain("ふかうらまち議会だより");
  });

  it("空テキストは空配列を返す", () => {
    expect(parseStatements("")).toEqual([]);
  });

  it("短すぎるコンテンツはスキップする", () => {
    const text =
      "岩谷議員 あ 副町長 まず、本年の国勢調査人口は前回より大幅な減少が見込まれる構造にある。";

    const statements = parseStatements(text);
    expect(statements).toHaveLength(1);
    expect(statements[0]!.speakerRole).toBe("副町長");
  });

  it("実際の PDF テキストパターンを正しくパースする", () => {
    const text =
      "ふかうらまち議会だより №84 2026.2.13発行（8） 岩谷議員 今年の国勢調査で約１，０ ００人の人口減が見込まれ、 地方交付税も 1 億円以上減額 される見通しである。こうし た厳しい財政状況の中で、新 年度予算をどのような方針で 編成するのか。 問 副町長 まず、本年 10 月 1 日基準の 国勢調査人口は前回より大幅 な減少が見込まれ、地方交付 税、普通交付税の減少要因と なる。 答";

    const statements = parseStatements(text);

    expect(statements.length).toBeGreaterThanOrEqual(2);
    expect(statements[0]!.kind).toBe("question");
    expect(statements[0]!.speakerName).toBe("岩谷");
    expect(statements[1]!.kind).toBe("answer");
    expect(statements[1]!.speakerRole).toBe("副町長");
  });
});
