import { describe, expect, it } from "vitest";
import { parseQuestionLine, parseAnswerLine, parseStatements } from "./detail";
import { parsePdfTitleDate, parseMeetingTitle, warekiNenToSeireki } from "./shared";

describe("warekiNenToSeireki", () => {
  it("令和5年を2023年に変換する", () => {
    expect(warekiNenToSeireki("令和", 5)).toBe(2023);
  });

  it("令和7年を2025年に変換する", () => {
    expect(warekiNenToSeireki("令和", 7)).toBe(2025);
  });

  it("令和1年を2019年に変換する", () => {
    expect(warekiNenToSeireki("令和", 1)).toBe(2019);
  });

  it("平成31年を2019年に変換する", () => {
    expect(warekiNenToSeireki("平成", 31)).toBe(2019);
  });
});

describe("parsePdfTitleDate", () => {
  it("令和7年第1回定例会（3月13日召集）を 2025-03-13 に変換する", () => {
    expect(parsePdfTitleDate("令和７年第１回定例会（３月１３日召集）")).toBe("2025-03-13");
  });

  it("全角数字を含む形式を正しくパースする", () => {
    expect(parsePdfTitleDate("令和６年第２回定例会（６月１日召集）")).toBe("2024-06-01");
  });

  it("半角数字を含む形式を正しくパースする", () => {
    expect(parsePdfTitleDate("令和5年第3回定例会（9月5日召集）")).toBe("2023-09-05");
  });

  it("解析できない場合は null を返す", () => {
    expect(parsePdfTitleDate("令和7年第1回定例会")).toBeNull();
    expect(parsePdfTitleDate("一般質問と答弁")).toBeNull();
    expect(parsePdfTitleDate("")).toBeNull();
  });
});

describe("parseMeetingTitle", () => {
  it("「令和5年第1回定例会」を year=2023, session=1 に変換する", () => {
    const result = parseMeetingTitle("令和5年第1回定例会");
    expect(result).not.toBeNull();
    expect(result!.year).toBe(2023);
    expect(result!.session).toBe(1);
  });

  it("「令和６年第４回定例会.pdf」（全角数字）を year=2024, session=4 に変換する", () => {
    const result = parseMeetingTitle("令和６年第４回定例会.pdf");
    expect(result).not.toBeNull();
    expect(result!.year).toBe(2024);
    expect(result!.session).toBe(4);
  });

  it("解析できない文字列は null を返す", () => {
    expect(parseMeetingTitle("")).toBeNull();
    expect(parseMeetingTitle("一般質問")).toBeNull();
  });
});

describe("parseQuestionLine", () => {
  it("○質問　議員名「質問タイトル」をパースする", () => {
    const result = parseQuestionLine("○質問　上杉達則議員「米の価格高騰についての対策」");
    expect(result).not.toBeNull();
    expect(result!.speakerName).toBe("上杉達則");
    expect(result!.title).toBe("米の価格高騰についての対策");
  });

  it("全角括弧「」のパターンをパースする", () => {
    const result = parseQuestionLine("○質問　田中一郎議員「農業振興策について」");
    expect(result).not.toBeNull();
    expect(result!.speakerName).toBe("田中一郎");
    expect(result!.title).toBe("農業振興策について");
  });

  it("○答弁 行は null を返す", () => {
    const result = parseQuestionLine("○答弁　村椿哲朗町長");
    expect(result).toBeNull();
  });

  it("マーカーなしの行は null を返す", () => {
    const result = parseQuestionLine("一般質問と答弁");
    expect(result).toBeNull();
  });
});

describe("parseAnswerLine", () => {
  it("○答弁　役職名をパースする", () => {
    const result = parseAnswerLine("○答弁　村椿哲朗町長");
    expect(result).not.toBeNull();
    expect(result!.speakerName).toBe("村椿哲朗町長");
  });

  it("○答弁　副町長をパースする", () => {
    const result = parseAnswerLine("○答弁　山田太郎副町長");
    expect(result).not.toBeNull();
    expect(result!.speakerName).toBe("山田太郎副町長");
  });

  it("○質問 行は null を返す", () => {
    const result = parseAnswerLine("○質問　上杉達則議員「米の価格高騰についての対策」");
    expect(result).toBeNull();
  });

  it("マーカーなしの行は null を返す", () => {
    const result = parseAnswerLine("答弁　町長");
    expect(result).toBeNull();
  });
});

describe("parseStatements", () => {
  it("質問と答弁を正しく抽出する", () => {
    const text = `
令和７年第１回定例会（３月１３日召集）

○質問　上杉達則議員「米の価格高騰についての対策」
  昨年来の米の価格高騰に対する町の支援策について伺います。

○答弁　村椿哲朗町長
  ご質問にお答えします。本町では農家への支援として補助金を交付しております。
    `;

    const statements = parseStatements(text);

    expect(statements).toHaveLength(2);

    expect(statements[0]!.kind).toBe("question");
    expect(statements[0]!.speakerName).toBe("上杉達則");
    expect(statements[0]!.speakerRole).toBe("議員");
    expect(statements[0]!.content).toContain("米の価格高騰についての対策");

    expect(statements[1]!.kind).toBe("answer");
    expect(statements[1]!.speakerName).toBe("村椿哲朗町長");
    expect(statements[1]!.speakerRole).toBe("村椿哲朗町長");
    expect(statements[1]!.content).toContain("ご質問にお答えします");
  });

  it("複数の質問・答弁セットを抽出する", () => {
    const text = `
○質問　田中一郎議員「農業振興策について」
  農業の担い手不足について質問します。

○答弁　鈴木副町長
  担い手確保に向けた施策を進めています。

○質問　佐藤花子議員「子育て支援について」
  保育所の整備について伺います。

○答弁　山田教育長
  保育所の拡充を検討しています。
    `;

    const statements = parseStatements(text);

    expect(statements).toHaveLength(4);
    expect(statements[0]!.kind).toBe("question");
    expect(statements[0]!.speakerName).toBe("田中一郎");
    expect(statements[1]!.kind).toBe("answer");
    expect(statements[2]!.kind).toBe("question");
    expect(statements[2]!.speakerName).toBe("佐藤花子");
    expect(statements[3]!.kind).toBe("answer");
  });

  it("contentHash が SHA-256 形式で生成される", () => {
    const text = `○質問　田中一郎議員「農業振興策について」\n農業の問題です。`;

    const statements = parseStatements(text);

    expect(statements[0]!.contentHash).toMatch(/^[a-f0-9]{64}$/);
  });

  it("複数行にわたる発言をまとめる", () => {
    const text = `
○質問　上杉達則議員「米の価格高騰についての対策」
  昨年来の米の価格高騰について。
  具体的な支援策を求めます。

○答弁　村椿哲朗町長
  お答えします。
    `;

    const statements = parseStatements(text);

    expect(statements).toHaveLength(2);
    expect(statements[0]!.content).toContain("米の価格高騰についての対策");
    expect(statements[0]!.content).toContain("昨年来の米の価格高騰について。");
    expect(statements[0]!.content).toContain("具体的な支援策を求めます。");
  });

  it("空テキストでは空配列を返す", () => {
    expect(parseStatements("")).toHaveLength(0);
    expect(parseStatements("   \n   ")).toHaveLength(0);
  });

  it("PDF ヘッダー行をスキップする", () => {
    const text = `
令和７年第１回定例会（３月１３日召集）
○質問　田中一郎議員「農業振興策について」
  農業の問題です。
    `;

    const statements = parseStatements(text);

    // ヘッダー行が発言に混入しないこと
    expect(statements).toHaveLength(1);
    expect(statements[0]!.content).not.toContain("令和");
  });

  it("offset が正しく計算される", () => {
    const text = `
○質問　田中一郎議員「農業」
農業の問題です。
○答弁　鈴木町長
お答えします。
    `;

    const statements = parseStatements(text);

    expect(statements[0]!.startOffset).toBe(0);
    expect(statements[1]!.startOffset).toBeGreaterThan(0);
    expect(statements[1]!.startOffset).toBe(statements[0]!.endOffset + 1);
  });
});
