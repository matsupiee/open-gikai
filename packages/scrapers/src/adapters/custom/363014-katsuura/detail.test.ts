import { describe, expect, it } from "vitest";
import {
  classifyKind,
  extractMeetingTitleFromText,
  parseHeldOnFromText,
  parseSpeaker,
  parseStatements,
} from "./detail";

describe("extractMeetingTitleFromText", () => {
  it("PDF 冒頭から正式タイトルを抽出する", () => {
    const text = `
      - 1 - 令和７年勝浦町マラソン議会（ひな会議）会議録第６日目
      １ 招集年月日 令和７年３月19日
    `;

    expect(extractMeetingTitleFromText(text)).toBe(
      "令和7年勝浦町マラソン議会（ひな会議）会議録第6日目",
    );
  });
});

describe("parseHeldOnFromText", () => {
  it("PDF 本文から開催日を抽出する", () => {
    const text = `
      令和７年勝浦町マラソン議会（ひな会議）会議録第６日目
      １ 招集年月日 令和７年３月19日
    `;

    expect(parseHeldOnFromText(text)).toBe("2025-03-19");
  });
});

describe("parseSpeaker", () => {
  it("議員番号と課長職を正しく解釈する", () => {
    expect(parseSpeaker("○３番（長尾隆資君） おはようございます。")).toEqual({
      speakerName: "長尾隆資",
      speakerRole: "議員",
      content: "おはようございます。",
    });

    expect(
      parseSpeaker("○総務防災課長（中瀬弘晴君） 改めましておはようございます。"),
    ).toEqual({
      speakerName: "中瀬弘晴",
      speakerRole: "課長",
      content: "改めましておはようございます。",
    });
  });
});

describe("classifyKind", () => {
  it("役職に応じて発言種別を返す", () => {
    expect(classifyKind("議長")).toBe("remark");
    expect(classifyKind("議員")).toBe("question");
    expect(classifyKind("課長")).toBe("answer");
  });
});

describe("parseStatements", () => {
  it("○マーカー付き発言を順に抽出する", () => {
    const text = `
      - 3 - 午前９時30分 開議
      ○議長（松田貴志君） ただいまから会議を開きます。
      ○３番（長尾隆資君） おはようございます。
      - 4 -
      ○議長（松田貴志君） 10番議員。
      ○総務防災課長（中瀬弘晴君） 改めましておはようございます。
    `;

    const statements = parseStatements(text);

    expect(statements).toHaveLength(4);
    expect(statements[0]?.speakerRole).toBe("議長");
    expect(statements[0]?.kind).toBe("remark");
    expect(statements[1]?.speakerName).toBe("長尾隆資");
    expect(statements[1]?.kind).toBe("question");
    expect(statements[2]?.content).toBe("10番議員。");
    expect(statements[3]?.speakerRole).toBe("課長");
    expect(statements[3]?.kind).toBe("answer");
  });
});
