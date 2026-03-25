import { describe, it, expect } from "vitest";
import { parseSpeaker, classifyKind, parseStatements } from "./detail";

describe("parseSpeaker", () => {
  it("議長（姓名+役職）を正しくパースする", () => {
    const result = parseSpeaker("○遠藤　満議長　ただいまから会議を開きます。");
    expect(result.speakerName).toBe("遠藤満");
    expect(result.speakerRole).toBe("議長");
    expect(result.content).toBe("ただいまから会議を開きます。");
  });

  it("町長（姓名+役職）を正しくパースする", () => {
    const result = parseSpeaker("○大堀　武町長　お答えいたします。");
    expect(result.speakerName).toBe("大堀武");
    expect(result.speakerRole).toBe("町長");
    expect(result.content).toBe("お答えいたします。");
  });

  it("事務局長（名前+役職）を正しくパースする", () => {
    const result = parseSpeaker("○佐藤武志事務局長　ご説明いたします。");
    expect(result.speakerName).toBe("佐藤武志");
    expect(result.speakerRole).toBe("事務局長");
    expect(result.content).toBe("ご説明いたします。");
  });

  it("番号付き議員を正しくパースする", () => {
    const result = parseSpeaker("○１番大内広行議員　質問いたします。");
    expect(result.speakerName).toBe("大内広行");
    expect(result.speakerRole).toBe("議員");
    expect(result.content).toBe("質問いたします。");
  });

  it("副町長を正しくパースする", () => {
    const result = parseSpeaker("○田中次郎副町長　ご説明します。");
    expect(result.speakerName).toBe("田中次郎");
    expect(result.speakerRole).toBe("副町長");
    expect(result.content).toBe("ご説明します。");
  });

  it("副委員長を委員長より先にマッチする", () => {
    const result = parseSpeaker("○鈴木一郎副委員長　続きます。");
    expect(result.speakerName).toBe("鈴木一郎");
    expect(result.speakerRole).toBe("副委員長");
    expect(result.content).toBe("続きます。");
  });

  it("教育長を正しくパースする", () => {
    const result = parseSpeaker("○山田花子教育長　ご答弁申し上げます。");
    expect(result.speakerName).toBe("山田花子");
    expect(result.speakerRole).toBe("教育長");
    expect(result.content).toBe("ご答弁申し上げます。");
  });

  it("課長を正しくパースする", () => {
    const result = parseSpeaker("○佐藤総務課長　報告いたします。");
    expect(result.speakerName).toBe("佐藤総務");
    expect(result.speakerRole).toBe("課長");
    expect(result.content).toBe("報告いたします。");
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

  it("総務課長（サフィックス課長）は answer", () => {
    expect(classifyKind("総務課長")).toBe("answer");
  });
});

describe("parseStatements", () => {
  it("○ マーカーでテキストを分割する", () => {
    const text = `
○遠藤　満議長　ただいまから会議を開きます。
○１番大内広行議員　質問があります。
○大堀　武町長　お答えします。
`;
    const statements = parseStatements(text);

    expect(statements.length).toBe(3);

    expect(statements[0]!.kind).toBe("remark");
    expect(statements[0]!.speakerName).toBe("遠藤満");
    expect(statements[0]!.speakerRole).toBe("議長");

    expect(statements[1]!.kind).toBe("question");
    expect(statements[1]!.speakerName).toBe("大内広行");
    expect(statements[1]!.speakerRole).toBe("議員");

    expect(statements[2]!.kind).toBe("answer");
    expect(statements[2]!.speakerName).toBe("大堀武");
    expect(statements[2]!.speakerRole).toBe("町長");
  });

  it("各 statement に contentHash が付与される", () => {
    const statements = parseStatements(
      "○遠藤　満議長　テスト発言。",
    );
    expect(statements[0]!.contentHash).toMatch(/^[a-f0-9]{64}$/);
  });

  it("offset が正しく計算される", () => {
    const statements = parseStatements(
      "○遠藤　満議長　開会。\n○大堀　武町長　答弁。",
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

  it("登壇ト書きはスキップする", () => {
    const text = `
○遠藤　満議長　発言を許します。
○〔大堀　武町長登壇〕
○大堀　武町長　お答えします。
`;
    const statements = parseStatements(text);

    expect(statements.length).toBe(2);
    expect(statements[0]!.speakerRole).toBe("議長");
    expect(statements[1]!.speakerRole).toBe("町長");
  });

  it("退席・着席のト書きもスキップする", () => {
    const text = `
○遠藤　満議長　休憩します。
○〔大堀　武町長退席〕
○〔大堀　武町長着席〕
○遠藤　満議長　再開します。
`;
    const statements = parseStatements(text);

    expect(statements.length).toBe(2);
    expect(statements[0]!.content).toBe("休憩します。");
    expect(statements[1]!.content).toBe("再開します。");
  });
});
