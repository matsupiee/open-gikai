import { describe, it, expect } from "vitest";
import { parseSpeaker, classifyKind, parseStatements } from "./detail";

describe("parseSpeaker", () => {
  it("議長（名前）パターンを解析する", () => {
    const result = parseSpeaker("○議長（伊藤秀明） 再開いたします。");
    expect(result.speakerName).toBe("伊藤秀明");
    expect(result.speakerRole).toBe("議長");
    expect(result.content).toBe("再開いたします。");
  });

  it("村長（名前）パターンを解析する", () => {
    const result = parseSpeaker(
      "○村長（小林悦次） 公設民営の宿泊施設についてお答えします。"
    );
    expect(result.speakerName).toBe("小林悦次");
    expect(result.speakerRole).toBe("村長");
    expect(result.content).toBe("公設民営の宿泊施設についてお答えします。");
  });

  it("副村長パターンを解析する", () => {
    const result = parseSpeaker("○副村長（田中一郎） ご説明します。");
    expect(result.speakerName).toBe("田中一郎");
    expect(result.speakerRole).toBe("副村長");
    expect(result.content).toBe("ご説明します。");
  });

  it("教育長パターンを解析する", () => {
    const result = parseSpeaker("○教育長（佐藤花子） お答えします。");
    expect(result.speakerName).toBe("佐藤花子");
    expect(result.speakerRole).toBe("教育長");
    expect(result.content).toBe("お答えします。");
  });

  it("番号付き議員（全角数字）パターンを解析する", () => {
    const result = parseSpeaker("○４番（長井直人） 質問いたします。");
    expect(result.speakerName).toBe("長井直人");
    expect(result.speakerRole).toBe("議員");
    expect(result.content).toBe("質問いたします。");
  });

  it("課長パターンを解析する", () => {
    const result = parseSpeaker("○総務課長（鈴木二郎） ご報告します。");
    expect(result.speakerName).toBe("鈴木二郎");
    expect(result.speakerRole).toBe("課長");
    expect(result.content).toBe("ご報告します。");
  });

  it("副議長パターンを解析する", () => {
    const result = parseSpeaker("○副議長（山田三郎） 開議します。");
    expect(result.speakerName).toBe("山田三郎");
    expect(result.speakerRole).toBe("副議長");
    expect(result.content).toBe("開議します。");
  });

  it("○マーカーなしのテキスト", () => {
    const result = parseSpeaker("午後１時開議");
    expect(result.speakerName).toBeNull();
    expect(result.speakerRole).toBeNull();
    expect(result.content).toBe("午後１時開議");
  });

  it("名前に空白を含む場合は除去される", () => {
    const result = parseSpeaker("○村長（小林　悦次） お答えします。");
    expect(result.speakerName).toBe("小林悦次");
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

  it("村長は answer", () => {
    expect(classifyKind("村長")).toBe("answer");
  });

  it("副村長は answer", () => {
    expect(classifyKind("副村長")).toBe("answer");
  });

  it("教育長は answer", () => {
    expect(classifyKind("教育長")).toBe("answer");
  });

  it("課長は answer", () => {
    expect(classifyKind("課長")).toBe("answer");
  });

  it("総務課長（endsWith 課長）は answer", () => {
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
  it("○ マーカーでテキストを分割する", () => {
    const text = `
○議長（伊藤秀明） ただいまから本日の会議を開きます。
○４番（長井直人） 質問があります。
○村長（小林悦次） お答えします。
`;
    const statements = parseStatements(text);

    expect(statements).toHaveLength(3);

    expect(statements[0]!.kind).toBe("remark");
    expect(statements[0]!.speakerName).toBe("伊藤秀明");
    expect(statements[0]!.speakerRole).toBe("議長");

    expect(statements[1]!.kind).toBe("question");
    expect(statements[1]!.speakerName).toBe("長井直人");
    expect(statements[1]!.speakerRole).toBe("議員");

    expect(statements[2]!.kind).toBe("answer");
    expect(statements[2]!.speakerName).toBe("小林悦次");
    expect(statements[2]!.speakerRole).toBe("村長");
  });

  it("各 statement に contentHash が付与される", () => {
    const statements = parseStatements(
      "○議長（伊藤秀明） テスト発言。"
    );
    expect(statements[0]!.contentHash).toMatch(/^[a-f0-9]{64}$/);
  });

  it("offset が正しく計算される", () => {
    const text = `○議長（伊藤秀明） ただいま。
○４番（長井直人） 質問です。`;

    const statements = parseStatements(text);

    expect(statements[0]!.startOffset).toBe(0);
    expect(statements[0]!.endOffset).toBe("ただいま。".length);
    expect(statements[1]!.startOffset).toBe("ただいま。".length + 1);
  });

  it("ト書き（登壇）はスキップする", () => {
    const text = `○議長（伊藤秀明） ただいまから会議を開きます。
○（４番 長井直人議員登壇）
○４番（長井直人） 質問があります。`;

    const statements = parseStatements(text);
    expect(statements).toHaveLength(2);
    expect(statements[0]!.speakerRole).toBe("議長");
    expect(statements[1]!.speakerRole).toBe("議員");
  });

  it("空テキストは空配列を返す", () => {
    expect(parseStatements("")).toEqual([]);
  });

  it("○マーカーのないテキストは無視する", () => {
    const text = `令和７年第８回定例会 会議録
令和7年12月9日（開会）`;

    const statements = parseStatements(text);
    expect(statements).toHaveLength(0);
  });
});
