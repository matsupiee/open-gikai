import { describe, expect, it } from "vitest";
import { parseSpeaker, classifyKind, parseStatements } from "./detail";
import { parseWarekiDate, warekiToSeireki } from "./shared";

describe("warekiToSeireki", () => {
  it("令和7年を2025年に変換する", () => {
    expect(warekiToSeireki("r", 7)).toBe(2025);
  });

  it("令和1年を2019年に変換する", () => {
    expect(warekiToSeireki("R", 1)).toBe(2019);
  });

  it("平成31年を2019年に変換する", () => {
    expect(warekiToSeireki("h", 31)).toBe(2019);
  });

  it("平成14年を2002年に変換する", () => {
    expect(warekiToSeireki("H", 14)).toBe(2002);
  });
});

describe("parseWarekiDate", () => {
  it("R07/3/11 を 2025-03-11 に変換する", () => {
    expect(parseWarekiDate("R07/3/11")).toBe("2025-03-11");
  });

  it("R06/12/5 を 2024-12-05 に変換する", () => {
    expect(parseWarekiDate("R06/12/5")).toBe("2024-12-05");
  });

  it("H14/11/1 を 2002-11-01 に変換する", () => {
    expect(parseWarekiDate("H14/11/1")).toBe("2002-11-01");
  });

  it("解析できない場合は null を返す", () => {
    expect(parseWarekiDate("令和7年3月")).toBeNull();
    expect(parseWarekiDate("2025/3/11")).toBeNull();
    expect(parseWarekiDate("")).toBeNull();
  });
});

describe("parseSpeaker", () => {
  it("議長を正しくパースする", () => {
    const result = parseSpeaker("○田中議長 ただいまから会議を開きます。");
    expect(result.speakerName).toBe("田中");
    expect(result.speakerRole).toBe("議長");
    expect(result.content).toBe("ただいまから会議を開きます。");
  });

  it("副議長を正しくパースする", () => {
    const result = parseSpeaker("○山田副議長 着席してください。");
    expect(result.speakerName).toBe("山田");
    expect(result.speakerRole).toBe("副議長");
    expect(result.content).toBe("着席してください。");
  });

  it("町長を正しくパースする", () => {
    const result = parseSpeaker("○鈴木町長 お答えいたします。");
    expect(result.speakerName).toBe("鈴木");
    expect(result.speakerRole).toBe("町長");
    expect(result.content).toBe("お答えいたします。");
  });

  it("副町長を正しくパースする（副町長 > 町長 の順序確認）", () => {
    const result = parseSpeaker("○佐藤副町長 ご説明いたします。");
    expect(result.speakerName).toBe("佐藤");
    expect(result.speakerRole).toBe("副町長");
    expect(result.content).toBe("ご説明いたします。");
  });

  it("委員長を正しくパースする", () => {
    const result = parseSpeaker("○高橋委員長 審議を開始します。");
    expect(result.speakerName).toBe("高橋");
    expect(result.speakerRole).toBe("委員長");
    expect(result.content).toBe("審議を開始します。");
  });

  it("副委員長を正しくパースする（副委員長 > 委員長 の順序確認）", () => {
    const result = parseSpeaker("○伊藤副委員長 進行します。");
    expect(result.speakerName).toBe("伊藤");
    expect(result.speakerRole).toBe("副委員長");
    expect(result.content).toBe("進行します。");
  });

  it("課長を正しくパースする", () => {
    const result = parseSpeaker("○田村総務課長 ご報告いたします。");
    expect(result.speakerName).toBe("田村総務");
    expect(result.speakerRole).toBe("課長");
    expect(result.content).toBe("ご報告いたします。");
  });

  it("議員を正しくパースする", () => {
    const result = parseSpeaker("○佐々木議員 質問いたします。");
    expect(result.speakerName).toBe("佐々木");
    expect(result.speakerRole).toBe("議員");
    expect(result.content).toBe("質問いたします。");
  });

  it("◯マーカーなしのテキスト", () => {
    const result = parseSpeaker("午後１時開議");
    expect(result.speakerName).toBeNull();
    expect(result.speakerRole).toBeNull();
    expect(result.content).toBe("午後１時開議");
  });

  it("◯マーカーあり・役職不明の場合は名前のみ", () => {
    const result = parseSpeaker("○田中太郎 発言します。");
    expect(result.speakerName).toBe("田中太郎");
    expect(result.speakerRole).toBeNull();
    expect(result.content).toBe("発言します。");
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

  it("議員は question", () => {
    expect(classifyKind("議員")).toBe("question");
  });

  it("null は remark", () => {
    expect(classifyKind(null)).toBe("remark");
  });
});

describe("parseStatements", () => {
  it("○マーカーで始まる行を発言として抽出する", () => {
    const text = `
○田中議長　ただいまから会議を開きます。
○佐々木議員　質問いたします。
○鈴木町長　お答えいたします。
    `;

    const statements = parseStatements(text);

    expect(statements).toHaveLength(3);

    expect(statements[0]!.speakerName).toBe("田中");
    expect(statements[0]!.speakerRole).toBe("議長");
    expect(statements[0]!.kind).toBe("remark");
    expect(statements[0]!.content).toBe("ただいまから会議を開きます。");

    expect(statements[1]!.speakerName).toBe("佐々木");
    expect(statements[1]!.speakerRole).toBe("議員");
    expect(statements[1]!.kind).toBe("question");

    expect(statements[2]!.speakerName).toBe("鈴木");
    expect(statements[2]!.speakerRole).toBe("町長");
    expect(statements[2]!.kind).toBe("answer");
  });

  it("複数行にわたる発言をまとめる", () => {
    const text = `
○佐々木議員　質問いたします。
この件について詳しく説明してください。
よろしくお願いします。
○鈴木町長　お答えします。
    `;

    const statements = parseStatements(text);

    expect(statements).toHaveLength(2);
    expect(statements[0]!.content).toBe(
      "質問いたします。 この件について詳しく説明してください。 よろしくお願いします。",
    );
    expect(statements[1]!.speakerRole).toBe("町長");
  });

  it("contentHash が SHA-256 形式で生成される", () => {
    const text = `○田中議長　ただいまから会議を開きます。`;

    const statements = parseStatements(text);
    expect(statements[0]!.contentHash).toMatch(/^[a-f0-9]{64}$/);
  });

  it("offset が正しく計算される", () => {
    const text = `
○田中議長　ただいま。
○佐々木議員　質問です。
    `;

    const statements = parseStatements(text);
    expect(statements[0]!.startOffset).toBe(0);
    expect(statements[0]!.endOffset).toBe("ただいま。".length);
    expect(statements[1]!.startOffset).toBe("ただいま。".length + 1);
  });

  it("空テキストでは空配列を返す", () => {
    expect(parseStatements("")).toHaveLength(0);
    expect(parseStatements("   \n   ")).toHaveLength(0);
  });
});
