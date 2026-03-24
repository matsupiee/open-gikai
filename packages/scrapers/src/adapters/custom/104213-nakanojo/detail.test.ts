import { describe, expect, it } from "vitest";
import { parseSpeaker, classifyKind, parseStatements } from "./detail";

describe("parseSpeaker", () => {
  it("議長を正しくパースする（〇マーカー）", () => {
    // pdftotext は〇（U+3007）を使用する
    const result = parseSpeaker("〇議長（安原賢一）みなさん、おはようございます。");
    expect(result.speakerName).toBe("安原賢一");
    expect(result.speakerRole).toBe("議長");
    expect(result.content).toBe("みなさん、おはようございます。");
  });

  it("議長を正しくパースする（○マーカー）", () => {
    // ○（U+25CB）も対応
    const result = parseSpeaker("○議長（安原賢一）みなさん、おはようございます。");
    expect(result.speakerName).toBe("安原賢一");
    expect(result.speakerRole).toBe("議長");
    expect(result.content).toBe("みなさん、おはようございます。");
  });

  it("町長を正しくパースする", () => {
    const result = parseSpeaker("〇町長（外丸茂樹）それでは、日程に従いまして進めます。");
    expect(result.speakerName).toBe("外丸茂樹");
    expect(result.speakerRole).toBe("町長");
    expect(result.content).toBe("それでは、日程に従いまして進めます。");
  });

  it("教育長を正しくパースする", () => {
    const result = parseSpeaker("〇教育長（山口暁夫）それでは、山本修議員の質問にお答えいたします。");
    expect(result.speakerName).toBe("山口暁夫");
    expect(result.speakerRole).toBe("教育長");
    expect(result.content).toBe("それでは、山本修議員の質問にお答えいたします。");
  });

  it("議員番号パターンを正しくパースする（全角数字）", () => {
    const result = parseSpeaker("〇３番（山本修）詳しいご説明いただきまして、ありがとうございます。");
    expect(result.speakerName).toBe("山本修");
    expect(result.speakerRole).toBe("議員");
    expect(result.content).toBe("詳しいご説明いただきまして、ありがとうございます。");
  });

  it("２桁の議員番号もパースする", () => {
    const result = parseSpeaker("〇１０番（田中太郎）質問します。");
    expect(result.speakerName).toBe("田中太郎");
    expect(result.speakerRole).toBe("議員");
    expect(result.content).toBe("質問します。");
  });

  it("副町長を正しくパースする", () => {
    const result = parseSpeaker("〇副町長（鈴木一郎）お答えいたします。");
    expect(result.speakerName).toBe("鈴木一郎");
    expect(result.speakerRole).toBe("副町長");
    expect(result.content).toBe("お答えいたします。");
  });

  it("課長を正しくパースする（複合役職名）", () => {
    const result = parseSpeaker("〇総務課長（高橋次郎）ご報告いたします。");
    expect(result.speakerName).toBe("高橋次郎");
    expect(result.speakerRole).toBe("課長");
    expect(result.content).toBe("ご報告いたします。");
  });

  it("副委員長を正しくパースする（長い方を優先）", () => {
    const result = parseSpeaker("〇副委員長（佐藤三郎）審議いたします。");
    expect(result.speakerName).toBe("佐藤三郎");
    expect(result.speakerRole).toBe("副委員長");
    expect(result.content).toBe("審議いたします。");
  });

  it("半角数字の議員番号もパースする", () => {
    const result = parseSpeaker("〇1番（山本修）質問します。");
    expect(result.speakerName).toBe("山本修");
    expect(result.speakerRole).toBe("議員");
    expect(result.content).toBe("質問します。");
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

  it("部長は answer", () => {
    expect(classifyKind("部長")).toBe("answer");
  });

  it("複合役職（総務課長）は answer", () => {
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
  it("発言者行から発言を抽出する（〇マーカー）", () => {
    // pdftotext 出力は〇（U+3007）を使用する
    const text = [
      "〇議長（安原賢一）ただいまから本日の会議を開きます。",
      "〇３番（山本修）質問いたします。",
      "〇町長（外丸茂樹）お答えいたします。",
    ].join("\n");

    const statements = parseStatements(text);

    expect(statements).toHaveLength(3);

    expect(statements[0]!.speakerName).toBe("安原賢一");
    expect(statements[0]!.speakerRole).toBe("議長");
    expect(statements[0]!.kind).toBe("remark");
    expect(statements[0]!.content).toBe("ただいまから本日の会議を開きます。");

    expect(statements[1]!.speakerName).toBe("山本修");
    expect(statements[1]!.speakerRole).toBe("議員");
    expect(statements[1]!.kind).toBe("question");

    expect(statements[2]!.speakerName).toBe("外丸茂樹");
    expect(statements[2]!.speakerRole).toBe("町長");
    expect(statements[2]!.kind).toBe("answer");
  });

  it("複数行にわたる発言をまとめる", () => {
    const text = [
      "〇議長（安原賢一）ただいまから",
      "本日の会議を",
      "開きます。",
      "〇３番（山本修）質問します。",
    ].join("\n");

    const statements = parseStatements(text);

    expect(statements).toHaveLength(2);
    expect(statements[0]!.content).toContain("ただいまから");
    expect(statements[0]!.content).toContain("本日の会議を");
    expect(statements[0]!.content).toContain("開きます。");
  });

  it("contentHash が生成される", () => {
    const text = "〇議長（安原賢一）ただいまから会議を開きます。";
    const statements = parseStatements(text);
    expect(statements[0]!.contentHash).toMatch(/^[a-f0-9]{64}$/);
  });

  it("発言者がいない場合は空配列を返す", () => {
    const text = "議事日程\n第1 開会\n第2 議案審議";
    const statements = parseStatements(text);
    expect(statements).toHaveLength(0);
  });

  it("セクション区切り線は無視する", () => {
    const text = [
      "〇議長（安原賢一）ただいまから会議を開きます。",
      "──────────────── ○ ────────────────",
      "〇３番（山本修）質問いたします。",
    ].join("\n");

    const statements = parseStatements(text);
    expect(statements).toHaveLength(2);
  });

  it("startOffset と endOffset が設定される", () => {
    const text = "〇議長（安原賢一）開会します。〇町長（外丸茂樹）お答えします。";
    const statements = parseStatements(text);

    expect(statements).toHaveLength(2);
    expect(statements[0]!.startOffset).toBe(0);
    expect(statements[0]!.endOffset).toBeGreaterThan(0);
    expect(statements[1]!.startOffset).toBeGreaterThan(statements[0]!.endOffset);
  });

  it("実際の pdftotext 出力パターンを正しく解析する", () => {
    const text = [
      "〇１番（原沢香司）それでは、通告に基づきまして、３点について質問をいたします。",
      " 最初に、令和の米騒動について伺います。",
      "〇町長（外丸茂樹）お答えいたします。",
      "○議長（安原賢一）町長",
    ].join("\n");

    const statements = parseStatements(text);

    expect(statements).toHaveLength(3);
    expect(statements[0]!.speakerRole).toBe("議員");
    expect(statements[0]!.speakerName).toBe("原沢香司");
    expect(statements[1]!.speakerRole).toBe("町長");
    expect(statements[2]!.speakerRole).toBe("議長");
  });
});
