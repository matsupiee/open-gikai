import { describe, expect, it } from "vitest";
import { parseSpeakerHeader, classifyKind, parseStatements } from "./detail";

describe("parseSpeakerHeader", () => {
  it("議長パターンを解析する", () => {
    const result = parseSpeakerHeader("喜田議長");
    expect(result.speakerName).toBe("喜田");
    expect(result.speakerRole).toBe("議長");
  });

  it("町長パターンを解析する", () => {
    const result = parseSpeakerHeader("枡富町長");
    expect(result.speakerName).toBe("枡富");
    expect(result.speakerRole).toBe("町長");
  });

  it("副町長パターンを解析する", () => {
    const result = parseSpeakerHeader("山田副町長");
    expect(result.speakerName).toBe("山田");
    expect(result.speakerRole).toBe("副町長");
  });

  it("教育長パターンを解析する", () => {
    const result = parseSpeakerHeader("今津教育長");
    expect(result.speakerName).toBe("今津");
    expect(result.speakerRole).toBe("教育長");
  });

  it("議員パターンを解析する", () => {
    const result = parseSpeakerHeader("木本議員");
    expect(result.speakerName).toBe("木本");
    expect(result.speakerRole).toBe("議員");
  });

  it("課長パターン（部署名付き）を解析する", () => {
    const result = parseSpeakerHeader("総務課長");
    expect(result.speakerName).toBe("総務");
    expect(result.speakerRole).toBe("課長");
  });

  it("副委員長パターンを副委員長として解析する（委員長より長い方を優先）", () => {
    const result = parseSpeakerHeader("田中副委員長");
    expect(result.speakerName).toBe("田中");
    expect(result.speakerRole).toBe("副委員長");
  });

  it("マッチしない場合はnullを返す", () => {
    const result = parseSpeakerHeader("ただいまから");
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

  it("理事は answer", () => {
    expect(classifyKind("理事")).toBe("answer");
  });

  it("議員は question", () => {
    expect(classifyKind("議員")).toBe("question");
  });

  it("null は remark", () => {
    expect(classifyKind(null)).toBe("remark");
  });
});

describe("parseStatements", () => {
  it("牟岐町形式の発言テキストを分割する", () => {
    const text =
      "木本議員 皆様、おはようございます。質問いたします。 喜田議長 枡富町長。 枡富町長 お答えします。以上です。";
    const statements = parseStatements(text);

    expect(statements.length).toBeGreaterThanOrEqual(2);

    const giin = statements.find((s) => s.speakerRole === "議員");
    expect(giin).toBeDefined();
    expect(giin!.speakerName).toBe("木本");
    expect(giin!.kind).toBe("question");

    const chocho = statements.find((s) => s.speakerRole === "町長");
    expect(chocho).toBeDefined();
    expect(chocho!.speakerName).toBe("枡富");
    expect(chocho!.kind).toBe("answer");
  });

  it("各 statement に contentHash が付与される", () => {
    const text = "木本議員 テスト発言。";
    const statements = parseStatements(text);
    if (statements.length > 0) {
      expect(statements[0]!.contentHash).toMatch(/^[a-f0-9]{64}$/);
    }
  });

  it("空テキストは空配列を返す", () => {
    expect(parseStatements("")).toEqual([]);
  });

  it("教育長は answer に分類される", () => {
    const text = "今津教育長 お答えいたします。ご説明申し上げます。";
    const statements = parseStatements(text);
    const kyoiku = statements.find((s) => s.speakerRole === "教育長");
    if (kyoiku) {
      expect(kyoiku.kind).toBe("answer");
      expect(kyoiku.speakerName).toBe("今津");
    }
  });
});
