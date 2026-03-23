import { describe, expect, it } from "vitest";
import { parseSpeaker, classifyKind, parseStatements } from "./detail";

describe("parseSpeaker", () => {
  it("議員名を正しく抽出する", () => {
    const result = parseSpeaker("三澤隆一議員");
    expect(result.speakerName).toBe("三澤隆一");
    expect(result.speakerRole).toBe("議員");
  });

  it("別の議員名を正しく抽出する", () => {
    const result = parseSpeaker("日高久江議員");
    expect(result.speakerName).toBe("日高久江");
    expect(result.speakerRole).toBe("議員");
  });

  it("null の場合は null を返す", () => {
    const result = parseSpeaker(null);
    expect(result.speakerName).toBeNull();
    expect(result.speakerRole).toBeNull();
  });

  it("議員の接尾辞がないパターン", () => {
    const result = parseSpeaker("議会事務局");
    expect(result.speakerName).toBe("議会事務局");
    expect(result.speakerRole).toBeNull();
  });
});

describe("classifyKind", () => {
  it("speaker が null の場合は remark", () => {
    expect(classifyKind(null)).toBe("remark");
  });

  it("speaker が議員名の場合は question", () => {
    expect(classifyKind("三澤隆一議員")).toBe("question");
  });

  it("speaker が空でない任意の文字列は question", () => {
    expect(classifyKind("何かのテキスト")).toBe("question");
  });
});

describe("parseStatements", () => {
  it("playlist から statements を生成する", () => {
    const statements = parseStatements([
      {
        playlist_id: "1",
        speaker: "三澤隆一議員",
        speaker_id: "2",
        content:
          "１　フードドライブについて\n　(1)　本市で実施されたフードドライブの実績について",
      },
      {
        playlist_id: "2",
        speaker: "日高久江議員",
        speaker_id: "40",
        content: "１　心のサポーターについて",
      },
    ]);

    expect(statements).toHaveLength(2);

    expect(statements[0]!.kind).toBe("question");
    expect(statements[0]!.speakerName).toBe("三澤隆一");
    expect(statements[0]!.speakerRole).toBe("議員");
    expect(statements[0]!.content).toBe(
      "１　フードドライブについて\n　(1)　本市で実施されたフードドライブの実績について",
    );
    expect(statements[0]!.contentHash).toMatch(/^[a-f0-9]{64}$/);
    expect(statements[0]!.startOffset).toBe(0);

    expect(statements[1]!.kind).toBe("question");
    expect(statements[1]!.speakerName).toBe("日高久江");
    expect(statements[1]!.content).toBe("１　心のサポーターについて");
    expect(statements[1]!.startOffset).toBe(statements[0]!.endOffset + 1);
  });

  it("speaker が null の場合は remark として扱う", () => {
    const statements = parseStatements([
      {
        playlist_id: "1",
        speaker: null,
        speaker_id: "0",
        content: "　本会議　午前１０時開議\n１　開会\n２　議案上程",
      },
    ]);

    expect(statements).toHaveLength(1);
    expect(statements[0]!.kind).toBe("remark");
    expect(statements[0]!.speakerName).toBeNull();
    expect(statements[0]!.speakerRole).toBeNull();
  });

  it("content が空の playlist item はスキップする", () => {
    const statements = parseStatements([
      {
        playlist_id: "1",
        speaker: null,
        speaker_id: "0",
        content: "",
      },
      {
        playlist_id: "2",
        speaker: "三澤隆一議員",
        speaker_id: "2",
        content: "１　フードドライブについて",
      },
    ]);

    expect(statements).toHaveLength(1);
    expect(statements[0]!.speakerName).toBe("三澤隆一");
  });

  it("空の playlist は空配列を返す", () => {
    const statements = parseStatements([]);
    expect(statements).toHaveLength(0);
  });

  it("contentHash は playlist_id と content から生成される", () => {
    const statements1 = parseStatements([
      {
        playlist_id: "1",
        speaker: null,
        speaker_id: "0",
        content: "テスト",
      },
    ]);

    const statements2 = parseStatements([
      {
        playlist_id: "2",
        speaker: null,
        speaker_id: "0",
        content: "テスト",
      },
    ]);

    // 同じ content でも playlist_id が異なれば hash は異なる
    expect(statements1[0]!.contentHash).not.toBe(statements2[0]!.contentHash);
  });

  it("offset が正しく計算される", () => {
    const statements = parseStatements([
      {
        playlist_id: "1",
        speaker: null,
        speaker_id: "0",
        content: "あいう",
      },
      {
        playlist_id: "2",
        speaker: null,
        speaker_id: "0",
        content: "えお",
      },
    ]);

    expect(statements[0]!.startOffset).toBe(0);
    expect(statements[0]!.endOffset).toBe(3);
    expect(statements[1]!.startOffset).toBe(4);
    expect(statements[1]!.endOffset).toBe(6);
  });
});
