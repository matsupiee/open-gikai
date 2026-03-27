import { describe, expect, it } from "vitest";
import { classifyKind, parseSpeaker, parseStatements } from "./detail";

describe("parseSpeaker", () => {
  it("議長の角括弧ヘッダーを解析する", () => {
    const result = parseSpeaker("〔今泉藤一郎議長〕再開します。");

    expect(result.speakerName).toBe("今泉藤一郎");
    expect(result.speakerRole).toBe("議長");
    expect(result.content).toBe("再開します。");
  });

  it("番号付き議員を解析する", () => {
    const result = parseSpeaker("〔３番 久保田豊君〕皆さんこんにちは。");

    expect(result.speakerName).toBe("久保田豊");
    expect(result.speakerRole).toBe("議員");
    expect(result.content).toBe("皆さんこんにちは。");
  });

  it("課長答弁を解析する", () => {
    const result = parseSpeaker("〔堀江商工観光課長〕お答えいたします。");

    expect(result.speakerName).toBe("堀江商工観光");
    expect(result.speakerRole).toBe("課長");
    expect(result.content).toBe("お答えいたします。");
  });

  it("マーカーなしの場合は content のみ返す", () => {
    const result = parseSpeaker("議事日程が配布されております。");

    expect(result.speakerName).toBeNull();
    expect(result.speakerRole).toBeNull();
    expect(result.content).toBe("議事日程が配布されております。");
  });
});

describe("classifyKind", () => {
  it("議長は remark", () => {
    expect(classifyKind("議長")).toBe("remark");
  });

  it("議員は question", () => {
    expect(classifyKind("議員")).toBe("question");
  });

  it("町長は answer", () => {
    expect(classifyKind("町長")).toBe("answer");
  });

  it("課長は answer", () => {
    expect(classifyKind("課長")).toBe("answer");
  });
});

describe("parseStatements", () => {
  it("角括弧ヘッダーごとに発言を分割する", () => {
    const text = `1
▼日程第９ 一般質問
〔今泉藤一郎議長〕再開します。日程第９ 一般質問を行います。
〔３番 久保田豊君〕皆さんこんにちは。
〔堀江商工観光課長〕お答えいたします。`;

    const statements = parseStatements(text);

    expect(statements.length).toBe(3);
    expect(statements[0]!.kind).toBe("remark");
    expect(statements[0]!.speakerName).toBe("今泉藤一郎");
    expect(statements[0]!.speakerRole).toBe("議長");
    expect(statements[1]!.kind).toBe("question");
    expect(statements[1]!.speakerName).toBe("久保田豊");
    expect(statements[1]!.speakerRole).toBe("議員");
    expect(statements[2]!.kind).toBe("answer");
    expect(statements[2]!.speakerName).toBe("堀江商工観光");
    expect(statements[2]!.speakerRole).toBe("課長");
  });

  it("登壇ト書きをスキップする", () => {
    const text = `
〔松尾町長登壇〕
〔松尾町長〕よろしくお願いいたします。
`;

    const statements = parseStatements(text);

    expect(statements.length).toBe(1);
    expect(statements[0]!.speakerName).toBe("松尾");
    expect(statements[0]!.speakerRole).toBe("町長");
    expect(statements[0]!.content).toBe("よろしくお願いいたします。");
  });

  it("contentHash と offset を設定する", () => {
    const statements = parseStatements("〔今泉藤一郎議長〕再開します。");

    expect(statements[0]!.contentHash).toMatch(/^[a-f0-9]{64}$/);
    expect(statements[0]!.startOffset).toBe(0);
    expect(statements[0]!.endOffset).toBe(6);
  });

  it("句点の後ろに紛れ込んだページ番号ノイズを除去する", () => {
    const statements = parseStatements(
      "〔３番 久保田豊君〕質問です。 2 それでは次に進みます。"
    );

    expect(statements[0]!.content).toBe("質問です。 それでは次に進みます。");
  });

  it("発言ヘッダーがない場合は空配列を返す", () => {
    expect(parseStatements("会議録本文なし")).toEqual([]);
  });
});
