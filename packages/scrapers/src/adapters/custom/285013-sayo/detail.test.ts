import { describe, expect, it } from "vitest";
import { parseSpeaker, classifyKind, parseStatements } from "./detail";

describe("parseSpeaker", () => {
  it("議長（名前君）パターンを解析する", () => {
    const result = parseSpeaker(
      "議長（小林裕和君） ただいまから本日の会議を開きます。"
    );
    expect(result.speakerName).toBe("小林裕和");
    expect(result.speakerRole).toBe("議長");
    expect(result.content).toBe("ただいまから本日の会議を開きます。");
  });

  it("町長（名前君）パターンを解析する", () => {
    const result = parseSpeaker(
      "町長（庵逧典章君） 皆様、おはようございます。"
    );
    expect(result.speakerName).toBe("庵逧典章");
    expect(result.speakerRole).toBe("町長");
    expect(result.content).toBe("皆様、おはようございます。");
  });

  it("副町長（名前君）パターンを解析する", () => {
    const result = parseSpeaker(
      "副町長（江見秀樹君） ご説明いたします。"
    );
    expect(result.speakerName).toBe("江見秀樹");
    expect(result.speakerRole).toBe("副町長");
    expect(result.content).toBe("ご説明いたします。");
  });

  it("議会事務局長（名前君）パターンを解析する", () => {
    const result = parseSpeaker(
      "議会事務局長（東口和弘君） 会場にお集まりの皆様にお知らせします。"
    );
    expect(result.speakerName).toBe("東口和弘");
    expect(result.speakerRole).toBe("事務局長");
    expect(result.content).toBe("会場にお集まりの皆様にお知らせします。");
  });

  it("総務課長（名前君）パターンを解析する", () => {
    const result = parseSpeaker(
      "総務課長（幸田和彦君） ご説明いたします。"
    );
    expect(result.speakerName).toBe("幸田和彦");
    expect(result.speakerRole).toBe("課長");
    expect(result.content).toBe("ご説明いたします。");
  });

  it("教育長（名前君）パターンを解析する", () => {
    const result = parseSpeaker(
      "教育長（浅野博之君） お答えいたします。"
    );
    expect(result.speakerName).toBe("浅野博之");
    expect(result.speakerRole).toBe("教育長");
    expect(result.content).toBe("お答えいたします。");
  });

  it("支所長（名前君）パターンを解析する", () => {
    const result = parseSpeaker(
      "上月支所長（福岡真一郎君） 報告いたします。"
    );
    expect(result.speakerName).toBe("福岡真一郎");
    expect(result.speakerRole).toBe("支所長");
    expect(result.content).toBe("報告いたします。");
  });

  it("番号付き議員パターンを解析する", () => {
    const result = parseSpeaker(
      "３番（大村隼君） 質問いたします。"
    );
    expect(result.speakerName).toBe("大村隼");
    expect(result.speakerRole).toBe("議員");
    expect(result.content).toBe("質問いたします。");
  });

  it("「君」なし名前でも解析できる", () => {
    const result = parseSpeaker(
      "議長（小林裕和） ただいまから会議を開きます。"
    );
    expect(result.speakerName).toBe("小林裕和");
    expect(result.speakerRole).toBe("議長");
    expect(result.content).toBe("ただいまから会議を開きます。");
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

  it("支所長は answer", () => {
    expect(classifyKind("支所長")).toBe("answer");
  });

  it("議員は question", () => {
    expect(classifyKind("議員")).toBe("question");
  });

  it("null は remark", () => {
    expect(classifyKind(null)).toBe("remark");
  });
});

describe("parseStatements", () => {
  it("役職（名前君）でテキストを分割する", () => {
    const text = "議長（小林裕和君） ただいまから本日の会議を開きます。 町長（庵逧典章君） 皆さんおはようございます。 ３番（大村隼君） 質問いたします。";
    const statements = parseStatements(text);

    expect(statements).toHaveLength(3);

    expect(statements[0]!.kind).toBe("remark");
    expect(statements[0]!.speakerName).toBe("小林裕和");
    expect(statements[0]!.speakerRole).toBe("議長");

    expect(statements[1]!.kind).toBe("answer");
    expect(statements[1]!.speakerName).toBe("庵逧典章");
    expect(statements[1]!.speakerRole).toBe("町長");

    expect(statements[2]!.kind).toBe("question");
    expect(statements[2]!.speakerName).toBe("大村隼");
    expect(statements[2]!.speakerRole).toBe("議員");
  });

  it("各 statement に contentHash が付与される", () => {
    const statements = parseStatements(
      "議長（小林裕和君） ただいまから会議を開きます。"
    );
    expect(statements[0]!.contentHash).toMatch(/^[a-f0-9]{64}$/);
  });

  it("offset が正しく計算される", () => {
    const text = "議長（小林裕和君） ただいま。 総務課長（幸田和彦君） 説明します。";

    const statements = parseStatements(text);

    expect(statements[0]!.startOffset).toBe(0);
    expect(statements[0]!.endOffset).toBe("ただいま。".length);
    expect(statements[1]!.startOffset).toBe("ただいま。".length + 1);
  });

  it("ト書き（登壇）はスキップする", () => {
    const text = "議長（小林裕和君） ただいまから会議を開きます。 〔町長 庵逧典章君 登壇〕 町長（庵逧典章君） 皆様おはようございます。";

    const statements = parseStatements(text);
    expect(statements.length).toBeGreaterThanOrEqual(2);
    const speakerRoles = statements.map((s) => s.speakerRole);
    expect(speakerRoles).toContain("議長");
    expect(speakerRoles).toContain("町長");
  });

  it("空テキストは空配列を返す", () => {
    expect(parseStatements("")).toEqual([]);
  });

  it("発言者パターンがない場合は空配列を返す", () => {
    const text = "これは会議録の前文部分です。発言者情報は含まれていません。";
    expect(parseStatements(text)).toEqual([]);
  });

  it("行政側の役職を正しく分類する", () => {
    const text = "副町長（江見秀樹君） ご説明いたします。 総務課長（幸田和彦君） ご報告いたします。 教育長（浅野博之君） 補足説明いたします。";

    const statements = parseStatements(text);

    expect(statements).toHaveLength(3);
    expect(statements[0]!.kind).toBe("answer");
    expect(statements[0]!.speakerRole).toBe("副町長");
    expect(statements[1]!.kind).toBe("answer");
    expect(statements[1]!.speakerRole).toBe("課長");
    expect(statements[2]!.kind).toBe("answer");
    expect(statements[2]!.speakerRole).toBe("教育長");
  });
});
