import { describe, expect, it } from "vitest";
import {
  classifyKind,
  parseHeldOn,
  parseSpeaker,
  parseStatements,
} from "./detail";

describe("parseHeldOn", () => {
  it("招 集 年 月 日 形式から開催日を抽出する", () => {
    expect(
      parseHeldOn("招 集 年 月 日 令和８年２月１２日（木） 招 集 場 所 穴水町議会議場")
    ).toBe("2026-02-12");
  });

  it("招集年 月 日 形式から開催日を抽出する", () => {
    expect(
      parseHeldOn("招 集年 月 日 平成２１年２月１９日（木） 招 集 場 所 穴水町議会議場")
    ).toBe("2009-02-19");
  });
});

describe("parseSpeaker", () => {
  it("議長の発言を解析する", () => {
    const result = parseSpeaker("○議長（浜崎音男） 只今から、会議を開きます。");
    expect(result.speakerName).toBe("浜崎音男");
    expect(result.speakerRole).toBe("議長");
    expect(result.content).toBe("只今から、会議を開きます。");
  });

  it("番号付き議員の発言を解析する", () => {
    const result = parseSpeaker("〇９番（小坂孝純） 追悼の言葉を申し上げます。");
    expect(result.speakerName).toBe("小坂孝純");
    expect(result.speakerRole).toBe("議員");
    expect(result.content).toBe("追悼の言葉を申し上げます。");
  });

  it("課長職を末尾サフィックスで解析する", () => {
    const result = parseSpeaker("○総務課長（北川人嗣） ご説明いたします。");
    expect(result.speakerName).toBe("北川人嗣");
    expect(result.speakerRole).toBe("課長");
    expect(result.content).toBe("ご説明いたします。");
  });
});

describe("classifyKind", () => {
  it("議長は remark", () => {
    expect(classifyKind("議長")).toBe("remark");
  });

  it("町長は answer", () => {
    expect(classifyKind("町長")).toBe("answer");
  });

  it("議員は question", () => {
    expect(classifyKind("議員")).toBe("question");
  });
});

describe("parseStatements", () => {
  it("○/〇 マーカー付きの発言を順に分割する", () => {
    const text = `
      ◎開会
      ○議長（浜崎音男） 只今から、平成２１年第１回穴水町議会臨時会を開会いたします。
      ○議長（浜崎音男） これより、会議録署名議員の指名を行います。
      ○町長（石川宣雄） 本日ここに、平成２１年第１回穴水町議会臨時会を招集いたしました。
    `;

    const statements = parseStatements(text);

    expect(statements).toHaveLength(3);
    expect(statements[0]!.speakerRole).toBe("議長");
    expect(statements[0]!.kind).toBe("remark");
    expect(statements[1]!.speakerName).toBe("浜崎音男");
    expect(statements[2]!.speakerRole).toBe("町長");
    expect(statements[2]!.kind).toBe("answer");
  });

  it("contentHash を付与する", () => {
    const text =
      "○議長（浜崎音男） 只今から、会議を開きます。" +
      "○町長（石川宣雄） 提案理由をご説明いたします。";

    const statements = parseStatements(text);

    expect(statements).toHaveLength(2);
    expect(statements[0]!.contentHash).toMatch(/^[a-f0-9]{64}$/);
    expect(statements[1]!.contentHash).toMatch(/^[a-f0-9]{64}$/);
  });

  it("話者を特定できないブロックはスキップする", () => {
    const text = `
      ◎議事の経過
      ○議長（浜崎音男） これより採決を行います。
      ◎閉会
    `;

    const statements = parseStatements(text);

    expect(statements).toHaveLength(1);
    expect(statements[0]!.speakerName).toBe("浜崎音男");
  });
});
