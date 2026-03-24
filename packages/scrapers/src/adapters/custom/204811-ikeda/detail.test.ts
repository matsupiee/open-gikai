import { describe, it, expect } from "vitest";
import { parseSpeaker, classifyKind, parseStatements } from "./detail";

describe("parseSpeaker", () => {
  it("議長（名前君）パターンを解析する", () => {
    const result = parseSpeaker(
      "○議長（横澤はま君）　それでは、ただいまから会議を開きます。"
    );
    expect(result.speakerName).toBe("横澤はま");
    expect(result.speakerRole).toBe("議長");
    expect(result.content).toBe("それでは、ただいまから会議を開きます。");
  });

  it("副議長（名前君）パターンを解析する", () => {
    const result = parseSpeaker(
      "○副議長（和澤忠志君）　暫時休憩いたします。"
    );
    expect(result.speakerName).toBe("和澤忠志");
    expect(result.speakerRole).toBe("副議長");
    expect(result.content).toBe("暫時休憩いたします。");
  });

  it("番号付き議員パターンを解析する", () => {
    const result = parseSpeaker(
      "○１番（矢口結以君）　質問いたします。"
    );
    expect(result.speakerName).toBe("矢口結以");
    expect(result.speakerRole).toBe("議員");
    expect(result.content).toBe("質問いたします。");
  });

  it("２桁番号の議員パターンを解析する", () => {
    const result = parseSpeaker(
      "○１０番（服部久子君）　賛成討論を行います。"
    );
    expect(result.speakerName).toBe("服部久子");
    expect(result.speakerRole).toBe("議員");
    expect(result.content).toBe("賛成討論を行います。");
  });

  it("町長（名前君）パターンを解析する", () => {
    const result = parseSpeaker(
      "○町長（竹内靖二君）　お答えいたします。"
    );
    expect(result.speakerName).toBe("竹内靖二");
    expect(result.speakerRole).toBe("町長");
    expect(result.content).toBe("お答えいたします。");
  });

  it("課長パターンを解析する（prefix付き）", () => {
    const result = parseSpeaker(
      "○建設水道課長（山本利彦君）　ご報告いたします。"
    );
    expect(result.speakerName).toBe("山本利彦");
    expect(result.speakerRole).toBe("課長");
    expect(result.content).toBe("ご報告いたします。");
  });

  it("係長パターンを解析する（prefix付き）", () => {
    const result = parseSpeaker(
      "○総務課財政係長（寺島靖成君）　説明いたします。"
    );
    expect(result.speakerName).toBe("寺島靖成");
    expect(result.speakerRole).toBe("係長");
    expect(result.content).toBe("説明いたします。");
  });

  it("会計管理者兼会計課長パターンを解析する", () => {
    const result = parseSpeaker(
      "○会計管理者兼会計課長（丸山光一君）　説明いたします。"
    );
    expect(result.speakerName).toBe("丸山光一");
    expect(result.speakerRole).toBe("会計管理者兼会計課長");
    expect(result.content).toBe("説明いたします。");
  });

  it("委員長パターンを解析する（prefix付き）", () => {
    const result = parseSpeaker(
      "○振興文教委員長（大出美晴君）　委員長報告を行います。"
    );
    expect(result.speakerName).toBe("大出美晴");
    expect(result.speakerRole).toBe("委員長");
    expect(result.content).toBe("委員長報告を行います。");
  });

  it("名前に空白を含む場合は除去される", () => {
    const result = parseSpeaker(
      "○町長（竹内　靖二君）　答弁します。"
    );
    expect(result.speakerName).toBe("竹内靖二");
  });

  it("○ マーカーなしのテキスト", () => {
    const result = parseSpeaker("午前１０時開会");
    expect(result.speakerName).toBeNull();
    expect(result.speakerRole).toBeNull();
    expect(result.content).toBe("午前１０時開会");
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

  it("係長は answer", () => {
    expect(classifyKind("係長")).toBe("answer");
  });

  it("会計管理者兼会計課長は answer", () => {
    expect(classifyKind("会計管理者兼会計課長")).toBe("answer");
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
○議長（横澤はま君）　ただいまから本日の会議を開きます。
○１番（矢口結以君）　質問があります。
○町長（竹内靖二君）　お答えします。
`;
    const statements = parseStatements(text);

    expect(statements).toHaveLength(3);

    expect(statements[0]!.kind).toBe("remark");
    expect(statements[0]!.speakerName).toBe("横澤はま");
    expect(statements[0]!.speakerRole).toBe("議長");

    expect(statements[1]!.kind).toBe("question");
    expect(statements[1]!.speakerName).toBe("矢口結以");
    expect(statements[1]!.speakerRole).toBe("議員");

    expect(statements[2]!.kind).toBe("answer");
    expect(statements[2]!.speakerName).toBe("竹内靖二");
    expect(statements[2]!.speakerRole).toBe("町長");
  });

  it("ページ番号行（−N−形式）を除外する", () => {
    const text = `
○議長（横澤はま君）　ただいまから会議を開きます。
−1−
○１番（矢口結以君）　質問します。
−2−
○町長（竹内靖二君）　お答えします。
`;
    const statements = parseStatements(text);

    expect(statements).toHaveLength(3);
    expect(statements[0]!.content).not.toContain("−");
    expect(statements[1]!.content).not.toContain("−");
  });

  it("各 statement に contentHash が付与される", () => {
    const statements = parseStatements(
      "○議長（横澤はま君）　テスト発言。"
    );
    expect(statements[0]!.contentHash).toMatch(/^[a-f0-9]{64}$/);
  });

  it("offset が正しく計算される", () => {
    const text = `○議長（横澤はま君）　ただいま。
○１番（矢口結以君）　質問です。`;

    const statements = parseStatements(text);

    expect(statements[0]!.startOffset).toBe(0);
    expect(statements[0]!.endOffset).toBe("ただいま。".length);
    expect(statements[1]!.startOffset).toBe("ただいま。".length + 1);
  });

  it("ト書き（登壇）はスキップする", () => {
    const text = `○議長（横澤はま君）　ただいまから会議を開きます。
（１番　矢口結以君登壇）
○１番（矢口結以君）　質問があります。`;

    const statements = parseStatements(text);
    expect(statements).toHaveLength(2);
    expect(statements[0]!.speakerRole).toBe("議長");
    expect(statements[1]!.speakerRole).toBe("議員");
  });

  it("空テキストは空配列を返す", () => {
    expect(parseStatements("")).toEqual([]);
  });
});
