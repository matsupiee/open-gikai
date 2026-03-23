import { describe, expect, it } from "vitest";
import { classifyKind, parseSpeaker, parseStatements } from "./detail";

describe("parseSpeaker", () => {
  it("議長（名前君）パターンを解析する", () => {
    const result = parseSpeaker(
      "○議長（山路 有君） 皆さん、おはようございます。"
    );
    expect(result.speakerName).toBe("山路有");
    expect(result.speakerRole).toBe("議長");
    expect(result.content).toBe("皆さん、おはようございます。");
  });

  it("議員（N番 名前君）パターンを解析する", () => {
    const result = parseSpeaker(
      "○議員（９番 松田 悦郎君） 質問いたします。"
    );
    expect(result.speakerName).toBe("松田悦郎");
    expect(result.speakerRole).toBe("議員");
    expect(result.content).toBe("質問いたします。");
  });

  it("村長（名前君）パターンを解析する", () => {
    const result = parseSpeaker(
      "○村長（中田 達彦君） お答えいたします。"
    );
    expect(result.speakerName).toBe("中田達彦");
    expect(result.speakerRole).toBe("村長");
    expect(result.content).toBe("お答えいたします。");
  });

  it("教育長パターンを解析する", () => {
    const result = parseSpeaker(
      "○教育長（井田 博之君） お答えいたします。"
    );
    expect(result.speakerName).toBe("井田博之");
    expect(result.speakerRole).toBe("教育長");
    expect(result.content).toBe("お答えいたします。");
  });

  it("課長パターンを解析する", () => {
    const result = parseSpeaker(
      "○総務課長（小原 義人君） 御説明いたします。"
    );
    expect(result.speakerName).toBe("小原義人");
    expect(result.speakerRole).toBe("課長");
    expect(result.content).toBe("御説明いたします。");
  });

  it("教育次長パターンを解析する", () => {
    const result = parseSpeaker(
      "○教育次長（横田 威開君） お答えいたします。"
    );
    expect(result.speakerName).toBe("横田威開");
    expect(result.speakerRole).toBe("教育次長");
    expect(result.content).toBe("お答えいたします。");
  });

  it("福祉保健課長パターンを解析する", () => {
    const result = parseSpeaker(
      "○福祉保健課長（橋田 和久君） お答えします。"
    );
    expect(result.speakerName).toBe("橋田和久");
    expect(result.speakerRole).toBe("課長");
    expect(result.content).toBe("お答えします。");
  });

  it("名前に空白を含む場合は除去される", () => {
    const result = parseSpeaker(
      "○村長（中田　達彦君）　答弁します。"
    );
    expect(result.speakerName).toBe("中田達彦");
  });

  it("○ マーカーなしのテキスト", () => {
    const result = parseSpeaker("午前９時開議");
    expect(result.speakerName).toBeNull();
    expect(result.speakerRole).toBeNull();
    expect(result.content).toBe("午前９時開議");
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

  it("村長は answer", () => {
    expect(classifyKind("村長")).toBe("answer");
  });

  it("教育長は answer", () => {
    expect(classifyKind("教育長")).toBe("answer");
  });

  it("教育次長は answer", () => {
    expect(classifyKind("教育次長")).toBe("answer");
  });

  it("課長は answer", () => {
    expect(classifyKind("課長")).toBe("answer");
  });

  it("会計管理者は answer", () => {
    expect(classifyKind("会計管理者")).toBe("answer");
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
○議長（山路 有君） ただいまから本日の会議を開きます。
○議員（９番 松田 悦郎君） 質問があります。
○村長（中田 達彦君） お答えします。
`;
    const statements = parseStatements(text);

    expect(statements).toHaveLength(3);

    expect(statements[0]!.kind).toBe("remark");
    expect(statements[0]!.speakerName).toBe("山路有");
    expect(statements[0]!.speakerRole).toBe("議長");

    expect(statements[1]!.kind).toBe("question");
    expect(statements[1]!.speakerName).toBe("松田悦郎");
    expect(statements[1]!.speakerRole).toBe("議員");

    expect(statements[2]!.kind).toBe("answer");
    expect(statements[2]!.speakerName).toBe("中田達彦");
    expect(statements[2]!.speakerRole).toBe("村長");
  });

  it("各 statement に contentHash が付与される", () => {
    const statements = parseStatements(
      "○議長（山路 有君） テスト発言。"
    );
    expect(statements[0]!.contentHash).toMatch(/^[a-f0-9]{64}$/);
  });

  it("offset が正しく計算される", () => {
    const text = `○議長（山路 有君） ただいま。
○議員（９番 松田 悦郎君） 質問です。`;

    const statements = parseStatements(text);

    expect(statements[0]!.startOffset).toBe(0);
    expect(statements[0]!.endOffset).toBe("ただいま。".length);
    expect(statements[1]!.startOffset).toBe("ただいま。".length + 1);
  });

  it("ト書き（登壇）はスキップする", () => {
    const text = `○議長（山路 有君） ただいまから会議を開きます。
（３番　松田悦郎登壇）
○議員（９番 松田 悦郎君） 質問があります。`;

    const statements = parseStatements(text);
    expect(statements).toHaveLength(2);
    expect(statements[0]!.speakerRole).toBe("議長");
    expect(statements[1]!.speakerRole).toBe("議員");
  });

  it("空テキストは空配列を返す", () => {
    expect(parseStatements("")).toEqual([]);
  });

  it("課長の発言を answer として分類する", () => {
    const text = `○総務課長（小原 義人君） 御説明いたします。`;
    const statements = parseStatements(text);

    expect(statements).toHaveLength(1);
    expect(statements[0]!.kind).toBe("answer");
    expect(statements[0]!.speakerName).toBe("小原義人");
    expect(statements[0]!.speakerRole).toBe("課長");
  });
});
