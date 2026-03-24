import { describe, it, expect } from "vitest";
import {
  parseSpeaker,
  classifyKind,
  parseStatements,
  parsePdfLabelDate,
} from "./detail";

describe("parseSpeaker", () => {
  it("カッコ形式: 議長（名前君）を解析する", () => {
    const result = parseSpeaker("○議長（山田太郎君） ただいまから会議を開きます。");
    expect(result.speakerName).toBe("山田太郎");
    expect(result.speakerRole).toBe("議長");
    expect(result.content).toBe("ただいまから会議を開きます。");
  });

  it("カッコ形式: 町長（名前君）を解析する", () => {
    const result = parseSpeaker("○町長（鈴木一郎君） お答えいたします。");
    expect(result.speakerName).toBe("鈴木一郎");
    expect(result.speakerRole).toBe("町長");
    expect(result.content).toBe("お答えいたします。");
  });

  it("カッコ形式: 番号議員パターンを解析する", () => {
    const result = parseSpeaker("○1番（田中花子君） 質問いたします。");
    expect(result.speakerName).toBe("田中花子");
    expect(result.speakerRole).toBe("議員");
    expect(result.content).toBe("質問いたします。");
  });

  it("カッコ形式: 副町長を解析する", () => {
    const result = parseSpeaker("○副町長（佐藤次郎君） ご説明いたします。");
    expect(result.speakerName).toBe("佐藤次郎");
    expect(result.speakerRole).toBe("副町長");
    expect(result.content).toBe("ご説明いたします。");
  });

  it("カッコ形式: 教育長を解析する", () => {
    const result = parseSpeaker("○教育長（中村三郎君） 答弁いたします。");
    expect(result.speakerName).toBe("中村三郎");
    expect(result.speakerRole).toBe("教育長");
    expect(result.content).toBe("答弁いたします。");
  });

  it("副委員長が委員長より優先される", () => {
    const result = parseSpeaker("○副委員長（佐藤花子君） ご報告いたします。");
    expect(result.speakerRole).toBe("副委員長");
  });

  it("○ マーカーなしのテキスト", () => {
    const result = parseSpeaker("午後１時開議");
    expect(result.speakerName).toBeNull();
    expect(result.speakerRole).toBeNull();
    expect(result.content).toBe("午後１時開議");
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

describe("parseStatements", () => {
  it("○ マーカーありのカッコ形式の発言を分割する", () => {
    const text = `○議長（山田太郎君） ただいまから会議を開きます。○1番（田中花子君） 質問があります。○町長（鈴木一郎君） お答えします。`;
    const statements = parseStatements(text);

    expect(statements).not.toBeNull();
    expect(statements).toHaveLength(3);

    expect(statements![0]!.kind).toBe("remark");
    expect(statements![0]!.speakerName).toBe("山田太郎");
    expect(statements![0]!.speakerRole).toBe("議長");

    expect(statements![1]!.kind).toBe("question");
    expect(statements![1]!.speakerName).toBe("田中花子");
    expect(statements![1]!.speakerRole).toBe("議員");

    expect(statements![2]!.kind).toBe("answer");
    expect(statements![2]!.speakerName).toBe("鈴木一郎");
    expect(statements![2]!.speakerRole).toBe("町長");
  });

  it("○ マーカーなしのテキストは単一の remark として扱う", () => {
    const text =
      "令和6年第9回定例会 議案第1号 本山町条例の一部改正について 可決";

    const statements = parseStatements(text);

    expect(statements).not.toBeNull();
    expect(statements).toHaveLength(1);
    expect(statements![0]!.kind).toBe("remark");
    expect(statements![0]!.speakerName).toBeNull();
    expect(statements![0]!.speakerRole).toBeNull();
    expect(statements![0]!.startOffset).toBe(0);
  });

  it("各 statement に contentHash が付与される", () => {
    const statements = parseStatements("○議長（山田太郎君） テスト発言。");
    expect(statements).not.toBeNull();
    expect(statements![0]!.contentHash).toMatch(/^[a-f0-9]{64}$/);
  });

  it("○ マーカーなしテキストにも contentHash が付与される", () => {
    const statements = parseStatements("議案第1号 可決");
    expect(statements).not.toBeNull();
    expect(statements![0]!.contentHash).toMatch(/^[a-f0-9]{64}$/);
  });

  it("空テキストは null を返す", () => {
    expect(parseStatements("")).toBeNull();
  });

  it("発言が抽出できない場合は null を返す", () => {
    // ○ マーカーがあるが、すべてスキップされるケース（短すぎる内容）
    const statements = parseStatements("○ ○ ○");
    expect(statements).toBeNull();
  });
});

describe("parsePdfLabelDate", () => {
  it("月日ラベルと会期開始日から YYYY-MM-DD を返す", () => {
    expect(parsePdfLabelDate("12月3日 開会日", "2024-12-03")).toBe("2024-12-03");
  });

  it("月日ラベルと会期開始日から別日付を返す（一般質問が別日）", () => {
    expect(parsePdfLabelDate("12月10日 一般質問", "2024-12-03")).toBe("2024-12-10");
  });

  it("月日パターンが含まれない場合は null を返す", () => {
    expect(parsePdfLabelDate("11月臨時会", "2024-11-01")).toBeNull();
  });

  it("heldOn が null の場合は null を返す", () => {
    expect(parsePdfLabelDate("12月3日 開会日", null)).toBeNull();
  });

  it("9月2日（令和7年）のラベルを処理できる", () => {
    expect(parsePdfLabelDate("9月2日 開会日", "2025-09-02")).toBe("2025-09-02");
  });
});
