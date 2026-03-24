import { describe, expect, it } from "vitest";
import { classifyKind, parseStatements } from "./detail";

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

  it("議会事務局長は remark", () => {
    expect(classifyKind("議会事務局長")).toBe("remark");
  });

  it("事務局長は remark", () => {
    expect(classifyKind("事務局長")).toBe("remark");
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

  it("総務企画課長は answer", () => {
    expect(classifyKind("総務企画課長")).toBe("answer");
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
  it("東峰村 PDF 形式（スペース入り役職名）で発言を分割する", () => {
    // 実際の PDF から抽出した形式に近いテキスト
    const text =
      "開 会 議 長 おはようございます。ただ今の出席議員数は、９名です。 " +
      "議 長 本会議に先立ち、諸般報告を行います。 " +
      "村 長 皆さん、おはようございます。本日ここに定例会を招集いたしました。";

    const statements = parseStatements(text);

    expect(statements.length).toBeGreaterThanOrEqual(2);

    const chairmanStatements = statements.filter((s) => s.speakerRole === "議長");
    expect(chairmanStatements.length).toBeGreaterThanOrEqual(1);
    expect(chairmanStatements[0]!.kind).toBe("remark");

    const mayorStatements = statements.filter((s) => s.speakerRole === "村長");
    expect(mayorStatements.length).toBeGreaterThanOrEqual(1);
    expect(mayorStatements[0]!.kind).toBe("answer");
  });

  it("番号議員パターンを解析する", () => {
    const text =
      "議 長 日程第２に移ります。 " +
      "９ 番 今期定例会の議会運営について報告します。 " +
      "議 長 ただ今、報告がありました。";

    const statements = parseStatements(text);

    const memberStatements = statements.filter((s) => s.speakerRole === "議員");
    expect(memberStatements.length).toBeGreaterThanOrEqual(1);
    expect(memberStatements[0]!.kind).toBe("question");
  });

  it("課長パターンを解析する", () => {
    const text =
      "議 長 課長に補足説明を求めます。 " +
      "総務企画課長 １７ページをお願いします。承認第４号についてご説明します。 " +
      "議 長 補足説明が終わりました。";

    const statements = parseStatements(text);

    const kachoStatements = statements.filter((s) => s.speakerRole === "総務企画課長");
    expect(kachoStatements.length).toBeGreaterThanOrEqual(1);
    expect(kachoStatements[0]!.kind).toBe("answer");
    expect(kachoStatements[0]!.content).toContain("１７ページ");
  });

  it("各 statement に contentHash が付与される", () => {
    const text = "議 長 テスト発言です。";
    const statements = parseStatements(text);

    expect(statements.length).toBeGreaterThanOrEqual(1);
    expect(statements[0]!.contentHash).toMatch(/^[a-f0-9]{64}$/);
  });

  it("offset が連続して設定される", () => {
    const text =
      "議 長 ただいま。 " +
      "村 長 お答えします。";

    const statements = parseStatements(text);
    expect(statements.length).toBeGreaterThanOrEqual(2);

    // offset は連続している
    expect(statements[0]!.startOffset).toBe(0);
    expect(statements[0]!.endOffset).toBeGreaterThan(0);
    expect(statements[1]!.startOffset).toBeGreaterThan(statements[0]!.endOffset);
  });

  it("空テキストは空配列を返す", () => {
    expect(parseStatements("")).toEqual([]);
  });

  it("発言者ラベルのない短いテキストは空配列を返す", () => {
    expect(parseStatements("これはテストです。")).toEqual([]);
  });

  it("副村長パターンを解析する", () => {
    const text =
      "議 長 副村長 副 村 長 副村長よりご報告します。 " +
      "議 長 ご報告が終わりました。";

    const statements = parseStatements(text);

    const viceMayorStatements = statements.filter((s) => s.speakerRole === "副村長");
    expect(viceMayorStatements.length).toBeGreaterThanOrEqual(1);
    expect(viceMayorStatements[0]!.kind).toBe("answer");
  });

  it("全角数字の番号議員も解析する", () => {
    const text =
      "議 長 一般質問を行います。 " +
      "５ 番 私は持続可能な農業について質問します。";

    const statements = parseStatements(text);

    const memberStatements = statements.filter((s) => s.speakerRole === "議員");
    expect(memberStatements.length).toBeGreaterThanOrEqual(1);
    expect(memberStatements[0]!.kind).toBe("question");
    expect(memberStatements[0]!.content).toContain("持続可能な農業");
  });
});
