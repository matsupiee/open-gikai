import { describe, it, expect } from "vitest";
import { parseSpeakerLabel, classifyKind, parseStatements, findContentStart } from "./detail";

describe("parseSpeakerLabel", () => {
  it("議長パターンを解析する（名前なし）", () => {
    const result = parseSpeakerLabel("議長");
    expect(result.speakerName).toBeNull();
    expect(result.speakerRole).toBe("議長");
  });

  it("町長パターンを解析する（名前なし）", () => {
    const result = parseSpeakerLabel("町長");
    expect(result.speakerName).toBeNull();
    expect(result.speakerRole).toBe("町長");
  });

  it("副町長パターンを解析する", () => {
    const result = parseSpeakerLabel("副町長");
    expect(result.speakerName).toBeNull();
    expect(result.speakerRole).toBe("副町長");
  });

  it("氏名+議員パターンを解析する（一般質問形式）", () => {
    const result = parseSpeakerLabel("家塚議員");
    expect(result.speakerName).toBe("家塚");
    expect(result.speakerRole).toBe("議員");
  });

  it("氏名+町長パターンを解析する（一般質問形式）", () => {
    const result = parseSpeakerLabel("大崎町長");
    expect(result.speakerName).toBe("大崎");
    expect(result.speakerRole).toBe("町長");
  });

  it("部署名+課長パターンを解析する", () => {
    const result = parseSpeakerLabel("総務課長");
    expect(result.speakerName).toBe("総務");
    expect(result.speakerRole).toBe("課長");
  });

  it("4文字部署名+課長パターンを解析する", () => {
    const result = parseSpeakerLabel("都市整備課長");
    expect(result.speakerName).toBe("都市整備");
    expect(result.speakerRole).toBe("課長");
  });

  it("副委員長は委員長と区別される", () => {
    const result = parseSpeakerLabel("副委員長");
    expect(result.speakerName).toBeNull();
    expect(result.speakerRole).toBe("副委員長");
  });

  it("委員長パターンを解析する", () => {
    const result = parseSpeakerLabel("委員会委員長");
    expect(result.speakerRole).toBe("委員長");
  });

  it("教育長パターンを解析する", () => {
    const result = parseSpeakerLabel("教育長");
    expect(result.speakerName).toBeNull();
    expect(result.speakerRole).toBe("教育長");
  });

  it("氏名+教育長パターンを解析する", () => {
    const result = parseSpeakerLabel("西田教育長");
    expect(result.speakerName).toBe("西田");
    expect(result.speakerRole).toBe("教育長");
  });

  it("役職がない場合は null を返す", () => {
    const result = parseSpeakerLabel("午前10時開議");
    expect(result.speakerName).toBeNull();
    expect(result.speakerRole).toBeNull();
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

describe("findContentStart", () => {
  it("一般質問 PDF の ① を検出する", () => {
    const text = "令和6年第1回南幌町議会定例会一般質問（質問者10名）（令和6年3月7日） ①「南幌みどり野団地...";
    const idx = findContentStart(text);
    expect(text[idx]).toBe("①");
  });

  it("会議録 PDF の ●日程 を検出する", () => {
    const text = "...出席議員 1番湯本要 2番西股裕司... ●日程1 会議録署名議員の指名を行います。";
    const idx = findContentStart(text);
    expect(text.substring(idx, idx + 3)).toBe("●日程");
  });

  it("見つからない場合は 0 を返す", () => {
    const text = "普通のテキスト。何もない。";
    expect(findContentStart(text)).toBe(0);
  });
});

describe("parseStatements", () => {
  it("一般質問形式のテキストを分割する", () => {
    const text = "①「テスト質問」家塚議員これはテスト質問です。大崎町長お答えします。家塚議員（再質問）ありがとうございます。";

    const statements = parseStatements(text);

    expect(statements.length).toBeGreaterThanOrEqual(3);

    expect(statements[0]!.kind).toBe("question");
    expect(statements[0]!.speakerName).toBe("家塚");
    expect(statements[0]!.speakerRole).toBe("議員");
    expect(statements[0]!.content).toContain("これはテスト質問です");

    expect(statements[1]!.kind).toBe("answer");
    expect(statements[1]!.speakerName).toBe("大崎");
    expect(statements[1]!.speakerRole).toBe("町長");
    expect(statements[1]!.content).toContain("お答えします");
  });

  it("会議録形式の役職のみパターンを分割する", () => {
    const text = "●日程1 議長おはようございます。本日の会議を開きます。 町長ただいま上程をいただきました。";

    const statements = parseStatements(text);

    expect(statements.length).toBeGreaterThanOrEqual(2);

    const gichoStatement = statements.find((s) => s.speakerRole === "議長");
    expect(gichoStatement).toBeDefined();
    expect(gichoStatement!.kind).toBe("remark");

    const chochoStatement = statements.find((s) => s.speakerRole === "町長");
    expect(chochoStatement).toBeDefined();
    expect(chochoStatement!.kind).toBe("answer");
  });

  it("各 statement に contentHash が付与される", () => {
    const statements = parseStatements("①「テスト」家塚議員テスト発言です。大崎町長お答えします。");
    expect(statements.length).toBeGreaterThan(0);
    expect(statements[0]!.contentHash).toMatch(/^[a-f0-9]{64}$/);
  });

  it("offset が正しく計算される", () => {
    const text = "①「テスト」家塚議員ただいま。大崎町長質問です。";

    const statements = parseStatements(text);

    expect(statements.length).toBeGreaterThanOrEqual(2);
    expect(statements[0]!.startOffset).toBe(0);
    expect(statements[0]!.endOffset).toBe("ただいま。".length);
  });

  it("登壇のト書きはスキップする", () => {
    const text = "●日程1 議長ただいまから会議を開きます。（町長登壇）町長お答えします。";

    const statements = parseStatements(text);
    expect(statements.some((s) => s.speakerRole === "議長")).toBe(true);
    expect(statements.some((s) => s.speakerRole === "町長")).toBe(true);
  });

  it("空テキストは空配列を返す", () => {
    expect(parseStatements("")).toEqual([]);
  });

  it("発言者パターンがない場合は空配列を返す", () => {
    expect(parseStatements("南幌町議会会議録\n令和7年第1回定例会")).toEqual([]);
  });

  it("「会議録署名議員」は偽陽性にならない（5文字プレフィックスは除外）", () => {
    const text = "●日程1 会議録署名議員の指名を行います。議長テスト発言。";
    const statements = parseStatements(text);
    const false_pos = statements.find(
      (s) => s.speakerName === "会議録署名",
    );
    expect(false_pos).toBeUndefined();
  });
});
