import { describe, expect, it } from "vitest";
import { parseSpeaker, classifyKind, parseStatements } from "./detail";

describe("parseSpeaker", () => {
  it("議長を正しくパースする", () => {
    const result = parseSpeaker("○議長（小林 悟） ただいまから本日の会議を開きます。");
    expect(result.speakerName).toBe("小林悟");
    expect(result.speakerRole).toBe("議長");
    expect(result.content).toBe("ただいまから本日の会議を開きます。");
  });

  it("市長を正しくパースする", () => {
    const result = parseSpeaker("○市長（鈴木雄大） お答えいたします。");
    expect(result.speakerName).toBe("鈴木雄大");
    expect(result.speakerRole).toBe("市長");
    expect(result.content).toBe("お答えいたします。");
  });

  it("番号付き議員を正しくパースする", () => {
    const result = parseSpeaker("○７番（堀井克見） どうもご苦労様です。");
    expect(result.speakerName).toBe("堀井克見");
    expect(result.speakerRole).toBe("議員");
    expect(result.content).toBe("どうもご苦労様です。");
  });

  it("総務部長を正しくパースする", () => {
    const result = parseSpeaker("○総務部長（千葉秀樹） ご説明いたします。");
    expect(result.speakerName).toBe("千葉秀樹");
    expect(result.speakerRole).toBe("部長");
    expect(result.content).toBe("ご説明いたします。");
  });

  it("議会運営委員長を正しくパースする", () => {
    const result = parseSpeaker("○議会運営委員長（鈴木壮二） それでは、議会運営委員会の報告をいたします。");
    expect(result.speakerName).toBe("鈴木壮二");
    expect(result.speakerRole).toBe("委員長");
    expect(result.content).toBe("それでは、議会運営委員会の報告をいたします。");
  });

  it("副市長を正しくパースする", () => {
    const result = parseSpeaker("○副市長（鎌田雅人） ご報告申し上げます。");
    expect(result.speakerName).toBe("鎌田雅人");
    expect(result.speakerRole).toBe("副市長");
    expect(result.content).toBe("ご報告申し上げます。");
  });

  it("教育長を正しくパースする", () => {
    const result = parseSpeaker("○教育長（吉原慎一） 行政報告を申し上げます。");
    expect(result.speakerName).toBe("吉原慎一");
    expect(result.speakerRole).toBe("教育長");
    expect(result.content).toBe("行政報告を申し上げます。");
  });

  it("社会厚生常任委員長を正しくパースする", () => {
    const result = parseSpeaker("○社会厚生常任委員長（菅原理恵子） おはようございます。");
    expect(result.speakerName).toBe("菅原理恵子");
    expect(result.speakerRole).toBe("委員長");
    expect(result.content).toBe("おはようございます。");
  });

  it("全角数字の議員番号を正しくパースする", () => {
    const result = parseSpeaker("○１番（菅原理恵子） 質問いたします。");
    expect(result.speakerName).toBe("菅原理恵子");
    expect(result.speakerRole).toBe("議員");
    expect(result.content).toBe("質問いたします。");
  });

  it("カッコパターンに合致しない場合は null を返す", () => {
    const result = parseSpeaker("○開 会 令和６年９月４日");
    expect(result.speakerName).toBeNull();
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

  it("副委員長は remark", () => {
    expect(classifyKind("副委員長")).toBe("remark");
  });

  it("市長は answer", () => {
    expect(classifyKind("市長")).toBe("answer");
  });

  it("副市長は answer", () => {
    expect(classifyKind("副市長")).toBe("answer");
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
  it("○ マーカーで発言を分割して ParsedStatement 配列を返す", () => {
    const text = `
○議長（小林 悟） ただいまから本日の会議を開きます。
○市長（鈴木雄大） お答えいたします。
○７番（堀井克見） 質問いたします。
    `.trim();

    const statements = parseStatements(text);

    expect(statements).toHaveLength(3);

    expect(statements[0]!.speakerName).toBe("小林悟");
    expect(statements[0]!.speakerRole).toBe("議長");
    expect(statements[0]!.kind).toBe("remark");
    expect(statements[0]!.content).toBe("ただいまから本日の会議を開きます。");

    expect(statements[1]!.speakerName).toBe("鈴木雄大");
    expect(statements[1]!.speakerRole).toBe("市長");
    expect(statements[1]!.kind).toBe("answer");

    expect(statements[2]!.speakerName).toBe("堀井克見");
    expect(statements[2]!.speakerRole).toBe("議員");
    expect(statements[2]!.kind).toBe("question");
  });

  it("○開会 など非発言行をスキップする", () => {
    const text = `
○開 会 令和６年９月４日 午前１０：００
○散 会 午後 １：５８
○出席議員（１７名）
○欠席議員（なし）
○説明のための出席者
○議会事務局職員出席者
○議長（小林 悟） 本日の会議を開きます。
    `.trim();

    const statements = parseStatements(text);

    expect(statements).toHaveLength(1);
    expect(statements[0]!.speakerRole).toBe("議長");
  });

  it("contentHash が SHA-256 で生成される", () => {
    const text = "○議長（小林 悟） ただいまから会議を開きます。";

    const statements = parseStatements(text);

    expect(statements).toHaveLength(1);
    expect(statements[0]!.contentHash).toMatch(/^[a-f0-9]{64}$/);
  });

  it("offset が正しく計算される", () => {
    const text = "○議長（小林 悟） ただいま。\n○市長（鈴木雄大） お答えします。";

    const statements = parseStatements(text);

    expect(statements[0]!.startOffset).toBe(0);
    expect(statements[0]!.endOffset).toBe("ただいま。".length);
    expect(statements[1]!.startOffset).toBe("ただいま。".length + 1);
  });

  it("statements が空の場合は空配列を返す", () => {
    const text = "令和６年第３回潟上市議会定例会会議録";

    const statements = parseStatements(text);

    expect(statements).toHaveLength(0);
  });
});
