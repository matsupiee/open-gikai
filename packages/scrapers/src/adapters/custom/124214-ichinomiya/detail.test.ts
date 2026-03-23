import { describe, expect, it } from "vitest";
import { parseSpeaker, classifyKind, parseStatements, parseHeldOn } from "./detail";

describe("parseSpeaker", () => {
  it("議長を正しくパースする", () => {
    const result = parseSpeaker("○議長（山田太郎君） 本日の会議を開きます。");
    expect(result.speakerName).toBe("山田太郎");
    expect(result.speakerRole).toBe("議長");
    expect(result.content).toBe("本日の会議を開きます。");
  });

  it("町長を正しくパースする", () => {
    const result = parseSpeaker("○町長（鈴木一郎君） ご説明申し上げます。");
    expect(result.speakerName).toBe("鈴木一郎");
    expect(result.speakerRole).toBe("町長");
    expect(result.content).toBe("ご説明申し上げます。");
  });

  it("副町長を正しくパースする", () => {
    const result = parseSpeaker("○副町長（田中次郎君） 補足いたします。");
    expect(result.speakerName).toBe("田中次郎");
    expect(result.speakerRole).toBe("副町長");
    expect(result.content).toBe("補足いたします。");
  });

  it("教育長を正しくパースする", () => {
    const result = parseSpeaker("○教育長（佐藤三郎君） お答えします。");
    expect(result.speakerName).toBe("佐藤三郎");
    expect(result.speakerRole).toBe("教育長");
    expect(result.content).toBe("お答えします。");
  });

  it("番号付き議員を正しくパースする", () => {
    const result = parseSpeaker("○１番（田中花子君） 質問いたします。");
    expect(result.speakerName).toBe("田中花子");
    expect(result.speakerRole).toBe("議員");
    expect(result.content).toBe("質問いたします。");
  });

  it("委員長を正しくパースする", () => {
    const result = parseSpeaker("○総務常任委員長（松本五郎君） 報告します。");
    expect(result.speakerName).toBe("松本五郎");
    expect(result.speakerRole).toBe("委員長");
    expect(result.content).toBe("報告します。");
  });

  it("課長を正しくパースする", () => {
    const result = parseSpeaker("○総務課長（高橋六郎君） ご報告します。");
    expect(result.speakerName).toBe("高橋六郎");
    expect(result.speakerRole).toBe("課長");
    expect(result.content).toBe("ご報告します。");
  });

  it("○マーカーなしのテキスト", () => {
    const result = parseSpeaker("午前10時開議");
    expect(result.speakerName).toBeNull();
    expect(result.speakerRole).toBeNull();
    expect(result.content).toBe("午前10時開議");
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
  it("○ マーカーで発言を分割する", () => {
    const text = [
      "○議長（山田太郎君） 本日の会議を開きます。",
      "○１番（田中花子君） 質問いたします。",
      "○町長（鈴木一郎君） お答えします。",
    ].join("\n");

    const statements = parseStatements(text);

    expect(statements).toHaveLength(3);
    expect(statements[0]!.speakerName).toBe("山田太郎");
    expect(statements[0]!.speakerRole).toBe("議長");
    expect(statements[0]!.kind).toBe("remark");
    expect(statements[0]!.content).toBe("本日の会議を開きます。");

    expect(statements[1]!.speakerName).toBe("田中花子");
    expect(statements[1]!.speakerRole).toBe("議員");
    expect(statements[1]!.kind).toBe("question");

    expect(statements[2]!.speakerName).toBe("鈴木一郎");
    expect(statements[2]!.speakerRole).toBe("町長");
    expect(statements[2]!.kind).toBe("answer");
  });

  it("登壇等のト書きをスキップする", () => {
    const text = [
      "○議長（山田太郎君） 本日の会議を開きます。",
      "○（登壇）",
      "○町長（鈴木一郎君） お答えします。",
    ].join("\n");

    const statements = parseStatements(text);

    expect(statements).toHaveLength(2);
    expect(statements[0]!.speakerRole).toBe("議長");
    expect(statements[1]!.speakerRole).toBe("町長");
  });

  it("contentHash が SHA-256 形式で生成される", () => {
    const text = "○議長（山田太郎君） 本日の会議を開きます。";

    const statements = parseStatements(text);

    expect(statements[0]!.contentHash).toMatch(/^[a-f0-9]{64}$/);
  });

  it("offset が正しく計算される", () => {
    const text = [
      "○議長（山田太郎君） 開会します。",
      "○１番（田中花子君） 質問です。",
    ].join("\n");

    const statements = parseStatements(text);

    expect(statements[0]!.startOffset).toBe(0);
    expect(statements[0]!.endOffset).toBe("開会します。".length);
    expect(statements[1]!.startOffset).toBe("開会します。".length + 1);
  });

  it("テキストが空の場合は空配列を返す", () => {
    const statements = parseStatements("");
    expect(statements).toHaveLength(0);
  });
});

describe("parseHeldOn", () => {
  it("YYYYMMDD.pdf 形式を解析する", () => {
    expect(parseHeldOn("https://www.town.ichinomiya.chiba.jp/assets/files/gikai/20240529.pdf")).toBe("2024-05-29");
    expect(parseHeldOn("https://www.town.ichinomiya.chiba.jp/assets/files/gikai/20250317.pdf")).toBe("2025-03-17");
  });

  it("R{年}.{月}kaigiroku.pdf 形式を解析する（令和）", () => {
    expect(parseHeldOn("https://www.town.ichinomiya.chiba.jp/assets/files/gikai/R6.9kaigiroku.pdf")).toBe("2024-09-01");
    expect(parseHeldOn("https://www.town.ichinomiya.chiba.jp/assets/files/gikai/R7.3kaigiroku.pdf")).toBe("2025-03-01");
    expect(parseHeldOn("https://www.town.ichinomiya.chiba.jp/assets/files/gikai/R1.9kaigiroku.pdf")).toBe("2019-09-01");
  });

  it("令和元年 R元 は正しく解析する", () => {
    expect(parseHeldOn("https://example.com/R元.9kaigiroku.pdf")).toBe("2019-09-01");
  });

  it("H30.{月}kaigiroku.pdf 形式を解析する（平成30年）", () => {
    expect(parseHeldOn("https://www.town.ichinomiya.chiba.jp/assets/files/gikai/H30.12kaigiroku.pdf")).toBe("2018-12-01");
    expect(parseHeldOn("https://www.town.ichinomiya.chiba.jp/assets/files/gikai/H30.3kaigiroku.pdf")).toBe("2018-03-01");
  });

  it("gikai{YY}{MM}{DD}.pdf 形式を解析する（平成）", () => {
    expect(parseHeldOn("https://www.town.ichinomiya.chiba.jp/assets/files/yakubaannai2/gikai251205.pdf")).toBe("2013-12-05");
    expect(parseHeldOn("https://www.town.ichinomiya.chiba.jp/assets/files/yakubaannai2/gikai25304.pdf")).toBe("2013-03-04");
  });

  it("解析できない場合は null を返す", () => {
    expect(parseHeldOn("https://example.com/unknown.pdf")).toBeNull();
  });
});
