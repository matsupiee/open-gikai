import { describe, expect, it } from "vitest";
import { parseSpeaker, classifyKind, parseStatements, extractHeldOn } from "./detail";

describe("parseSpeaker", () => {
  it("議長を正しくパースする", () => {
    const result = parseSpeaker("○議長（山田太郎） 本日の会議を開きます。");
    expect(result.speakerName).toBe("山田太郎");
    expect(result.speakerRole).toBe("議長");
    expect(result.content).toBe("本日の会議を開きます。");
  });

  it("町長を正しくパースする", () => {
    const result = parseSpeaker("○町長（鈴木一郎） おはようございます。");
    expect(result.speakerName).toBe("鈴木一郎");
    expect(result.speakerRole).toBe("町長");
    expect(result.content).toBe("おはようございます。");
  });

  it("副町長を正しくパースする", () => {
    const result = parseSpeaker("○副町長（田中次郎） ご説明いたします。");
    expect(result.speakerName).toBe("田中次郎");
    expect(result.speakerRole).toBe("副町長");
    expect(result.content).toBe("ご説明いたします。");
  });

  it("番号付き議員を正しくパースする", () => {
    const result = parseSpeaker("○３番（佐藤花子） はい、議長。");
    expect(result.speakerName).toBe("佐藤花子");
    expect(result.speakerRole).toBe("議員");
    expect(result.content).toBe("はい、議長。");
  });

  it("部長（複合役職名）を正しくパースする", () => {
    const result = parseSpeaker("○総務部長（中村卓也） ご報告いたします。");
    expect(result.speakerName).toBe("中村卓也");
    expect(result.speakerRole).toBe("部長");
    expect(result.content).toBe("ご報告いたします。");
  });

  it("教育長を正しくパースする", () => {
    const result = parseSpeaker("○教育長（伊藤学） 答弁申し上げます。");
    expect(result.speakerName).toBe("伊藤学");
    expect(result.speakerRole).toBe("教育長");
    expect(result.content).toBe("答弁申し上げます。");
  });

  it("副教育長を正しくパースする", () => {
    const result = parseSpeaker("○副教育長（渡辺明） ご説明します。");
    expect(result.speakerName).toBe("渡辺明");
    expect(result.speakerRole).toBe("副教育長");
    expect(result.content).toBe("ご説明します。");
  });

  it("○マーカーのない行は speakerName・speakerRole が null", () => {
    const result = parseSpeaker("午前１０時００分 開会");
    expect(result.speakerName).toBeNull();
    expect(result.speakerRole).toBeNull();
    expect(result.content).toBe("午前１０時００分 開会");
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

  it("部長は answer", () => {
    expect(classifyKind("部長")).toBe("answer");
  });

  it("課長は answer", () => {
    expect(classifyKind("課長")).toBe("answer");
  });

  it("教育長は answer", () => {
    expect(classifyKind("教育長")).toBe("answer");
  });

  it("議員は question", () => {
    expect(classifyKind("議員")).toBe("question");
  });

  it("null は remark", () => {
    expect(classifyKind(null)).toBe("remark");
  });
});

describe("parseStatements", () => {
  it("○ マーカーで発言を正しく分割する", () => {
    const text = `
○議長（山田太郎） 本日の会議を開きます。
○町長（鈴木一郎） おはようございます。令和６年第３回定例会の開催に当たりまして。
○３番（佐藤花子） はい、議長。
    `.trim();

    const statements = parseStatements(text);

    expect(statements).toHaveLength(3);

    expect(statements[0]!.speakerName).toBe("山田太郎");
    expect(statements[0]!.speakerRole).toBe("議長");
    expect(statements[0]!.kind).toBe("remark");
    expect(statements[0]!.content).toBe("本日の会議を開きます。");

    expect(statements[1]!.speakerName).toBe("鈴木一郎");
    expect(statements[1]!.speakerRole).toBe("町長");
    expect(statements[1]!.kind).toBe("answer");

    expect(statements[2]!.speakerName).toBe("佐藤花子");
    expect(statements[2]!.speakerRole).toBe("議員");
    expect(statements[2]!.kind).toBe("question");
  });

  it("登壇のト書きをスキップする", () => {
    const text = `
○町長（鈴木一郎） はい、議長。
○町長（鈴木一郎登壇）
○町長（鈴木一郎） おはようございます。
    `.trim();

    const statements = parseStatements(text);

    // 登壇のト書きはスキップされる
    expect(statements.length).toBeLessThanOrEqual(2);
    expect(statements.some((s) => s.content === "")).toBe(false);
  });

  it("contentHash が SHA-256 で生成される", () => {
    const text = "○議長（山田太郎） 会議を開きます。";

    const statements = parseStatements(text);

    expect(statements).toHaveLength(1);
    expect(statements[0]!.contentHash).toMatch(/^[a-f0-9]{64}$/);
  });

  it("offset が正しく計算される", () => {
    const text = `○議長（山田太郎） 開会します。
○町長（鈴木一郎） ありがとう。`;

    const statements = parseStatements(text);

    expect(statements[0]!.startOffset).toBe(0);
    expect(statements[0]!.endOffset).toBe("開会します。".length);
    expect(statements[1]!.startOffset).toBe("開会します。".length + 1);
  });

  it("○ マーカーのないテキストブロックはスキップされる", () => {
    const text = `
三宅町議会会議録 令和６年９月６日開会
○議長（山田太郎） 本日の会議を開きます。
    `.trim();

    const statements = parseStatements(text);

    expect(statements).toHaveLength(1);
    expect(statements[0]!.speakerRole).toBe("議長");
  });

  it("statements が空の場合は空配列を返す", () => {
    const text = "三宅町議会会議録 令和６年第３回定例会";

    const statements = parseStatements(text);

    expect(statements).toHaveLength(0);
  });
});

describe("extractHeldOn", () => {
  it("和暦の日付から開催日を抽出する", () => {
    const text = "令和6年3月1日 三宅町議会第1回定例会";
    expect(extractHeldOn(text, 2024)).toBe("2024-03-01");
  });

  it("平成年の日付から開催日を抽出する", () => {
    const text = "平成30年12月5日 三宅町議会第4回定例会";
    expect(extractHeldOn(text, 2018)).toBe("2018-12-05");
  });

  it("西暦の日付から開催日を抽出する", () => {
    const text = "2024年6月10日 会議録";
    expect(extractHeldOn(text, 2024)).toBe("2024-06-10");
  });

  it("日付が見つからない場合は null を返す", () => {
    const text = "三宅町議会会議録";
    expect(extractHeldOn(text, 2024)).toBeNull();
  });

  it("1桁の月・日をゼロ埋めする", () => {
    const text = "令和6年9月6日 三宅町議会第3回定例会";
    expect(extractHeldOn(text, 2024)).toBe("2024-09-06");
  });
});
