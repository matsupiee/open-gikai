import { describe, it, expect } from "vitest";
import { parseSpeaker, classifyKind, parseStatements } from "./detail";

describe("parseSpeaker", () => {
  it("議長（名前議員）パターンを解析する", () => {
    const result = parseSpeaker(
      "○議長（野村祐司議員） 本日の会議を開きます。"
    );
    expect(result.speakerName).toBe("野村祐司");
    expect(result.speakerRole).toBe("議長");
    expect(result.content).toBe("本日の会議を開きます。");
  });

  it("町長（名前君）パターンを解析する", () => {
    const result = parseSpeaker(
      "○町長（角和浩幸君）　お答えいたします。"
    );
    expect(result.speakerName).toBe("角和浩幸");
    expect(result.speakerRole).toBe("町長");
    expect(result.content).toBe("お答えいたします。");
  });

  it("番号議員パターンを解析する", () => {
    const result = parseSpeaker(
      "○４番（興梠勝也議員）　質問いたします。"
    );
    expect(result.speakerName).toBe("興梠勝也");
    expect(result.speakerRole).toBe("議員");
    expect(result.content).toBe("質問いたします。");
  });

  it("教育長パターンを解析する", () => {
    const result = parseSpeaker(
      "○教育長（鈴木薫君）　お答えいたします。"
    );
    expect(result.speakerName).toBe("鈴木薫");
    expect(result.speakerRole).toBe("教育長");
    expect(result.content).toBe("お答えいたします。");
  });

  it("室長パターンを解析する", () => {
    const result = parseSpeaker(
      "○地域みらい創造室長（谷口雄二君）　ご説明いたします。"
    );
    expect(result.speakerName).toBe("谷口雄二");
    expect(result.speakerRole).toBe("室長");
    expect(result.content).toBe("ご説明いたします。");
  });

  it("課長パターンを解析する", () => {
    const result = parseSpeaker(
      "○総務課長（新村猛君）　ご報告いたします。"
    );
    expect(result.speakerName).toBe("新村猛");
    expect(result.speakerRole).toBe("課長");
    expect(result.content).toBe("ご報告いたします。");
  });

  it("事務局長パターンを解析する", () => {
    const result = parseSpeaker(
      "○事務局長（梶原祐治君）　諸般の報告をいたします。"
    );
    expect(result.speakerName).toBe("梶原祐治");
    expect(result.speakerRole).toBe("事務局長");
    expect(result.content).toBe("諸般の報告をいたします。");
  });

  it("副町長パターンを解析する", () => {
    const result = parseSpeaker(
      "○副町長（吉川智巳君）　ご説明いたします。"
    );
    expect(result.speakerName).toBe("吉川智巳");
    expect(result.speakerRole).toBe("副町長");
    expect(result.content).toBe("ご説明いたします。");
  });

  it("名前に空白を含む場合は除去される", () => {
    const result = parseSpeaker(
      "○町長（角和　浩幸君）　答弁します。"
    );
    expect(result.speakerName).toBe("角和浩幸");
  });

  it("○ マーカーなしのテキスト", () => {
    const result = parseSpeaker("午前９時３０分 開会");
    expect(result.speakerName).toBeNull();
    expect(result.speakerRole).toBeNull();
    expect(result.content).toBe("午前９時３０分 開会");
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

  it("室長は answer", () => {
    expect(classifyKind("室長")).toBe("answer");
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
  it("○ マーカーでテキストを分割する", () => {
    const text = `
○議長（野村祐司議員） 本日の会議を開きます。
○４番（興梠勝也議員） 質問があります。
○町長（角和浩幸君） お答えします。
`;
    const statements = parseStatements(text);

    expect(statements).toHaveLength(3);

    expect(statements[0]!.kind).toBe("remark");
    expect(statements[0]!.speakerName).toBe("野村祐司");
    expect(statements[0]!.speakerRole).toBe("議長");

    expect(statements[1]!.kind).toBe("question");
    expect(statements[1]!.speakerName).toBe("興梠勝也");
    expect(statements[1]!.speakerRole).toBe("議員");

    expect(statements[2]!.kind).toBe("answer");
    expect(statements[2]!.speakerName).toBe("角和浩幸");
    expect(statements[2]!.speakerRole).toBe("町長");
  });

  it("各 statement に contentHash が付与される", () => {
    const statements = parseStatements(
      "○議長（野村祐司議員）　テスト発言。"
    );
    expect(statements[0]!.contentHash).toMatch(/^[a-f0-9]{64}$/);
  });

  it("offset が正しく計算される", () => {
    const text = `○議長（野村祐司議員）　ただいま。
○４番（興梠勝也議員）　質問です。`;

    const statements = parseStatements(text);

    expect(statements[0]!.startOffset).toBe(0);
    expect(statements[0]!.endOffset).toBe("ただいま。".length);
    expect(statements[1]!.startOffset).toBe("ただいま。".length + 1);
  });

  it("ト書き（登壇）はスキップする", () => {
    const text = `○議長（野村祐司議員）　ただいまから会議を開きます。
（４番 興梠 勝也議員 登壇）
○４番（興梠勝也議員）　質問があります。`;

    const statements = parseStatements(text);
    expect(statements).toHaveLength(2);
    expect(statements[0]!.speakerRole).toBe("議長");
    expect(statements[1]!.speakerRole).toBe("議員");
  });

  it("空テキストは空配列を返す", () => {
    expect(parseStatements("")).toEqual([]);
  });

  it("行政側の室長・課長の発言を answer として分類する", () => {
    const text = `○地域みらい創造室長（谷口雄二君） ご説明いたします。
○総務課長（新村猛君） ご報告いたします。`;

    const statements = parseStatements(text);

    expect(statements).toHaveLength(2);
    expect(statements[0]!.kind).toBe("answer");
    expect(statements[1]!.kind).toBe("answer");
  });
});
