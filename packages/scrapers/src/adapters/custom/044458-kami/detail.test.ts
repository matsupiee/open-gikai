import { describe, expect, it } from "vitest";
import { parseSpeaker, classifyKind, parseStatements } from "./detail";

describe("parseSpeaker", () => {
  it("議長を正しくパースする", () => {
    const result = parseSpeaker("○議長（早坂忠幸君） 皆さん、本日は大変ご苦労さまです。");
    expect(result.speakerName).toBe("早坂忠幸");
    expect(result.speakerRole).toBe("議長");
    expect(result.content).toBe("皆さん、本日は大変ご苦労さまです。");
  });

  it("町長を正しくパースする", () => {
    const result = parseSpeaker("○町長（石山敬貴君） 議案第１号について説明申し上げます。");
    expect(result.speakerName).toBe("石山敬貴");
    expect(result.speakerRole).toBe("町長");
    expect(result.content).toBe("議案第１号について説明申し上げます。");
  });

  it("課長を正しくパースする", () => {
    const result = parseSpeaker("○保健福祉課長（森田和紀君） 保健福祉課長でございます。");
    expect(result.speakerName).toBe("森田和紀");
    expect(result.speakerRole).toBe("課長");
    expect(result.content).toBe("保健福祉課長でございます。");
  });

  it("番号付き議員を正しくパースする", () => {
    const result = parseSpeaker("○３番（柳川文俊君） ５ページの住民税均等割課税世帯支援事業について。");
    expect(result.speakerName).toBe("柳川文俊");
    expect(result.speakerRole).toBe("議員");
    expect(result.content).toBe("５ページの住民税均等割課税世帯支援事業について。");
  });

  it("副町長を正しくパースする", () => {
    const result = parseSpeaker("○副町長（千葉伸君） ご説明いたします。");
    expect(result.speakerName).toBe("千葉伸");
    expect(result.speakerRole).toBe("副町長");
    expect(result.content).toBe("ご説明いたします。");
  });

  it("教育長を正しくパースする", () => {
    const result = parseSpeaker("○教育長（鎌田稔君） 教育施策についてお答えします。");
    expect(result.speakerName).toBe("鎌田稔");
    expect(result.speakerRole).toBe("教育長");
    expect(result.content).toBe("教育施策についてお答えします。");
  });

  it("○マーカーなしのテキストはそのままcontentに", () => {
    const result = parseSpeaker("午後３時３１分 開会・開議");
    expect(result.speakerName).toBeNull();
    expect(result.speakerRole).toBeNull();
    expect(result.content).toBe("午後３時３１分 開会・開議");
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

  it("教育長は answer", () => {
    expect(classifyKind("教育長")).toBe("answer");
  });

  it("議員は question", () => {
    expect(classifyKind("議員")).toBe("question");
  });

  it("null は remark", () => {
    expect(classifyKind(null)).toBe("remark");
  });
});

describe("parseStatements", () => {
  it("○ マーカーで発言を分割して抽出する", () => {
    const text = `
- 3 - 午後３時３１分 開会・開議 ○議長（早坂忠幸君） 皆さん、本日は大変ご苦労さまです。 ただいまの出席議員は16名であります。 ○議長（早坂忠幸君） 日程第１、会議録署名議員の指名を行います。 ○３番（柳川文俊君） ５ページの住民税均等割課税世帯支援事業について質問します。 ○保健福祉課長（森田和紀君） 保健福祉課長でございます。住民税均等割のみ課税世帯への給付についてお答えします。
    `;

    const statements = parseStatements(text);

    expect(statements.length).toBeGreaterThanOrEqual(4);

    expect(statements[0]!.speakerName).toBe("早坂忠幸");
    expect(statements[0]!.speakerRole).toBe("議長");
    expect(statements[0]!.kind).toBe("remark");

    expect(statements[2]!.speakerName).toBe("柳川文俊");
    expect(statements[2]!.speakerRole).toBe("議員");
    expect(statements[2]!.kind).toBe("question");

    expect(statements[3]!.speakerName).toBe("森田和紀");
    expect(statements[3]!.speakerRole).toBe("課長");
    expect(statements[3]!.kind).toBe("answer");
  });

  it("カッコ内に登壇が入るト書きをスキップする", () => {
    // ○（町長 石山敬貴君 登壇）のような形式はスキップされる
    const text = `○（町長 石山敬貴君 登壇） ○町長（石山敬貴君） 議案について説明します。`;

    const statements = parseStatements(text);

    // 登壇ブロックはスキップ、本文のみ残る
    expect(statements.length).toBe(1);
    expect(statements[0]!.content).toBe("議案について説明します。");
  });

  it("contentHash が SHA-256 形式で生成される", () => {
    const text = `○議長（早坂忠幸君） 本日の会議を開きます。`;

    const statements = parseStatements(text);

    expect(statements[0]!.contentHash).toMatch(/^[a-f0-9]{64}$/);
  });

  it("offset が正しく計算される", () => {
    const text = `○議長（早坂忠幸君） ただいま。 ○町長（石山敬貴君） お答えします。`;

    const statements = parseStatements(text);

    expect(statements[0]!.startOffset).toBe(0);
    expect(statements[0]!.endOffset).toBe("ただいま。".length);
    expect(statements[1]!.startOffset).toBe("ただいま。".length + 1);
  });

  it("発言がない場合は空配列を返す", () => {
    const text = "午後３時３１分 開会・開議 本日の会議を開きます。";

    const statements = parseStatements(text);

    expect(statements).toHaveLength(0);
  });
});
