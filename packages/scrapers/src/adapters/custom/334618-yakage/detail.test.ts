import { describe, it, expect } from "vitest";
import { parseSpeaker, classifyKind, parseStatements } from "./detail";

describe("parseSpeaker", () => {
  it("議長（君付き）を正しくパースする", () => {
    const result = parseSpeaker("○議長（山田 太郎君） ただいまから本日の会議を開きます。");
    expect(result.speakerName).toBe("山田 太郎");
    expect(result.speakerRole).toBe("議長");
    expect(result.content).toBe("ただいまから本日の会議を開きます。");
  });

  it("町長（君付き）を正しくパースする", () => {
    const result = parseSpeaker("○町長（鈴木 一郎君） お答えいたします。");
    expect(result.speakerName).toBe("鈴木 一郎");
    expect(result.speakerRole).toBe("町長");
    expect(result.content).toBe("お答えいたします。");
  });

  it("副町長を正しくパースする", () => {
    const result = parseSpeaker("○副町長（田中 次郎君） 答弁いたします。");
    expect(result.speakerName).toBe("田中 次郎");
    expect(result.speakerRole).toBe("副町長");
    expect(result.content).toBe("答弁いたします。");
  });

  it("課長を正しくパースする（役職名付き）", () => {
    const result = parseSpeaker("○総務課長（中村 三郎君） ご説明いたします。");
    expect(result.speakerName).toBe("中村 三郎");
    expect(result.speakerRole).toBe("課長");
    expect(result.content).toBe("ご説明いたします。");
  });

  it("教育長を正しくパースする", () => {
    const result = parseSpeaker("○教育長（高橋 四郎君） ご説明申し上げます。");
    expect(result.speakerName).toBe("高橋 四郎");
    expect(result.speakerRole).toBe("教育長");
    expect(result.content).toBe("ご説明申し上げます。");
  });

  it("番号付き議員（半角数字）を正しくパースする", () => {
    const result = parseSpeaker("○3番（田中 二郎君） 質問いたします。");
    expect(result.speakerName).toBe("田中 二郎");
    expect(result.speakerRole).toBe("議員");
    expect(result.content).toBe("質問いたします。");
  });

  it("番号付き議員（全角数字）を正しくパースする", () => {
    const result = parseSpeaker("○５番（佐藤 五郎君） 一般質問いたします。");
    expect(result.speakerName).toBe("佐藤 五郎");
    expect(result.speakerRole).toBe("議員");
    expect(result.content).toBe("一般質問いたします。");
  });

  it("副議長を正しくパースする", () => {
    const result = parseSpeaker("○副議長（渡辺 六郎君） 会議を続けます。");
    expect(result.speakerName).toBe("渡辺 六郎");
    expect(result.speakerRole).toBe("副議長");
    expect(result.content).toBe("会議を続けます。");
  });

  it("副委員長を正しくパースする", () => {
    const result = parseSpeaker("○副委員長（伊藤 七郎君） 委員会を開会します。");
    expect(result.speakerName).toBe("伊藤 七郎");
    expect(result.speakerRole).toBe("副委員長");
    expect(result.content).toBe("委員会を開会します。");
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
  it("○ マーカーで発言を分割する", () => {
    const text =
      "○議長（山田 太郎君） ただいまから本日の会議を開きます。 " +
      "○町長（鈴木 一郎君） 政務報告を申し上げます。 " +
      "○3番（田中 二郎君） 質問いたします。";

    const statements = parseStatements(text);

    expect(statements).toHaveLength(3);

    expect(statements[0]!.speakerName).toBe("山田 太郎");
    expect(statements[0]!.speakerRole).toBe("議長");
    expect(statements[0]!.kind).toBe("remark");
    expect(statements[0]!.content).toBe("ただいまから本日の会議を開きます。");

    expect(statements[1]!.speakerName).toBe("鈴木 一郎");
    expect(statements[1]!.speakerRole).toBe("町長");
    expect(statements[1]!.kind).toBe("answer");

    expect(statements[2]!.speakerRole).toBe("議員");
    expect(statements[2]!.kind).toBe("question");
  });

  it("contentHash が SHA-256 形式で生成される", () => {
    const text = "○議長（山田 太郎君） ただいまから会議を開きます。";

    const statements = parseStatements(text);
    expect(statements[0]!.contentHash).toMatch(/^[a-f0-9]{64}$/);
  });

  it("offset が正しく計算される", () => {
    const text = "○議長（山田 太郎君） ただいま。 ○町長（鈴木 一郎君） 以上です。";

    const statements = parseStatements(text);
    expect(statements[0]!.startOffset).toBe(0);
    expect(statements[0]!.endOffset).toBe("ただいま。".length);
    expect(statements[1]!.startOffset).toBe("ただいま。".length + 1);
  });

  it("発言が0件の場合は空配列を返す", () => {
    const text = "ページヘッダー 日程第１ 開会";

    const statements = parseStatements(text);
    expect(statements).toHaveLength(0);
  });

  it("空の content はスキップする", () => {
    const text = "前置きテキスト ○議長（山田 太郎君） 会議を開きます。";

    const statements = parseStatements(text);
    expect(statements).toHaveLength(1);
  });
});
