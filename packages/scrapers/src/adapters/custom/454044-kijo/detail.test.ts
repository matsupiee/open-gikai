import { describe, it, expect } from "vitest";
import { parseSpeaker, classifyKind, parseStatements } from "./detail";

describe("parseSpeaker", () => {
  it("議長（君なし）を正しくパースする", () => {
    const result = parseSpeaker("○議長（甲斐 政治） ただいまから本日の会議を開きます。");
    expect(result.speakerName).toBe("甲斐 政治");
    expect(result.speakerRole).toBe("議長");
    expect(result.content).toBe("ただいまから本日の会議を開きます。");
  });

  it("町長（君付き）を正しくパースする", () => {
    const result = parseSpeaker("○町長（半渡 英俊君） お答えいたします。");
    expect(result.speakerName).toBe("半渡 英俊");
    expect(result.speakerRole).toBe("町長");
    expect(result.content).toBe("お答えいたします。");
  });

  it("番号付き議員を正しくパースする", () => {
    const result = parseSpeaker("○議員（５番 桑原 勝広君） 質問いたします。");
    expect(result.speakerName).toBe("桑原 勝広");
    expect(result.speakerRole).toBe("議員");
    expect(result.content).toBe("質問いたします。");
  });

  it("課長を正しくパースする", () => {
    const result = parseSpeaker("○地域政策課長（壱岐 和寿君） ご説明いたします。");
    expect(result.speakerName).toBe("壱岐 和寿");
    expect(result.speakerRole).toBe("課長");
    expect(result.content).toBe("ご説明いたします。");
  });

  it("事務局長を正しくパースする", () => {
    const result = parseSpeaker("○事務局長（三隅 秀俊君） 皆様、おはようございます。");
    expect(result.speakerName).toBe("三隅 秀俊");
    expect(result.speakerRole).toBe("事務局長");
    expect(result.content).toBe("皆様、おはようございます。");
  });

  it("教育長を正しくパースする", () => {
    const result = parseSpeaker("○教育長（恵利 修二君） ご説明申し上げます。");
    expect(result.speakerName).toBe("恵利 修二");
    expect(result.speakerRole).toBe("教育長");
    expect(result.content).toBe("ご説明申し上げます。");
  });

  it("副町長を正しくパースする", () => {
    const result = parseSpeaker("○副町長（萩原 一也君） 答弁いたします。");
    expect(result.speakerName).toBe("萩原 一也");
    expect(result.speakerRole).toBe("副町長");
    expect(result.content).toBe("答弁いたします。");
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

  it("事務局長は answer", () => {
    expect(classifyKind("事務局長")).toBe("answer");
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
      "○議長（甲斐 政治） ただいまから本日の会議を開きます。 " +
      "○町長（半渡 英俊君） 政務報告を申し上げます。 " +
      "○議員（５番 桑原 勝広君） 質問いたします。";

    const statements = parseStatements(text);

    expect(statements).toHaveLength(3);

    expect(statements[0]!.speakerName).toBe("甲斐 政治");
    expect(statements[0]!.speakerRole).toBe("議長");
    expect(statements[0]!.kind).toBe("remark");
    expect(statements[0]!.content).toBe("ただいまから本日の会議を開きます。");

    expect(statements[1]!.speakerName).toBe("半渡 英俊");
    expect(statements[1]!.speakerRole).toBe("町長");
    expect(statements[1]!.kind).toBe("answer");

    expect(statements[2]!.speakerName).toBe("桑原 勝広");
    expect(statements[2]!.speakerRole).toBe("議員");
    expect(statements[2]!.kind).toBe("question");
  });

  it("空の content はスキップする", () => {
    const text = "前置きテキスト ○議長（甲斐 政治） 会議を開きます。";

    const statements = parseStatements(text);
    expect(statements).toHaveLength(1);
  });

  it("contentHash が SHA-256 形式で生成される", () => {
    const text = "○議長（甲斐 政治） ただいまから会議を開きます。";

    const statements = parseStatements(text);
    expect(statements[0]!.contentHash).toMatch(/^[a-f0-9]{64}$/);
  });

  it("offset が正しく計算される", () => {
    const text = "○議長（甲斐 政治） ただいま。 ○町長（半渡 英俊君） 以上です。";

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
});
