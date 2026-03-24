import { describe, it, expect } from "vitest";
import { parseSpeakerLine, classifyKind, parseStatements } from "./detail";

describe("parseSpeakerLine", () => {
  it("議長（氏名）パターンを解析する", () => {
    const result = parseSpeakerLine("議長（川上守）");
    expect(result).not.toBeNull();
    expect(result!.speakerName).toBe("川上守");
    expect(result!.speakerRole).toBe("議長");
  });

  it("町長（氏名）パターンを解析する", () => {
    const result = parseSpeakerLine("町長（上川元張）");
    expect(result).not.toBeNull();
    expect(result!.speakerName).toBe("上川元張");
    expect(result!.speakerRole).toBe("町長");
  });

  it("副町長（氏名）パターンを解析する", () => {
    const result = parseSpeakerLine("副町長（田中一郎）");
    expect(result).not.toBeNull();
    expect(result!.speakerName).toBe("田中一郎");
    expect(result!.speakerRole).toBe("副町長");
  });

  it("教育長（氏名）パターンを解析する", () => {
    const result = parseSpeakerLine("教育長（山田花子）");
    expect(result).not.toBeNull();
    expect(result!.speakerName).toBe("山田花子");
    expect(result!.speakerRole).toBe("教育長");
  });

  it("総務課長（氏名）パターンを解析する", () => {
    const result = parseSpeakerLine("総務課長（鈴木太郎）");
    expect(result).not.toBeNull();
    expect(result!.speakerName).toBe("鈴木太郎");
    expect(result!.speakerRole).toBe("課長");
  });

  it("名前中の空白を除去する", () => {
    const result = parseSpeakerLine("議長（川上　守）");
    expect(result).not.toBeNull();
    expect(result!.speakerName).toBe("川上守");
  });

  it("括弧パターンでない行は null を返す", () => {
    expect(parseSpeakerLine("ただいまより本日の会議を開きます。")).toBeNull();
  });

  it("（異議なし）のような括弧だけの行は null を返す", () => {
    // 役職部分が空になるので null
    expect(parseSpeakerLine("（異議なし）")).toBeNull();
  });
});

describe("classifyKind", () => {
  it("議長は remark", () => {
    expect(classifyKind("議長")).toBe("remark");
  });

  it("副議長は remark", () => {
    expect(classifyKind("副議長")).toBe("remark");
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
});

describe("parseStatements", () => {
  it("発言者行でテキストを分割する", () => {
    // 若桜町は ○ マーカーも番号もなく「役職（氏名）」形式のみ
    const text = "議長（川上守） ただいまより本日の会議を開きます。 谷口議員（谷口貴） 質問があります。 町長（上川元張） お答えいたします。";

    const statements = parseStatements(text);

    expect(statements.length).toBe(3);

    expect(statements[0]!.kind).toBe("remark");
    expect(statements[0]!.speakerName).toBe("川上守");
    expect(statements[0]!.speakerRole).toBe("議長");

    expect(statements[1]!.kind).toBe("question");
    expect(statements[1]!.speakerName).toBe("谷口貴");

    expect(statements[2]!.kind).toBe("answer");
    expect(statements[2]!.speakerName).toBe("上川元張");
    expect(statements[2]!.speakerRole).toBe("町長");
  });

  it("各 statement に contentHash が付与される", () => {
    const text = "議長（川上守）\nテスト発言。";
    const statements = parseStatements(text);
    expect(statements[0]!.contentHash).toMatch(/^[a-f0-9]{64}$/);
  });

  it("発言者行のみで発言内容がない場合はスキップする", () => {
    const text = "議長（川上守）\n町長（上川元張）\nお答えします。";
    const statements = parseStatements(text);
    // 議長の発言内容がないためスキップされる
    expect(statements.length).toBe(1);
    expect(statements[0]!.speakerRole).toBe("町長");
  });

  it("（異議なし）などの括弧行は発言内容に含まれる", () => {
    const text = "議長（川上守）\n採決します。\n（異議なし）\n可決されました。";
    const statements = parseStatements(text);
    expect(statements.length).toBe(1);
    expect(statements[0]!.content).toContain("（異議なし）");
  });

  it("空テキストは空配列を返す", () => {
    expect(parseStatements("")).toEqual([]);
  });

  it("発言者行がないテキストは空配列を返す", () => {
    const statements = parseStatements("令和7年12月定例会会議録\n若桜町議会事務局");
    expect(statements.length).toBe(0);
  });
});
