import { describe, expect, it } from "vitest";
import { classifyKind, extractDateFromText, extractTitleFromText, parseStatements } from "./detail";

describe("classifyKind", () => {
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

  it("建設課長は answer（endsWith マッチ）", () => {
    expect(classifyKind("建設課長")).toBe("answer");
  });

  it("議員は question", () => {
    expect(classifyKind("議員")).toBe("question");
  });

  it("議長は remark", () => {
    expect(classifyKind("議長")).toBe("remark");
  });

  it("副議長は remark", () => {
    expect(classifyKind("副議長")).toBe("remark");
  });

  it("null は remark", () => {
    expect(classifyKind(null)).toBe("remark");
  });
});

describe("extractDateFromText", () => {
  it("PDF テキストから令和年月を抽出する", () => {
    const text = "寿都湾 No.208 令和8年2月 令和7年 第4回定例会";
    const result = extractDateFromText(text, { publishYear: null, publishMonth: null });
    expect(result).toBe("2026-02-01");
  });

  it("PDF テキストから平成年月を抽出する", () => {
    const text = "議会だより No.140 平成21年2月発行";
    const result = extractDateFromText(text, { publishYear: null, publishMonth: null });
    expect(result).toBe("2009-02-01");
  });

  it("全角数字の年月を抽出する", () => {
    const text = "令和３年８月発行";
    const result = extractDateFromText(text, { publishYear: null, publishMonth: null });
    expect(result).toBe("2021-08-01");
  });

  it("PDF テキストに年月がない場合は record のメタ情報を使用する", () => {
    const text = "議会だより 寿都湾 第4回定例会";
    const result = extractDateFromText(text, { publishYear: 2026, publishMonth: 2 });
    expect(result).toBe("2026-02-01");
  });

  it("PDF テキストにも record にも年月がない場合は null を返す", () => {
    const text = "議会だより 寿都湾";
    const result = extractDateFromText(text, { publishYear: null, publishMonth: null });
    expect(result).toBeNull();
  });
});

describe("extractTitleFromText", () => {
  it("PDF テキストから定例会タイトルを抽出する", () => {
    const text = "寿都湾 No.208 令和8年2月 令和7年 第4回定例会の報告";
    const result = extractTitleFromText(text, { linkText: "NO.208号（令和8年2月発行）", issueNumber: 208 });
    expect(result).toBe("令和7年 第4回定例会");
  });

  it("臨時会タイトルも抽出する", () => {
    const text = "令和6年 第1回臨時会 開催のご報告";
    const result = extractTitleFromText(text, { linkText: "NO.200号（令和6年2月発行）", issueNumber: 200 });
    expect(result).toBe("令和6年 第1回臨時会");
  });

  it("定例会タイトルがない場合は号数タイトルを返す", () => {
    const text = "寿都湾 議会だより";
    const result = extractTitleFromText(text, { linkText: "NO.208号（令和8年2月発行）", issueNumber: 208 });
    expect(result).toBe("議会だより寿都湾 No.208");
  });

  it("号数もない場合は linkText を返す", () => {
    const text = "寿都湾";
    const result = extractTitleFromText(text, { linkText: "NO.208号（令和8年2月発行）", issueNumber: null });
    expect(result).toBe("NO.208号（令和8年2月発行）");
  });
});

describe("parseStatements", () => {
  it("■ 質問 と ● 答弁者 のパターンから発言を抽出する", () => {
    const text = [
      "■ 質問",
      "田中太郎　議員",
      "",
      "農業振興についてお聞きします。今後の方針はどうなっていますか。",
      "",
      "● 町長",
      "農業振興については積極的に取り組んでまいります。",
    ].join("\n");

    const statements = parseStatements(text);

    expect(statements.length).toBeGreaterThan(0);
    const questionStmt = statements.find((s) => s.kind === "question");
    expect(questionStmt).toBeDefined();
    expect(questionStmt!.speakerName).toBe("田中太郎");
    expect(questionStmt!.speakerRole).toBe("議員");

    const answerStmt = statements.find((s) => s.kind === "answer");
    expect(answerStmt).toBeDefined();
    expect(answerStmt!.speakerRole).toBe("町長");
  });

  it("■ 再質問 と ● 答弁者 のパターンも処理する", () => {
    const text = [
      "■ 質問",
      "鈴木花子　議員",
      "",
      "道路整備についてお聞きします。",
      "",
      "● 副町長",
      "道路整備については予算を確保していきます。",
      "",
      "■ 再質問",
      "具体的なスケジュールを教えてください。",
      "",
      "● 副町長",
      "来年度中に着工予定です。",
    ].join("\n");

    const statements = parseStatements(text);

    expect(statements.length).toBeGreaterThan(0);
    const answerStatements = statements.filter((s) => s.kind === "answer");
    expect(answerStatements.length).toBeGreaterThanOrEqual(1);
    expect(answerStatements[0]!.speakerRole).toBe("副町長");
  });

  it("contentHash が SHA-256 の hex 文字列である", () => {
    const text = [
      "■ 質問",
      "山田一郎　議員",
      "",
      "環境問題についてお聞きします。",
      "",
      "● 教育長",
      "環境教育を推進していきます。",
    ].join("\n");

    const statements = parseStatements(text);
    expect(statements.length).toBeGreaterThan(0);
    for (const stmt of statements) {
      expect(stmt.contentHash).toMatch(/^[a-f0-9]{64}$/);
    }
  });

  it("startOffset が正しく計算される", () => {
    const text = [
      "■ 質問",
      "山田一郎　議員",
      "",
      "環境問題についてお聞きします。",
      "",
      "● 町長",
      "積極的に取り組みます。",
    ].join("\n");

    const statements = parseStatements(text);
    expect(statements.length).toBeGreaterThan(0);
    expect(statements[0]!.startOffset).toBe(0);
  });

  it("■ と ● がない場合は空配列を返す", () => {
    const text = [
      "寿都湾 No.208",
      "令和8年2月発行",
      "議会だより",
    ].join("\n");

    const statements = parseStatements(text);
    expect(statements).toHaveLength(0);
  });

  it("5文字未満のコンテンツはスキップされる", () => {
    const text = [
      "■ 質問",
      "山田一郎　議員",
      "",
      "以上。",
      "",
      "● 町長",
      "はい。",
    ].join("\n");

    const statements = parseStatements(text);
    // 短いコンテンツはスキップされる
    expect(statements.length).toBe(0);
  });
});
