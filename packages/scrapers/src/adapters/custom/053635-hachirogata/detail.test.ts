import { describe, it, expect } from "vitest";
import {
  normalizeRole,
  classifyKind,
  findSpeakerPositions,
  parseStatements,
  extractHeldOn,
} from "./detail";

describe("normalizeRole", () => {
  it("議長はそのまま返す", () => {
    expect(normalizeRole("議長")).toBe("議長");
  });

  it("産業課長は課長に正規化する", () => {
    expect(normalizeRole("産業課長")).toBe("課長");
  });

  it("議会運営委員長は委員長に正規化する", () => {
    expect(normalizeRole("議会運営委員長")).toBe("委員長");
  });

  it("番号は議員に正規化する", () => {
    expect(normalizeRole("２番")).toBe("議員");
    expect(normalizeRole("10番")).toBe("議員");
  });

  it("副町長はそのまま返す", () => {
    expect(normalizeRole("副町長")).toBe("副町長");
  });

  it("教育長はそのまま返す", () => {
    expect(normalizeRole("教育長")).toBe("教育長");
  });

  it("総務課長は課長に正規化する", () => {
    expect(normalizeRole("総務課長")).toBe("課長");
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

  it("議員は question", () => {
    expect(classifyKind("議員")).toBe("question");
  });

  it("null は remark", () => {
    expect(classifyKind(null)).toBe("remark");
  });
});

describe("findSpeakerPositions", () => {
  it("議長パターンを検出する", () => {
    const text = "会議を開きます。 議長 伊藤秋雄 おはようございます。";
    const positions = findSpeakerPositions(text);

    expect(positions).toHaveLength(1);
    expect(positions[0]!.role).toBe("議長");
    expect(positions[0]!.name).toBe("伊藤秋雄");
  });

  it("複数の発言者を検出する", () => {
    const text =
      "議長 伊藤秋雄 ただいまから会議を開きます。 ２番 小柳聡 質問します。 町長 畠山菊夫 お答えします。";
    const positions = findSpeakerPositions(text);

    expect(positions).toHaveLength(3);
    expect(positions[0]!.role).toBe("議長");
    expect(positions[0]!.name).toBe("伊藤秋雄");
    expect(positions[1]!.role).toBe("２番");
    expect(positions[1]!.name).toBe("小柳聡");
    expect(positions[2]!.role).toBe("町長");
    expect(positions[2]!.name).toBe("畠山菊夫");
  });

  it("課長パターンを検出する", () => {
    const text = "はい、産業課長。 産業課長 相澤重則 ご説明いたします。";
    const positions = findSpeakerPositions(text);

    expect(positions).toHaveLength(1);
    expect(positions[0]!.role).toBe("産業課長");
    expect(positions[0]!.name).toBe("相澤重則");
  });

  it("名前に空白がある場合を処理する", () => {
    const text = "議長 伊藤 秋雄 おはようございます。";
    const positions = findSpeakerPositions(text);

    expect(positions).toHaveLength(1);
    expect(positions[0]!.name).toBe("伊藤秋雄");
  });

  it("議会運営委員長パターンを検出する", () => {
    const text =
      "報告を求めます。 議会運営委員長 畠山一充 ご報告いたします。";
    const positions = findSpeakerPositions(text);

    expect(positions).toHaveLength(1);
    expect(positions[0]!.role).toBe("議会運営委員長");
    expect(positions[0]!.name).toBe("畠山一充");
  });
});

describe("parseStatements", () => {
  it("発言者パターンでテキストを分割する", () => {
    const text =
      "議長 伊藤秋雄 ただいまから本日の会議を開きます。 ２番 小柳聡 質問があります。 町長 畠山菊夫 お答えします。";
    const statements = parseStatements(text);

    expect(statements).toHaveLength(3);

    expect(statements[0]!.kind).toBe("remark");
    expect(statements[0]!.speakerName).toBe("伊藤秋雄");
    expect(statements[0]!.speakerRole).toBe("議長");
    expect(statements[0]!.content).toBe(
      "ただいまから本日の会議を開きます。",
    );

    expect(statements[1]!.kind).toBe("question");
    expect(statements[1]!.speakerName).toBe("小柳聡");
    expect(statements[1]!.speakerRole).toBe("議員");

    expect(statements[2]!.kind).toBe("answer");
    expect(statements[2]!.speakerName).toBe("畠山菊夫");
    expect(statements[2]!.speakerRole).toBe("町長");
  });

  it("各 statement に contentHash が付与される", () => {
    const text = "議長 伊藤秋雄 テスト発言。";
    const statements = parseStatements(text);
    expect(statements[0]!.contentHash).toMatch(/^[a-f0-9]{64}$/);
  });

  it("offset が正しく計算される", () => {
    const text =
      "議長 伊藤秋雄 ただいま。 ２番 小柳聡 質問です。";
    const statements = parseStatements(text);

    expect(statements[0]!.startOffset).toBe(0);
    expect(statements[0]!.endOffset).toBe("ただいま。".length);
    expect(statements[1]!.startOffset).toBe("ただいま。".length + 1);
  });

  it("空テキストは空配列を返す", () => {
    expect(parseStatements("")).toEqual([]);
  });

  it("発言者がないテキストは空配列を返す", () => {
    expect(parseStatements("これは議事録です。")).toEqual([]);
  });

  it("課長の発言を answer として分類する", () => {
    const text =
      "議長 伊藤秋雄 はい、産業課長。 産業課長 相澤重則 ご説明いたします。";
    const statements = parseStatements(text);

    expect(statements).toHaveLength(2);
    expect(statements[1]!.kind).toBe("answer");
    expect(statements[1]!.speakerRole).toBe("課長");
    expect(statements[1]!.speakerName).toBe("相澤重則");
  });
});

describe("extractHeldOn", () => {
  it("PDF テキストから令和の日付を抽出する（全角数字）", () => {
    const text =
      "令和６年１２月１０日（火） 八郎潟町議会12月定例会会議録";
    expect(extractHeldOn(text, "令和6年八郎潟町議会12月定例会")).toBe(
      "2024-12-10",
    );
  });

  it("PDF テキストから平成の日付を抽出する", () => {
    const text = "平成30年3月5日（月曜日） 八郎潟町議会3月定例会会議録";
    expect(extractHeldOn(text, "平成30年八郎潟町議会3月定例会")).toBe(
      "2018-03-05",
    );
  });

  it("令和元年に対応する", () => {
    const text =
      "令和元年９月１０日（火曜日） 八郎潟町議会9月定例会会議録";
    expect(extractHeldOn(text, "令和元年八郎潟町議会9月定例会")).toBe(
      "2019-09-10",
    );
  });

  it("PDF テキストに日付がない場合はタイトルから推定する", () => {
    const text = "八郎潟町議会議事録";
    expect(
      extractHeldOn(text, "令和6年八郎潟町議会12月定例会議事録"),
    ).toBe("2024-12-01");
  });

  it("タイトルからも日付が取れない場合は null を返す", () => {
    expect(extractHeldOn("テキスト", "不明な会議")).toBeNull();
  });
});
