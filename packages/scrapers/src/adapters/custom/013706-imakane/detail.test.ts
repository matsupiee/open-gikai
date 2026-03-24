import { describe, expect, it } from "vitest";
import { parseSpeaker, classifyKind, parseStatements, extractDateFromText, extractTitleFromText } from "./detail";

describe("parseSpeaker", () => {
  it("議長（名前）形式をパースする", () => {
    const result = parseSpeaker("〇議長（山田太郎） ただいまから本日の会議を開きます。");
    expect(result.speakerName).toBe("山田太郎");
    expect(result.speakerRole).toBe("議長");
    expect(result.content).toBe("ただいまから本日の会議を開きます。");
  });

  it("町長（名前）形式をパースする", () => {
    const result = parseSpeaker("〇町長（佐藤一郎） ご説明いたします。");
    expect(result.speakerName).toBe("佐藤一郎");
    expect(result.speakerRole).toBe("町長");
    expect(result.content).toBe("ご説明いたします。");
  });

  it("３番（名前）形式をパースする", () => {
    const result = parseSpeaker("〇３番（鈴木花子） 質問します。");
    expect(result.speakerName).toBe("鈴木花子");
    expect(result.speakerRole).toBe("3番");
    expect(result.content).toBe("質問します。");
  });

  it("副議長（名前）形式をパースする", () => {
    const result = parseSpeaker("〇副議長（田中次郎） 会議を続けます。");
    expect(result.speakerName).toBe("田中次郎");
    expect(result.speakerRole).toBe("副議長");
    expect(result.content).toBe("会議を続けます。");
  });

  it("委員長（名前）形式をパースする", () => {
    const result = parseSpeaker("〇委員長（高橋三郎） ただいまより委員会を開会します。");
    expect(result.speakerName).toBe("高橋三郎");
    expect(result.speakerRole).toBe("委員長");
    expect(result.content).toBe("ただいまより委員会を開会します。");
  });

  it("マーカーなしのテキスト", () => {
    const result = parseSpeaker("午前10時開議");
    expect(result.speakerName).toBeNull();
    expect(result.speakerRole).toBeNull();
    expect(result.content).toBe("午前10時開議");
  });

  it("〇マーカー（〇）形式も処理する", () => {
    const result = parseSpeaker("○議長（山田太郎） 開会します。");
    expect(result.speakerName).toBe("山田太郎");
    expect(result.speakerRole).toBe("議長");
    expect(result.content).toBe("開会します。");
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

  it("課長は answer", () => {
    expect(classifyKind("課長")).toBe("answer");
  });

  it("番号（議員）は question", () => {
    expect(classifyKind("3番")).toBe("question");
  });

  it("null は remark", () => {
    expect(classifyKind(null)).toBe("remark");
  });
});

describe("extractDateFromText", () => {
  it("令和年号の日付をパースする", () => {
    const text = "令和７年６月１２日（木）";
    expect(extractDateFromText(text)).toBe("2025-06-12");
  });

  it("平成年号の日付をパースする", () => {
    const text = "平成28年9月13日（火）";
    expect(extractDateFromText(text)).toBe("2016-09-13");
  });

  it("全角数字の日付をパースする", () => {
    const text = "令和６年１月２３日（火）";
    expect(extractDateFromText(text)).toBe("2024-01-23");
  });

  it("日付が含まれない場合は null を返す", () => {
    const text = "会議録";
    expect(extractDateFromText(text)).toBeNull();
  });
});

describe("extractTitleFromText", () => {
  it("定例会タイトルを抽出する", () => {
    const text = "令和７年第２回今金町議会定例会　第１号\n令和７年６月１２日（木）";
    const title = extractTitleFromText(text);
    expect(title).toBe("令和７年第２回今金町議会定例会　第１号");
  });

  it("臨時会タイトルを抽出する", () => {
    const text = "令和５年第１回今金町議会臨時会　第１号";
    const title = extractTitleFromText(text);
    expect(title).toBe("令和５年第１回今金町議会臨時会　第１号");
  });

  it("常任委員会タイトルを抽出する", () => {
    const text = "総 務 産 業 常 任 委 員 会\n期　日　令和６年１月２３日（火）";
    // 連続するスペース除去後は「総 務 産 業 常 任 委 員 会」のまま
    // extractTitleFromText は「常任委員会」を含む行を探す
    const title = extractTitleFromText(text);
    expect(title).not.toBeNull();
  });

  it("タイトルが抽出できない場合は null を返す", () => {
    const text = "このテキストには会議名が含まれていません";
    expect(extractTitleFromText(text)).toBeNull();
  });
});

describe("parseStatements", () => {
  it("〇マーカー行から発言を抽出する", () => {
    const text = [
      "令和７年第２回今金町議会定例会　第１号",
      "令和７年６月１２日（木）",
      "",
      "〇議長（山田太郎） ただいまから本日の会議を開きます。",
      "〇町長（佐藤一郎） ご説明いたします。",
      "〇３番（鈴木花子） 質問いたします。",
    ].join("\n");

    const statements = parseStatements(text);

    expect(statements).toHaveLength(3);
    expect(statements[0]!.speakerName).toBe("山田太郎");
    expect(statements[0]!.speakerRole).toBe("議長");
    expect(statements[0]!.kind).toBe("remark");
    expect(statements[1]!.speakerName).toBe("佐藤一郎");
    expect(statements[1]!.speakerRole).toBe("町長");
    expect(statements[1]!.kind).toBe("answer");
    expect(statements[2]!.speakerName).toBe("鈴木花子");
    expect(statements[2]!.speakerRole).toBe("3番");
    expect(statements[2]!.kind).toBe("question");
  });

  it("contentHash が SHA-256 形式で生成される", () => {
    const text = "〇議長（山田太郎） ただいまから会議を開きます。";
    const statements = parseStatements(text);
    expect(statements[0]!.contentHash).toMatch(/^[a-f0-9]{64}$/);
  });

  it("startOffset と endOffset が正しく計算される", () => {
    const text = [
      "〇議長（山田太郎） ただいま。",
      "〇町長（佐藤一郎） お答えします。",
    ].join("\n");

    const statements = parseStatements(text);
    expect(statements[0]!.startOffset).toBe(0);
    expect(statements[0]!.endOffset).toBe("ただいま。".length);
    expect(statements[1]!.startOffset).toBe("ただいま。".length + 1);
  });

  it("発言のない PDF テキストは空配列を返す", () => {
    const text = "このPDFには発言が含まれていません";
    const statements = parseStatements(text);
    expect(statements).toHaveLength(0);
  });

  it("複数行にわたる発言を結合する", () => {
    const text = [
      "〇３番（鈴木花子） 今回の議題について",
      "詳しく伺いたいと思います。",
      "〇町長（佐藤一郎） お答えします。",
    ].join("\n");

    const statements = parseStatements(text);
    expect(statements).toHaveLength(2);
    expect(statements[0]!.content).toContain("今回の議題について");
    expect(statements[0]!.content).toContain("詳しく伺いたいと思います。");
  });
});
