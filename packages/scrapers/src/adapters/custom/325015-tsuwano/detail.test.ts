import { describe, it, expect } from "vitest";
import { parseSpeaker, classifyKind, parseStatements } from "./detail";

describe("parseSpeaker", () => {
  it("議長（括弧付き名前）を正しくパースする", () => {
    const result = parseSpeaker("○議長（山田太郎君）　ただいまから会議を開きます。");
    expect(result.speakerName).toBe("山田太郎");
    expect(result.speakerRole).toBe("議長");
    expect(result.content).toBe("ただいまから会議を開きます。");
  });

  it("町長（括弧付き名前）を正しくパースする", () => {
    const result = parseSpeaker("○町長（鈴木一郎君）　お答えいたします。");
    expect(result.speakerName).toBe("鈴木一郎");
    expect(result.speakerRole).toBe("町長");
    expect(result.content).toBe("お答えいたします。");
  });

  it("教育長を正しくパースする", () => {
    const result = parseSpeaker("○教育長（佐藤花子君）　ご説明いたします。");
    expect(result.speakerName).toBe("佐藤花子");
    expect(result.speakerRole).toBe("教育長");
    expect(result.content).toBe("ご説明いたします。");
  });

  it("番号付き議員を正しくパースする", () => {
    const result = parseSpeaker("○１番（高橋次郎君）　質問いたします。");
    expect(result.speakerName).toBe("高橋次郎");
    expect(result.speakerRole).toBe("議員");
    expect(result.content).toBe("質問いたします。");
  });

  it("半角番号付き議員を正しくパースする", () => {
    const result = parseSpeaker("○12番（田中三郎君）　質問です。");
    expect(result.speakerName).toBe("田中三郎");
    expect(result.speakerRole).toBe("議員");
    expect(result.content).toBe("質問です。");
  });

  it("課長（名前＋役職）パターンをパースする", () => {
    const result = parseSpeaker("○山本総務課長　ご報告いたします。");
    expect(result.speakerName).toBe("山本総務");
    expect(result.speakerRole).toBe("課長");
    expect(result.content).toBe("ご報告いたします。");
  });

  it("副町長を正しくパースする", () => {
    const result = parseSpeaker("○副町長（中村四郎君）　ご説明します。");
    expect(result.speakerName).toBe("中村四郎");
    expect(result.speakerRole).toBe("副町長");
    expect(result.content).toBe("ご説明します。");
  });

  it("副委員長を委員長より先にマッチする", () => {
    const result = parseSpeaker("○副委員長（田村五郎君）　続きます。");
    expect(result.speakerName).toBe("田村五郎");
    expect(result.speakerRole).toBe("副委員長");
    expect(result.content).toBe("続きます。");
  });

  it("マーカーなしのテキスト", () => {
    const result = parseSpeaker("午前10時開議");
    expect(result.speakerName).toBeNull();
    expect(result.speakerRole).toBeNull();
    expect(result.content).toBe("午前10時開議");
  });

  it("マーカーあり・役職不明の場合は名前のみ", () => {
    const result = parseSpeaker("○田中太郎 発言します。");
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

  it("総務課長（サフィックス課長）は answer", () => {
    expect(classifyKind("総務課長")).toBe("answer");
  });
});

describe("parseStatements", () => {
  it("○ マーカーでテキストを分割する", () => {
    const text = `
○議長（山田太郎君）　ただいまから会議を開きます。
○１番（高橋次郎君）　質問があります。
○町長（鈴木一郎君）　お答えします。
`;
    const statements = parseStatements(text);

    expect(statements.length).toBe(3);

    expect(statements[0]!.kind).toBe("remark");
    expect(statements[0]!.speakerName).toBe("山田太郎");
    expect(statements[0]!.speakerRole).toBe("議長");

    expect(statements[1]!.kind).toBe("question");
    expect(statements[1]!.speakerName).toBe("高橋次郎");
    expect(statements[1]!.speakerRole).toBe("議員");

    expect(statements[2]!.kind).toBe("answer");
    expect(statements[2]!.speakerName).toBe("鈴木一郎");
    expect(statements[2]!.speakerRole).toBe("町長");
  });

  it("各 statement に contentHash が付与される", () => {
    const statements = parseStatements(
      "○議長（山田太郎君）　テスト発言。"
    );
    expect(statements[0]!.contentHash).toMatch(/^[a-f0-9]{64}$/);
  });

  it("offset が正しく計算される", () => {
    const statements = parseStatements(
      "○議長（山田太郎君）　開会。\n○町長（鈴木一郎君）　答弁。"
    );
    expect(statements[0]!.startOffset).toBe(0);
    expect(statements[0]!.endOffset).toBe("開会。".length);
    expect(statements[1]!.startOffset).toBe("開会。".length + 1);
  });

  it("空テキストは空配列を返す", () => {
    expect(parseStatements("")).toEqual([]);
  });

  it("○ マーカーがないテキストはスキップする", () => {
    const statements = parseStatements("議事日程が配布されました。");
    expect(statements.length).toBe(0);
  });

  it("ト書き（登壇）はスキップする", () => {
    const text = `
○議長（山田太郎君）　発言を許します。
○（３番　高橋次郎君登壇）
○３番（高橋次郎君）　質問します。
`;
    const statements = parseStatements(text);

    expect(statements.length).toBe(2);
    expect(statements[0]!.speakerRole).toBe("議長");
    expect(statements[1]!.speakerRole).toBe("議員");
  });

  it("ト書き（退席・退場・着席）もスキップする", () => {
    const text = `
○議長（山田太郎君）　休憩します。
○（町長退席）
○（町長着席）
○議長（山田太郎君）　再開します。
`;
    const statements = parseStatements(text);

    expect(statements.length).toBe(2);
    expect(statements[0]!.content).toBe("休憩します。");
    expect(statements[1]!.content).toBe("再開します。");
  });
});
