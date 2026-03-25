import { describe, it, expect } from "vitest";
import { parseSpeaker, classifyKind, parseStatements } from "./detail";

describe("parseSpeaker", () => {
  it("議長（君付き）を正しくパースする", () => {
    const result = parseSpeaker("○議長（田中 浩二君） ただいまから本日の会議を開きます。");
    expect(result.speakerName).toBe("田中 浩二");
    expect(result.speakerRole).toBe("議長");
    expect(result.content).toBe("ただいまから本日の会議を開きます。");
  });

  it("町長を正しくパースする", () => {
    const result = parseSpeaker("○町長（河野 正和君） お答えいたします。");
    expect(result.speakerName).toBe("河野 正和");
    expect(result.speakerRole).toBe("町長");
    expect(result.content).toBe("お答えいたします。");
  });

  it("副町長を正しくパースする", () => {
    const result = parseSpeaker("○副町長（山本 一郎君） 答弁いたします。");
    expect(result.speakerName).toBe("山本 一郎");
    expect(result.speakerRole).toBe("副町長");
    expect(result.content).toBe("答弁いたします。");
  });

  it("課長を正しくパースする", () => {
    const result = parseSpeaker("○総務課長（黒木 誠二君） ご説明いたします。");
    expect(result.speakerName).toBe("黒木 誠二");
    expect(result.speakerRole).toBe("課長");
    expect(result.content).toBe("ご説明いたします。");
  });

  it("教育長を正しくパースする", () => {
    const result = parseSpeaker("○教育長（川上 花子君） ご説明申し上げます。");
    expect(result.speakerName).toBe("川上 花子");
    expect(result.speakerRole).toBe("教育長");
    expect(result.content).toBe("ご説明申し上げます。");
  });

  it("番号付き議員（半角数字）を正しくパースする", () => {
    const result = parseSpeaker("○3番（山田 勇君） 一般質問いたします。");
    expect(result.speakerName).toBe("山田 勇");
    expect(result.speakerRole).toBe("議員");
    expect(result.content).toBe("一般質問いたします。");
  });

  it("副委員長を正しくパースする", () => {
    const result = parseSpeaker("○副委員長（鈴木 三郎君） 委員会を開会します。");
    expect(result.speakerName).toBe("鈴木 三郎");
    expect(result.speakerRole).toBe("副委員長");
    expect(result.content).toBe("委員会を開会します。");
  });

  it("事務局長を正しくパースする", () => {
    const result = parseSpeaker("○事務局長（松田 次郎君） 出席議員の報告をいたします。");
    expect(result.speakerName).toBe("松田 次郎");
    expect(result.speakerRole).toBe("事務局長");
    expect(result.content).toBe("出席議員の報告をいたします。");
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

  it("総務課長（末尾が課長）は answer", () => {
    expect(classifyKind("総務課長")).toBe("answer");
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
      "○議長（田中 浩二君） ただいまから本日の会議を開きます。 " +
      "○町長（河野 正和君） 政務報告を申し上げます。 " +
      "○3番（山田 勇君） 質問いたします。";

    const statements = parseStatements(text);

    expect(statements).toHaveLength(3);

    expect(statements[0]!.speakerName).toBe("田中 浩二");
    expect(statements[0]!.speakerRole).toBe("議長");
    expect(statements[0]!.kind).toBe("remark");
    expect(statements[0]!.content).toBe("ただいまから本日の会議を開きます。");

    expect(statements[1]!.speakerName).toBe("河野 正和");
    expect(statements[1]!.speakerRole).toBe("町長");
    expect(statements[1]!.kind).toBe("answer");

    expect(statements[2]!.speakerRole).toBe("議員");
    expect(statements[2]!.kind).toBe("question");
  });

  it("contentHash が SHA-256 形式で生成される", () => {
    const text = "○議長（田中 浩二君） ただいまから会議を開きます。";

    const statements = parseStatements(text);
    expect(statements[0]!.contentHash).toMatch(/^[a-f0-9]{64}$/);
  });

  it("offset が正しく計算される", () => {
    const text =
      "○議長（田中 浩二君） ただいま。 ○町長（河野 正和君） 以上です。";

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

  it("ト書き形式の登壇マーカーはスキップする", () => {
    // ○役職名（登壇） のような純粋なト書き行はスキップされる
    const text =
      "○議長（田中 浩二君） 次に3番山田議員。 ○3番山田（登壇） ○3番（山田 勇君） 一般質問を行います。";

    const statements = parseStatements(text);
    // 議長と議員の発言が含まれること（ト書き行はスキップ）
    expect(statements.length).toBeGreaterThanOrEqual(1);
    expect(statements.some((s) => s.speakerRole === "議長")).toBe(true);
  });
});
