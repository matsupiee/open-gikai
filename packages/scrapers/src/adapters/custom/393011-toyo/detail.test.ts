import { describe, it, expect } from "vitest";
import { parseSpeaker, classifyKind, parseStatements } from "./detail";

describe("parseSpeaker", () => {
  it("カッコ形式: 議長（名前君）を解析する", () => {
    const result = parseSpeaker("○議長（山田太郎君） ただいまから会議を開きます。");
    expect(result.speakerName).toBe("山田太郎");
    expect(result.speakerRole).toBe("議長");
    expect(result.content).toBe("ただいまから会議を開きます。");
  });

  it("カッコ形式: 町長（名前君）を解析する", () => {
    const result = parseSpeaker("○町長（鈴木一郎君） お答えいたします。");
    expect(result.speakerName).toBe("鈴木一郎");
    expect(result.speakerRole).toBe("町長");
    expect(result.content).toBe("お答えいたします。");
  });

  it("カッコ形式: 番号議員パターンを解析する", () => {
    const result = parseSpeaker("○1番（田中花子君） 質問いたします。");
    expect(result.speakerName).toBe("田中花子");
    expect(result.speakerRole).toBe("議員");
    expect(result.content).toBe("質問いたします。");
  });

  it("カッコ形式: 副町長を解析する", () => {
    const result = parseSpeaker("○副町長（佐藤次郎君） ご説明いたします。");
    expect(result.speakerName).toBe("佐藤次郎");
    expect(result.speakerRole).toBe("副町長");
    expect(result.content).toBe("ご説明いたします。");
  });

  it("カッコ形式: 教育長を解析する", () => {
    const result = parseSpeaker("○教育長（中村三郎君） 答弁いたします。");
    expect(result.speakerName).toBe("中村三郎");
    expect(result.speakerRole).toBe("教育長");
    expect(result.content).toBe("答弁いたします。");
  });

  it("カッコ形式: 課長を解析する", () => {
    const result = parseSpeaker("○総務課長（山田花子君） ご説明いたします。");
    expect(result.speakerName).toBe("山田花子");
    expect(result.speakerRole).toBe("課長");
    expect(result.content).toBe("ご説明いたします。");
  });

  it("副委員長が委員長より優先される", () => {
    const result = parseSpeaker("○副委員長（田中次郎君） ご報告いたします。");
    expect(result.speakerRole).toBe("副委員長");
  });

  it("○ マーカーなしのテキスト", () => {
    const result = parseSpeaker("午後１時開議");
    expect(result.speakerName).toBeNull();
    expect(result.speakerRole).toBeNull();
    expect(result.content).toBe("午後１時開議");
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
  it("○ マーカーありのカッコ形式の発言を分割する", () => {
    const text = `○議長（山田太郎君） ただいまから会議を開きます。○1番（田中花子君） 質問があります。○町長（鈴木一郎君） お答えします。`;
    const statements = parseStatements(text);

    expect(statements).toHaveLength(3);

    expect(statements[0]!.kind).toBe("remark");
    expect(statements[0]!.speakerName).toBe("山田太郎");
    expect(statements[0]!.speakerRole).toBe("議長");

    expect(statements[1]!.kind).toBe("question");
    expect(statements[1]!.speakerName).toBe("田中花子");
    expect(statements[1]!.speakerRole).toBe("議員");

    expect(statements[2]!.kind).toBe("answer");
    expect(statements[2]!.speakerName).toBe("鈴木一郎");
    expect(statements[2]!.speakerRole).toBe("町長");
  });

  it("○ マーカーなしのテキストは単一の remark として扱う", () => {
    const text = "令和7年第1回定例会 日程第1 会議録の承認 可決";

    const statements = parseStatements(text);

    expect(statements).toHaveLength(1);
    expect(statements[0]!.kind).toBe("remark");
    expect(statements[0]!.speakerName).toBeNull();
    expect(statements[0]!.speakerRole).toBeNull();
    expect(statements[0]!.startOffset).toBe(0);
  });

  it("各 statement に contentHash が付与される", () => {
    const statements = parseStatements("○議長（山田太郎君） テスト発言。");
    expect(statements[0]!.contentHash).toMatch(/^[a-f0-9]{64}$/);
  });

  it("○ マーカーなしテキストにも contentHash が付与される", () => {
    const statements = parseStatements("議案第1号 可決");
    expect(statements[0]!.contentHash).toMatch(/^[a-f0-9]{64}$/);
  });

  it("短いマーカー（出席表等）をスキップする", () => {
    const text = "出席議員 ○ 1 ○ 2 ○ 3 ○議長（山田太郎君） 開会いたします。";
    const statements = parseStatements(text);
    // 短いマーカーはスキップされ、有効な発言のみ抽出
    expect(statements.every((s) => s.content.length >= 5)).toBe(true);
  });

  it("空テキストは空配列を返す", () => {
    expect(parseStatements("")).toEqual([]);
  });

  it("ト書き（登壇）をスキップする", () => {
    const text = "○（田中花子君登壇）○議長（山田太郎君） 開会いたします。";
    const statements = parseStatements(text);
    // 「登壇」のト書きはスキップされる
    expect(statements.length).toBeGreaterThan(0);
    expect(statements.every((s) => !s.content.includes("登壇"))).toBe(true);
  });
});
