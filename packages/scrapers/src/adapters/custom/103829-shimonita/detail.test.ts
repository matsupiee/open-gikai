import { describe, expect, it } from "vitest";
import {
  parseSpeaker,
  classifyKind,
  parseStatements,
} from "./detail";

describe("parseSpeaker", () => {
  it("議長を正しくパースする（スペース区切り）", () => {
    const result = parseSpeaker("○議長 佐藤博 おはようございます。");
    expect(result.speakerName).toBe("佐藤博");
    expect(result.speakerRole).toBe("議長");
    expect(result.content).toBe("おはようございます。");
  });

  it("町長を正しくパースする（スペース区切り）", () => {
    const result = parseSpeaker("○町長 岩崎正春 お答えいたします。");
    expect(result.speakerName).toBe("岩崎正春");
    expect(result.speakerRole).toBe("町長");
    expect(result.content).toBe("お答えいたします。");
  });

  it("副町長を正しくパースする", () => {
    const result = parseSpeaker("○副町長 田中次郎 ご説明いたします。");
    expect(result.speakerName).toBe("田中次郎");
    expect(result.speakerRole).toBe("副町長");
  });

  it("課長を正しくパースする（複合役職名）", () => {
    const result = parseSpeaker("○総務課長 下山光一 ご報告いたします。");
    expect(result.speakerName).toBe("下山光一");
    expect(result.speakerRole).toBe("課長");
  });

  it("副委員長を正しくパースする（長い方を優先）", () => {
    const result = parseSpeaker("○副委員長 高橋四郎 審議いたします。");
    expect(result.speakerName).toBe("高橋四郎");
    expect(result.speakerRole).toBe("副委員長");
  });

  it("委員長を正しくパースする", () => {
    const result = parseSpeaker("○総務常任委員長 伊藤五郎 報告いたします。");
    expect(result.speakerName).toBe("伊藤五郎");
    expect(result.speakerRole).toBe("委員長");
  });

  it("議員番号パターンを正しくパースする（全角数字）", () => {
    const result = parseSpeaker("○１番 堀越健介 質問いたします。");
    expect(result.speakerName).toBe("堀越健介");
    expect(result.speakerRole).toBe("議員");
    expect(result.content).toBe("質問いたします。");
  });

  it("２桁の議員番号もパースする", () => {
    const result = parseSpeaker("○１０番 堀口博志 質問します。");
    expect(result.speakerName).toBe("堀口博志");
    expect(result.speakerRole).toBe("議員");
  });

  it("議会事務局長をパースする", () => {
    const result = parseSpeaker("○議会事務局長 佐藤正明 命によりまして...");
    expect(result.speakerName).toBe("佐藤正明");
    expect(result.speakerRole).not.toBeNull();
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

  it("課長は answer", () => {
    expect(classifyKind("課長")).toBe("answer");
  });

  it("部長は answer", () => {
    expect(classifyKind("部長")).toBe("answer");
  });

  it("議員は question", () => {
    expect(classifyKind("議員")).toBe("question");
  });

  it("null は remark", () => {
    expect(classifyKind(null)).toBe("remark");
  });
});

describe("parseStatements", () => {
  it("○ 区切りで発言を抽出する（下仁田町形式）", () => {
    // 下仁田町のPDFはmergePages: trueで改行なし・○区切りの形式
    const text =
      "○議長 佐藤博 おはようございます。ただいまから会議を開きます。 " +
      "○１番 堀越健介 質問いたします。 " +
      "○町長 岩崎正春 お答えいたします。";

    const statements = parseStatements(text);

    expect(statements).toHaveLength(3);

    expect(statements[0]!.speakerName).toBe("佐藤博");
    expect(statements[0]!.speakerRole).toBe("議長");
    expect(statements[0]!.kind).toBe("remark");
    expect(statements[0]!.content).toContain("おはようございます。");

    expect(statements[1]!.speakerName).toBe("堀越健介");
    expect(statements[1]!.speakerRole).toBe("議員");
    expect(statements[1]!.kind).toBe("question");

    expect(statements[2]!.speakerName).toBe("岩崎正春");
    expect(statements[2]!.speakerRole).toBe("町長");
    expect(statements[2]!.kind).toBe("answer");
  });

  it("ページ番号行（- {数字} -）を除去する", () => {
    const text =
      "○議長 佐藤博 ただいまから会議を開きます。 - 2 - " +
      "○１番 堀越健介 質問します。";

    const statements = parseStatements(text);

    expect(statements).toHaveLength(2);
    expect(statements[0]!.content).not.toContain("- 2 -");
  });

  it("区切り線（──）をスキップする", () => {
    const text =
      "○議長 佐藤博 開会します。 " +
      "────────────────── " +
      "○町長 岩崎正春 挨拶します。";

    const statements = parseStatements(text);

    expect(statements).toHaveLength(2);
    expect(statements[0]!.speakerRole).toBe("議長");
    expect(statements[1]!.speakerRole).toBe("町長");
  });

  it("contentHash が生成される", () => {
    const text = "○議長 佐藤博 ただいまから会議を開きます。";
    const statements = parseStatements(text);
    expect(statements).toHaveLength(1);
    expect(statements[0]!.contentHash).toMatch(/^[a-f0-9]{64}$/);
  });

  it("startOffset と endOffset が設定される", () => {
    const text =
      "○議長 佐藤博 開会します。 ○町長 岩崎正春 お答えします。";

    const statements = parseStatements(text);

    expect(statements).toHaveLength(2);
    expect(statements[0]!.startOffset).toBe(0);
    expect(statements[0]!.endOffset).toBeGreaterThan(0);
    expect(statements[1]!.startOffset).toBeGreaterThan(statements[0]!.endOffset);
  });

  it("発言者がいない場合は空配列を返す", () => {
    const text = "議事日程 第1 開会 第2 議案審議";
    const statements = parseStatements(text);
    expect(statements).toHaveLength(0);
  });

  it("content が空の発言ブロックをスキップする", () => {
    // ○ で始まるが発言内容がないブロック（出席チェックなど）
    const text = "議 員 ○ ○ ○議長 佐藤博 開会します。";
    const statements = parseStatements(text);
    // "議 員 " ブロックは発言者パターンに一致しないのでスキップ
    // "○議長 佐藤博 開会します。" が正しくパースされる
    const speakerStatements = statements.filter((s) => s.speakerName);
    expect(speakerStatements.length).toBeGreaterThan(0);
  });
});
