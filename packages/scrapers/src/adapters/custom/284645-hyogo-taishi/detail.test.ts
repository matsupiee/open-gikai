import { describe, expect, it } from "vitest";
import { parseSpeaker, classifyKind, parseStatements } from "./detail";

describe("parseSpeaker", () => {
  it("議長（名前）パターンを解析する", () => {
    const result = parseSpeaker(
      "○議長（松浦崇志） ただいまから本日の会議を開きます。"
    );
    expect(result.speakerName).toBe("松浦崇志");
    expect(result.speakerRole).toBe("議長");
    expect(result.content).toBe("ただいまから本日の会議を開きます。");
  });

  it("町長（名前）パターンを解析する", () => {
    const result = parseSpeaker(
      "○町長（沖汐守彦） 皆さん、おはようございます。"
    );
    expect(result.speakerName).toBe("沖汐守彦");
    expect(result.speakerRole).toBe("町長");
    expect(result.content).toBe("皆さん、おはようございます。");
  });

  it("副町長（名前）パターンを解析する", () => {
    const result = parseSpeaker(
      "○副町長（榮藤雅雄） ご説明いたします。"
    );
    expect(result.speakerName).toBe("榮藤雅雄");
    expect(result.speakerRole).toBe("副町長");
    expect(result.content).toBe("ご説明いたします。");
  });

  it("部長（名前）パターンを解析する（名前に空白含む）", () => {
    const result = parseSpeaker(
      "○総務部長（森 文彰） 知事選挙と衆議院議員総選挙についてご説明します。"
    );
    expect(result.speakerName).toBe("森文彰");
    expect(result.speakerRole).toBe("部長");
    expect(result.content).toBe("知事選挙と衆議院議員総選挙についてご説明します。");
  });

  it("名前+議員 パターンを解析する", () => {
    const result = parseSpeaker(
      "○中島貞次議員 質問いたします。"
    );
    expect(result.speakerName).toBe("中島貞次");
    expect(result.speakerRole).toBe("議員");
    expect(result.content).toBe("質問いたします。");
  });

  it("名前+議員 パターン（スペースあり）を解析する", () => {
    const result = parseSpeaker(
      "○出原賢治議員 先ほどの県知事選挙の予算と今回のこの予算について質問します。"
    );
    expect(result.speakerName).toBe("出原賢治");
    expect(result.speakerRole).toBe("議員");
    expect(result.content).toBe("先ほどの県知事選挙の予算と今回のこの予算について質問します。");
  });

  it("生活福祉部長パターンを解析する", () => {
    const result = parseSpeaker(
      "○生活福祉部長（嶋津一弥） 議案第52号についてご説明いたします。"
    );
    expect(result.speakerName).toBe("嶋津一弥");
    expect(result.speakerRole).toBe("部長");
    expect(result.content).toBe("議案第52号についてご説明いたします。");
  });

  it("教育長パターンを解析する", () => {
    const result = parseSpeaker(
      "○教育長（福井照子） お答えいたします。"
    );
    expect(result.speakerName).toBe("福井照子");
    expect(result.speakerRole).toBe("教育長");
    expect(result.content).toBe("お答えいたします。");
  });

  it("○マーカーなしのテキスト", () => {
    const result = parseSpeaker("午前10時開会");
    expect(result.speakerName).toBeNull();
    expect(result.speakerRole).toBeNull();
    expect(result.content).toBe("午前10時開会");
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

  it("町長は answer", () => {
    expect(classifyKind("町長")).toBe("answer");
  });

  it("副町長は answer", () => {
    expect(classifyKind("副町長")).toBe("answer");
  });

  it("教育長は answer", () => {
    expect(classifyKind("教育長")).toBe("answer");
  });

  it("部長は answer", () => {
    expect(classifyKind("部長")).toBe("answer");
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
  it("○マーカーでテキストを分割する", () => {
    const text = `
○議長（松浦崇志） ただいまから本日の会議を開きます。
○町長（沖汐守彦） 皆さんおはようございます。
○中島貞次議員 質問いたします。
`;
    const statements = parseStatements(text);

    expect(statements).toHaveLength(3);

    expect(statements[0]!.kind).toBe("remark");
    expect(statements[0]!.speakerName).toBe("松浦崇志");
    expect(statements[0]!.speakerRole).toBe("議長");

    expect(statements[1]!.kind).toBe("answer");
    expect(statements[1]!.speakerName).toBe("沖汐守彦");
    expect(statements[1]!.speakerRole).toBe("町長");

    expect(statements[2]!.kind).toBe("question");
    expect(statements[2]!.speakerName).toBe("中島貞次");
    expect(statements[2]!.speakerRole).toBe("議員");
  });

  it("各 statement に contentHash が付与される", () => {
    const statements = parseStatements(
      "○議長（松浦崇志） ただいまから会議を開きます。"
    );
    expect(statements[0]!.contentHash).toMatch(/^[a-f0-9]{64}$/);
  });

  it("offset が正しく計算される", () => {
    const text = `○議長（松浦崇志） ただいま。
○中島貞次議員 質問です。`;

    const statements = parseStatements(text);

    expect(statements[0]!.startOffset).toBe(0);
    expect(statements[0]!.endOffset).toBe("ただいま。".length);
    expect(statements[1]!.startOffset).toBe("ただいま。".length + 1);
  });

  it("ト書き（登壇）はスキップする", () => {
    const text = `○議長（松浦崇志） ただいまから会議を開きます。
○（中島貞次君登壇）
○中島貞次議員 質問があります。`;

    const statements = parseStatements(text);
    expect(statements).toHaveLength(2);
    expect(statements[0]!.speakerRole).toBe("議長");
    expect(statements[1]!.speakerRole).toBe("議員");
  });

  it("空テキストは空配列を返す", () => {
    expect(parseStatements("")).toEqual([]);
  });

  it("行政側の役職を正しく分類する", () => {
    const text = `○副町長（榮藤雅雄） ご説明いたします。
○総務部長（森 文彰） ご報告いたします。
○生活福祉部長（嶋津一弥） 補足説明いたします。`;

    const statements = parseStatements(text);

    expect(statements).toHaveLength(3);
    expect(statements[0]!.kind).toBe("answer");
    expect(statements[0]!.speakerRole).toBe("副町長");
    expect(statements[1]!.kind).toBe("answer");
    expect(statements[1]!.speakerRole).toBe("部長");
    expect(statements[2]!.kind).toBe("answer");
    expect(statements[2]!.speakerRole).toBe("部長");
  });

  it("statements が空なら空配列を返す", () => {
    const text = "これはマーカーを含まないテキストです。";
    expect(parseStatements(text)).toEqual([]);
  });
});
