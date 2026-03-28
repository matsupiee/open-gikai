import { describe, expect, it } from "vitest";
import {
  classifyKind,
  extractHeldOn,
  parseSpeaker,
  parseStatements,
} from "./detail";

describe("parseSpeaker", () => {
  it("議長の発言をパースする", () => {
    expect(parseSpeaker("◎議長（小池弘基君） ただいまから会議を開きます。")).toEqual({
      speakerName: "小池弘基",
      speakerRole: "議長",
      content: "ただいまから会議を開きます。",
    });
  });

  it("部長職の発言をパースする", () => {
    expect(
      parseSpeaker(
        "◎住民福祉部長（神近秀敏君） それでは、答弁をさせていただきます。",
      ),
    ).toEqual({
      speakerName: "神近秀敏",
      speakerRole: "住民福祉部長",
      content: "それでは、答弁をさせていただきます。",
    });
  });

  it("議席番号の発言を議員として扱う", () => {
    expect(parseSpeaker("◎１０番（田川正治君） 通告に基づき一般質問を行います。")).toEqual({
      speakerName: "田川正治",
      speakerRole: "議員",
      content: "通告に基づき一般質問を行います。",
    });
  });

  it("かっこなしの役職 氏名君 形式をパースする", () => {
    expect(
      parseSpeaker(
        "〇社会教育課長 石川弘一君 報告第７号は、和解及び損害賠償の額を定めることについてでございます。",
      ),
    ).toEqual({
      speakerName: "石川弘一",
      speakerRole: "社会教育課長",
      content:
        "報告第７号は、和解及び損害賠償の額を定めることについてでございます。",
    });
  });

  it("氏名の途中に空白が入る形式をパースする", () => {
    expect(parseSpeaker("〇町長 箱田 彰君 おはようございます。")).toEqual({
      speakerName: "箱田彰",
      speakerRole: "町長",
      content: "おはようございます。",
    });
  });
});

describe("classifyKind", () => {
  it("議長発言を remark と判定する", () => {
    expect(classifyKind("議長")).toBe("remark");
  });

  it("行政側の発言を answer と判定する", () => {
    expect(classifyKind("住民福祉部長")).toBe("answer");
  });

  it("議員発言を question と判定する", () => {
    expect(classifyKind("議員")).toBe("question");
  });
});

describe("extractHeldOn", () => {
  it("PDF テキスト先頭の和暦日付を抽出する", () => {
    expect(
      extractHeldOn(
        "令和 ７ 年 第 １ 回（ ３ 月） 粕屋町議会定例会会議 録 令和 ７ 年 ２ 月 27 日 開会",
      ),
    ).toBe("2025-02-27");
  });
});

describe("parseStatements", () => {
  it("◎マーカーの連続した発言を抽出する", () => {
    const text = `
      （開会 午前９時30分）
      ◎議長（小池弘基君） 日程第１．会議録署名議員の指名をいたします。
      （町長 箱田彰君 登壇）
      ◎町長（箱田 彰君） おはようございます。本日、令和７年第１回３月の粕屋町議会定例会を招集いたしました。
      ◎１０番（田川正治君） 通告に基づき一般質問を行います。
      ◎住民福祉部長（神近秀敏君） それでは、高校生世代までの拡大について答弁いたします。
    `;

    const result = parseStatements(text);

    expect(result).toHaveLength(4);
    expect(result[0]!.speakerRole).toBe("議長");
    expect(result[0]!.kind).toBe("remark");
    expect(result[1]!.speakerRole).toBe("町長");
    expect(result[1]!.kind).toBe("answer");
    expect(result[2]!.speakerRole).toBe("議員");
    expect(result[2]!.kind).toBe("question");
    expect(result[3]!.speakerRole).toBe("住民福祉部長");
    expect(result[3]!.kind).toBe("answer");
    expect(result[1]!.content).toContain("おはようございます。");
    expect(result[1]!.content).not.toContain("登壇");
    expect(result[0]!.contentHash).toHaveLength(64);
  });
});
