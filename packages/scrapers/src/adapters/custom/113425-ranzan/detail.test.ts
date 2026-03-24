import { describe, expect, it } from "vitest";
import { classifyKind, parseSpeaker, parseStatements } from "./detail";

describe("parseSpeaker", () => {
  it("議長を正しくパースする", () => {
    const result = parseSpeaker("○議長（山田太郎） ただいまから本日の会議を開きます。");
    expect(result.speakerName).toBe("山田太郎");
    expect(result.speakerRole).toBe("議長");
    expect(result.content).toBe("ただいまから本日の会議を開きます。");
  });

  it("町長を正しくパースする", () => {
    const result = parseSpeaker("○町長（鈴木一郎） お答えいたします。");
    expect(result.speakerName).toBe("鈴木一郎");
    expect(result.speakerRole).toBe("町長");
    expect(result.content).toBe("お答えいたします。");
  });

  it("番号付き議員（半角数字）を正しくパースする", () => {
    const result = parseSpeaker("○3番（佐藤花子） 質問いたします。");
    expect(result.speakerName).toBe("佐藤花子");
    expect(result.speakerRole).toBe("議員");
    expect(result.content).toBe("質問いたします。");
  });

  it("番号付き議員（全角数字）を正しくパースする", () => {
    const result = parseSpeaker("○３番（佐藤花子） 質問いたします。");
    expect(result.speakerName).toBe("佐藤花子");
    expect(result.speakerRole).toBe("議員");
    expect(result.content).toBe("質問いたします。");
  });

  it("副町長を正しくパースする", () => {
    const result = parseSpeaker("○副町長（高橋次郎） ご報告申し上げます。");
    expect(result.speakerName).toBe("高橋次郎");
    expect(result.speakerRole).toBe("副町長");
    expect(result.content).toBe("ご報告申し上げます。");
  });

  it("総務課長を正しくパースする", () => {
    const result = parseSpeaker("○総務課長（伊藤三郎） ご説明いたします。");
    expect(result.speakerName).toBe("伊藤三郎");
    expect(result.speakerRole).toBe("課長");
    expect(result.content).toBe("ご説明いたします。");
  });

  it("副委員長は委員長と区別される", () => {
    const result = parseSpeaker("○副委員長（田中四郎） 続けます。");
    expect(result.speakerName).toBe("田中四郎");
    expect(result.speakerRole).toBe("副委員長");
  });

  it("議会運営委員長を正しくパースする", () => {
    const result = parseSpeaker("○議会運営委員長（中村五郎） 報告いたします。");
    expect(result.speakerName).toBe("中村五郎");
    expect(result.speakerRole).toBe("委員長");
  });

  it("名前に空白を含む場合は除去される", () => {
    const result = parseSpeaker("○議長（山田　太郎） 開会します。");
    expect(result.speakerName).toBe("山田太郎");
  });

  it("カッコパターンに合致しない場合は null を返す", () => {
    const result = parseSpeaker("○開会 午前10時");
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
  it("○ マーカーで発言を分割して ParsedStatement 配列を返す", () => {
    const text = `
○議長（山田太郎） ただいまから本日の会議を開きます。
○町長（鈴木一郎） お答えいたします。
○3番（佐藤花子） 質問いたします。
    `.trim();

    const statements = parseStatements(text);

    expect(statements).toHaveLength(3);

    expect(statements[0]!.speakerName).toBe("山田太郎");
    expect(statements[0]!.speakerRole).toBe("議長");
    expect(statements[0]!.kind).toBe("remark");
    expect(statements[0]!.content).toBe("ただいまから本日の会議を開きます。");

    expect(statements[1]!.speakerName).toBe("鈴木一郎");
    expect(statements[1]!.speakerRole).toBe("町長");
    expect(statements[1]!.kind).toBe("answer");

    expect(statements[2]!.speakerName).toBe("佐藤花子");
    expect(statements[2]!.speakerRole).toBe("議員");
    expect(statements[2]!.kind).toBe("question");
  });

  it("○開会など非発言行をスキップする", () => {
    const text = `
○開 会 令和６年９月４日 午前１０：００
○散 会 午後 １：５８
○出席議員（１２名）
○欠席議員（なし）
○説明のための出席者
○議会事務局職員出席者
○議長（山田太郎） 本日の会議を開きます。
    `.trim();

    const statements = parseStatements(text);

    expect(statements).toHaveLength(1);
    expect(statements[0]!.speakerRole).toBe("議長");
  });

  it("contentHash が SHA-256 で生成される", () => {
    const text = "○議長（山田太郎） ただいまから会議を開きます。";

    const statements = parseStatements(text);

    expect(statements).toHaveLength(1);
    expect(statements[0]!.contentHash).toMatch(/^[a-f0-9]{64}$/);
  });

  it("offset が正しく計算される", () => {
    const text =
      "○議長（山田太郎） ただいま。\n○町長（鈴木一郎） お答えします。";

    const statements = parseStatements(text);

    expect(statements[0]!.startOffset).toBe(0);
    expect(statements[0]!.endOffset).toBe("ただいま。".length);
    expect(statements[1]!.startOffset).toBe("ただいま。".length + 1);
  });

  it("statements が空の場合は空配列を返す", () => {
    const text = "令和６年第３回嵐山町議会定例会会議録";

    const statements = parseStatements(text);

    expect(statements).toHaveLength(0);
  });

  it("フォームフィード文字が除去される", () => {
    const text = "○議長（山田太郎） ただいまから\x0c会議を開きます。";

    const statements = parseStatements(text);

    expect(statements).toHaveLength(1);
    expect(statements[0]!.content).not.toContain("\x0c");
  });
});
