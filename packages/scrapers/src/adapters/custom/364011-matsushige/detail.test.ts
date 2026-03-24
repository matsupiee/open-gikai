import { describe, expect, it } from "vitest";
import { parseSpeaker, classifyKind, parseStatements } from "./detail";

describe("parseSpeaker", () => {
  it("議長を正しくパースする", () => {
    const result = parseSpeaker("○ 田中議長 ただいまから本日の会議を開きます。");
    expect(result.speakerName).toBe("田中");
    expect(result.speakerRole).toBe("議長");
    expect(result.content).toBe("ただいまから本日の会議を開きます。");
  });

  it("町長を正しくパースする", () => {
    const result = parseSpeaker("○ 山田町長 お答えいたします。");
    expect(result.speakerName).toBe("山田");
    expect(result.speakerRole).toBe("町長");
    expect(result.content).toBe("お答えいたします。");
  });

  it("副町長を正しくパースする", () => {
    const result = parseSpeaker("○ 鈴木副町長 ご説明いたします。");
    expect(result.speakerName).toBe("鈴木");
    expect(result.speakerRole).toBe("副町長");
    expect(result.content).toBe("ご説明いたします。");
  });

  it("議員を正しくパースする", () => {
    const result = parseSpeaker("○ 佐藤一郎議員 質問いたします。");
    expect(result.speakerName).toBe("佐藤一郎");
    expect(result.speakerRole).toBe("議員");
    expect(result.content).toBe("質問いたします。");
  });

  it("副委員長を委員長より先にマッチする", () => {
    const result = parseSpeaker("○ 中村副委員長 委員会を開会します。");
    expect(result.speakerName).toBe("中村");
    expect(result.speakerRole).toBe("副委員長");
    expect(result.content).toBe("委員会を開会します。");
  });

  it("課長を正しくパースする", () => {
    const result = parseSpeaker("○ 高橋総務課長 ご説明申し上げます。");
    expect(result.speakerName).toBe("高橋総務");
    expect(result.speakerRole).toBe("課長");
    expect(result.content).toBe("ご説明申し上げます。");
  });

  it("教育長を正しくパースする", () => {
    const result = parseSpeaker("○ 伊藤教育長 ご報告いたします。");
    expect(result.speakerName).toBe("伊藤");
    expect(result.speakerRole).toBe("教育長");
    expect(result.content).toBe("ご報告いたします。");
  });

  it("○マーカーなしのテキスト", () => {
    const result = parseSpeaker("午前１０時開議");
    expect(result.speakerName).toBeNull();
    expect(result.speakerRole).toBeNull();
    expect(result.content).toBe("午前１０時開議");
  });

  it("○マーカーあり・役職不明の場合は名前のみ", () => {
    const result = parseSpeaker("○ 太郎 発言します。");
    expect(result.speakerName).toBe("太郎");
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
  it("○マーカー付き発言を抽出する", () => {
    const text = [
      "○ 田中議長 ただいまから本日の会議を開きます。",
      "○ 佐藤一郎議員 質問いたします。",
      "○ 山田町長 お答えいたします。",
    ].join("\n");

    const statements = parseStatements(text);

    expect(statements).toHaveLength(3);

    expect(statements[0]!.speakerName).toBe("田中");
    expect(statements[0]!.speakerRole).toBe("議長");
    expect(statements[0]!.kind).toBe("remark");
    expect(statements[0]!.content).toBe("ただいまから本日の会議を開きます。");

    expect(statements[1]!.speakerName).toBe("佐藤一郎");
    expect(statements[1]!.speakerRole).toBe("議員");
    expect(statements[1]!.kind).toBe("question");

    expect(statements[2]!.speakerName).toBe("山田");
    expect(statements[2]!.speakerRole).toBe("町長");
    expect(statements[2]!.kind).toBe("answer");
  });

  it("各 statement に contentHash が付与される", () => {
    const text = "○ 田中議長 ただいまから会議を開きます。";
    const statements = parseStatements(text);

    expect(statements).toHaveLength(1);
    expect(statements[0]!.contentHash).toMatch(/^[a-f0-9]{64}$/);
  });

  it("offset が正しく計算される", () => {
    const text = [
      "○ 田中議長 ただいま。",
      "○ 鈴木議員 質問です。",
    ].join("\n");

    const statements = parseStatements(text);

    expect(statements[0]!.startOffset).toBe(0);
    expect(statements[0]!.endOffset).toBe("ただいま。".length);
    expect(statements[1]!.startOffset).toBe("ただいま。".length + 1);
  });

  it("複数行にまたがる発言をまとめる", () => {
    const text = [
      "○ 田中議長 ただいまから本日の会議を",
      "開きます。どうぞよろしくお願いします。",
      "○ 鈴木議員 続けて質問します。",
    ].join("\n");

    const statements = parseStatements(text);

    expect(statements).toHaveLength(2);
    expect(statements[0]!.content).toContain("ただいまから本日の会議を");
    expect(statements[0]!.content).toContain("開きます。どうぞよろしくお願いします。");
  });

  it("空テキストは空配列を返す", () => {
    expect(parseStatements("")).toEqual([]);
  });

  it("○マーカーなし行（表紙等）はスキップする", () => {
    const text = [
      "松茂町議会会議録",
      "令和７年第４回定例会",
      "令和７年１２月４日",
      "○ 田中議長 ただいまから開会します。",
    ].join("\n");

    const statements = parseStatements(text);

    expect(statements).toHaveLength(1);
    expect(statements[0]!.speakerRole).toBe("議長");
  });
});
