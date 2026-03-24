import { describe, expect, it } from "vitest";
import { parseSpeaker, classifyKind, parseStatements } from "./detail";

describe("parseSpeaker", () => {
  it("議長を正しくパースする", () => {
    const result = parseSpeaker("◯渡辺議長 ただいまから本日の会議を開きます。");
    expect(result.speakerName).toBe("渡辺");
    expect(result.speakerRole).toBe("議長");
    expect(result.content).toBe("ただいまから本日の会議を開きます。");
  });

  it("副議長を正しくパースする", () => {
    const result = parseSpeaker("◯鈴木副議長 暫時休憩いたします。");
    expect(result.speakerName).toBe("鈴木");
    expect(result.speakerRole).toBe("副議長");
    expect(result.content).toBe("暫時休憩いたします。");
  });

  it("副委員長を正しくパースする（長い方を優先）", () => {
    const result = parseSpeaker("◯佐藤副委員長 審議します。");
    expect(result.speakerName).toBe("佐藤");
    expect(result.speakerRole).toBe("副委員長");
    expect(result.content).toBe("審議します。");
  });

  it("委員長を正しくパースする", () => {
    const result = parseSpeaker("◯こしば総務委員長 ただいま議題に供されました。");
    expect(result.speakerName).toBe("こしば総務");
    expect(result.speakerRole).toBe("委員長");
    expect(result.content).toBe("ただいま議題に供されました。");
  });

  it("議員を正しくパースする", () => {
    const result = parseSpeaker("◯安藤たい作議員 質問いたします。");
    expect(result.speakerName).toBe("安藤たい作");
    expect(result.speakerRole).toBe("議員");
    expect(result.content).toBe("質問いたします。");
  });

  it("市長を正しくパースする", () => {
    const result = parseSpeaker("◯森澤市長 お答えいたします。");
    expect(result.speakerName).toBe("森澤");
    expect(result.speakerRole).toBe("市長");
    expect(result.content).toBe("お答えいたします。");
  });

  it("副市長を正しくパースする", () => {
    const result = parseSpeaker("◯田中副市長 ご説明いたします。");
    expect(result.speakerName).toBe("田中");
    expect(result.speakerRole).toBe("副市長");
    expect(result.content).toBe("ご説明いたします。");
  });

  it("部長を正しくパースする", () => {
    const result = parseSpeaker("◯山田総務部長 ご報告いたします。");
    expect(result.speakerName).toBe("山田総務");
    expect(result.speakerRole).toBe("部長");
    expect(result.content).toBe("ご報告いたします。");
  });

  it("◯マーカーなしのテキスト", () => {
    const result = parseSpeaker("午後１時開議");
    expect(result.speakerName).toBeNull();
    expect(result.speakerRole).toBeNull();
    expect(result.content).toBe("午後１時開議");
  });

  it("◯マーカーあり・役職不明の場合は名前のみ", () => {
    const result = parseSpeaker("◯田中太郎 発言します。");
    expect(result.speakerName).toBe("田中太郎");
    expect(result.speakerRole).toBeNull();
    expect(result.content).toBe("発言します。");
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

  it("部長は answer", () => {
    expect(classifyKind("部長")).toBe("answer");
  });

  it("課長は answer", () => {
    expect(classifyKind("課長")).toBe("answer");
  });

  it("議員は question", () => {
    expect(classifyKind("議員")).toBe("question");
  });

  it("委員は question", () => {
    expect(classifyKind("委員")).toBe("question");
  });

  it("null は remark", () => {
    expect(classifyKind(null)).toBe("remark");
  });
});

describe("parseStatements", () => {
  it("◯マーカー付きの発言を抽出する", () => {
    const text = `
◯渡辺議長　ただいまから本日の会議を開きます。
◯田中議員　質問いたします。
◯山田市長　お答えいたします。
    `.trim();

    const statements = parseStatements(text);

    expect(statements).toHaveLength(3);

    expect(statements[0]!.speakerName).toBe("渡辺");
    expect(statements[0]!.speakerRole).toBe("議長");
    expect(statements[0]!.kind).toBe("remark");
    expect(statements[0]!.content).toBe("ただいまから本日の会議を開きます。");

    expect(statements[1]!.speakerName).toBe("田中");
    expect(statements[1]!.speakerRole).toBe("議員");
    expect(statements[1]!.kind).toBe("question");

    expect(statements[2]!.speakerName).toBe("山田");
    expect(statements[2]!.speakerRole).toBe("市長");
    expect(statements[2]!.kind).toBe("answer");
  });

  it("contentHash が生成される", () => {
    const text = "◯渡辺議長　ただいまから会議を開きます。";
    const statements = parseStatements(text);
    expect(statements[0]!.contentHash).toMatch(/^[a-f0-9]{64}$/);
  });

  it("offset が正しく計算される", () => {
    const text = "◯渡辺議長　ただいま。\n◯田中議員　質問です。";

    const statements = parseStatements(text);
    expect(statements[0]!.startOffset).toBe(0);
    expect(statements[0]!.endOffset).toBe("ただいま。".length);
    expect(statements[1]!.startOffset).toBe("ただいま。".length + 1);
  });

  it("議事日程等の構造行はスキップする", () => {
    const text = `
◯議事日程（第1号）
　　　令和7年3月定例会
◯出席議員（14名）
◯渡辺議長　ただいまから会議を開きます。
    `.trim();

    const statements = parseStatements(text);
    expect(statements).toHaveLength(1);
    expect(statements[0]!.speakerRole).toBe("議長");
  });

  it("発言がない場合は空配列を返す", () => {
    const text = "議事日程\n令和7年3月定例会";
    const statements = parseStatements(text);
    expect(statements).toHaveLength(0);
  });
});
